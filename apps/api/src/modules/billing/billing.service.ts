import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationChannel,
  PaymentProvider,
  PaymentStatus,
  PlanTier,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import type Stripe from 'stripe';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AirtelCallbackBody, AirtelService } from './airtel.service';
import { MpesaCallbackBody, MpesaService } from './mpesa.service';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly mpesa: MpesaService,
    private readonly airtel: AirtelService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------
  // Plans & subscription state
  // ------------------------------------------------------------

  async plans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyCents: 'asc' } });
  }

  async mySubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (subscription) return subscription;
    const freePlan = await this.prisma.plan.findUnique({ where: { tier: PlanTier.FREE } });
    return { plan: freePlan, status: 'ACTIVE', isDefaultFree: true };
  }

  async myPayments(userId: string, dto: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);
    return paginate(items, total, dto);
  }

  // ------------------------------------------------------------
  // Stripe checkout (subscriptions)
  // ------------------------------------------------------------

  async createStripeCheckout(userId: string, interval: 'month' | 'year') {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { tier: PlanTier.PREMIUM } });
    const priceId = interval === 'year' ? plan.stripePriceYearly : plan.stripePriceMonthly;
    if (!priceId) {
      throw new BadRequestException('Stripe prices are not configured for this plan');
    }
    return this.stripe.createCheckoutSession({
      userId,
      email: user.email,
      priceId,
      mode: 'subscription',
      metadata: { planTier: PlanTier.PREMIUM, interval },
    });
  }

  async handleStripeWebhook(event: Stripe.Event) {
    await this.prisma.webhookEvent.upsert({
      where: { externalId: event.id },
      update: {},
      create: {
        provider: 'stripe',
        eventType: event.type,
        externalId: event.id,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        if (session.mode === 'subscription' && session.subscription) {
          await this.activateStripeSubscription(
            userId,
            session.subscription as string,
            (session.metadata?.interval as 'month' | 'year') ?? 'month',
          );
        }
        await this.prisma.payment.create({
          data: {
            userId,
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.SUCCEEDED,
            amountCents: session.amount_total ?? 0,
            currency: (session.currency ?? 'usd').toUpperCase(),
            description: 'AKILI Premium subscription',
            providerRef: session.id,
          },
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const record = await this.prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!record) break;
        const statusMap: Record<string, SubscriptionStatus> = {
          active: SubscriptionStatus.ACTIVE,
          trialing: SubscriptionStatus.TRIALING,
          past_due: SubscriptionStatus.PAST_DUE,
          canceled: SubscriptionStatus.CANCELLED,
          unpaid: SubscriptionStatus.PAST_DUE,
          incomplete_expired: SubscriptionStatus.EXPIRED,
        };
        await this.prisma.subscription.update({
          where: { id: record.id },
          data: {
            status: statusMap[sub.status] ?? SubscriptionStatus.EXPIRED,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }
      default:
        break;
    }

    await this.prisma.webhookEvent.updateMany({
      where: { externalId: event.id },
      data: { processedAt: new Date() },
    });
    return { received: true };
  }

  private async activateStripeSubscription(
    userId: string,
    stripeSubscriptionId: string,
    interval: 'month' | 'year',
  ) {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { tier: PlanTier.PREMIUM } });
    const stripeSub = await this.stripe.getSubscription(stripeSubscriptionId);
    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId },
      update: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      },
      create: {
        userId,
        planId: plan.id,
        provider: PaymentProvider.STRIPE,
        stripeSubscriptionId,
        interval,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      },
    });
    await this.notifications.create(userId, {
      type: 'BILLING',
      title: 'Welcome to AKILI Premium',
      body: 'Your Premium subscription is now active. Enjoy unlimited AI chat and the full library.',
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
    });
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) throw new NotFoundException('No active subscription');

    if (subscription.stripeSubscriptionId) {
      await this.stripe.cancelSubscription(subscription.stripeSubscriptionId);
    }
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });
  }

  // ------------------------------------------------------------
  // Mobile money (M-Pesa / Airtel) — subscriptions & session payments
  // ------------------------------------------------------------

  async mobileMoneyCheckout(
    userId: string,
    dto: {
      provider: 'MPESA' | 'AIRTEL_MONEY';
      phone: string;
      purpose: 'PREMIUM_MONTH' | 'PREMIUM_YEAR' | 'APPOINTMENT';
      appointmentId?: string;
    },
  ) {
    let amountCents: number;
    let description: string;
    const metadata: Record<string, string> = { purpose: dto.purpose };

    if (dto.purpose === 'APPOINTMENT') {
      if (!dto.appointmentId) throw new BadRequestException('appointmentId is required');
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
      });
      if (!appointment || appointment.clientId !== userId) {
        throw new NotFoundException('Appointment not found');
      }
      if (appointment.paymentId) throw new BadRequestException('Appointment is already paid');
      amountCents = appointment.priceCents;
      description = 'AKILI therapy session';
      metadata.appointmentId = dto.appointmentId;
    } else {
      const plan = await this.prisma.plan.findUniqueOrThrow({ where: { tier: PlanTier.PREMIUM } });
      amountCents = dto.purpose === 'PREMIUM_YEAR' ? plan.priceYearlyCents : plan.priceMonthlyCents;
      description = `AKILI Premium (${dto.purpose === 'PREMIUM_YEAR' ? 'yearly' : 'monthly'})`;
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: dto.provider === 'MPESA' ? PaymentProvider.MPESA : PaymentProvider.AIRTEL_MONEY,
        status: PaymentStatus.PENDING,
        amountCents,
        currency: 'KES',
        description,
        phone: dto.phone,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    const amountKes = Math.ceil(amountCents / 100);
    if (dto.provider === 'MPESA') {
      const result = await this.mpesa.stkPush({
        phone: dto.phone,
        amountKes,
        accountReference: 'AKILI',
        description: 'AKILI',
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerRef: result.checkoutRequestId, status: PaymentStatus.PROCESSING },
      });
      return { paymentId: payment.id, customerMessage: result.customerMessage };
    }

    const result = await this.airtel.requestPayment({
      phone: dto.phone,
      amount: amountKes,
      reference: payment.id,
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: result.transactionId, status: PaymentStatus.PROCESSING },
    });
    return {
      paymentId: payment.id,
      customerMessage: 'Check your phone and approve the Airtel Money request.',
    };
  }

  async handleMpesaCallback(body: MpesaCallbackBody) {
    const parsed = this.mpesa.parseCallback(body);
    await this.prisma.webhookEvent.create({
      data: {
        provider: 'mpesa',
        eventType: 'stk.callback',
        payload: body as unknown as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
    await this.settleMobilePayment(parsed.checkoutRequestId, parsed.success, parsed.resultDesc, {
      mpesaReceipt: parsed.mpesaReceipt,
    });
    // Daraja expects this exact acknowledgement shape
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  async handleAirtelCallback(body: AirtelCallbackBody) {
    const parsed = this.airtel.parseCallback(body);
    await this.prisma.webhookEvent.create({
      data: {
        provider: 'airtel',
        eventType: 'collection.callback',
        payload: body as unknown as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
    if (parsed.transactionId) {
      await this.settleMobilePayment(parsed.transactionId, parsed.success, parsed.message ?? '', {
        airtelMoneyId: parsed.airtelMoneyId,
      });
    }
    return { received: true };
  }

  private async settleMobilePayment(
    providerRef: string,
    success: boolean,
    resultDesc: string,
    extra: Record<string, string | undefined>,
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { providerRef } });
    if (!payment) {
      this.logger.warn(`Mobile money callback for unknown providerRef ${providerRef}`);
      return;
    }
    if (payment.status === PaymentStatus.SUCCEEDED) return; // idempotent

    if (!success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason: resultDesc },
      });
      await this.notifications.create(payment.userId, {
        type: 'BILLING',
        title: 'Payment failed',
        body: `Your payment could not be completed: ${resultDesc}`,
        channels: [NotificationChannel.PUSH],
      });
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        metadata: { ...(payment.metadata as Record<string, unknown>), ...extra } as Prisma.InputJsonValue,
      },
    });

    const metadata = (payment.metadata ?? {}) as { purpose?: string; appointmentId?: string };
    if (metadata.purpose === 'APPOINTMENT' && metadata.appointmentId) {
      await this.prisma.appointment.update({
        where: { id: metadata.appointmentId },
        data: { paymentId: payment.id },
      });
    } else if (metadata.purpose === 'PREMIUM_MONTH' || metadata.purpose === 'PREMIUM_YEAR') {
      const plan = await this.prisma.plan.findUniqueOrThrow({ where: { tier: PlanTier.PREMIUM } });
      const months = metadata.purpose === 'PREMIUM_YEAR' ? 12 : 1;
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + months);
      await this.prisma.subscription.create({
        data: {
          userId: payment.userId,
          planId: plan.id,
          provider: payment.provider,
          interval: months === 12 ? 'year' : 'month',
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    await this.notifications.create(payment.userId, {
      type: 'BILLING',
      title: 'Payment received',
      body: `Your payment of ${payment.currency} ${(payment.amountCents / 100).toFixed(2)} was successful.`,
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
    });
  }

  async paymentStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');
    return { id: payment.id, status: payment.status, failureReason: payment.failureReason };
  }
}
