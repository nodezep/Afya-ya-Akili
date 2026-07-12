import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe?: Stripe;
  private readonly webhookSecret?: string;
  private readonly webUrl: string;

  constructor(config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
    }
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET');
    this.webUrl = config.get<string>('WEB_URL') ?? 'http://localhost:3000';
  }

  get isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  private client(): Stripe {
    if (!this.stripe) throw new ServiceUnavailableException('Stripe is not configured');
    return this.stripe;
  }

  async createCheckoutSession(params: {
    userId: string;
    email: string;
    priceId: string;
    mode: 'subscription' | 'payment';
    metadata?: Record<string, string>;
  }): Promise<{ url: string; sessionId: string }> {
    const session = await this.client().checkout.sessions.create({
      mode: params.mode,
      customer_email: params.email,
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: `${this.webUrl}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/billing?status=cancelled`,
      metadata: { userId: params.userId, ...params.metadata },
      subscription_data:
        params.mode === 'subscription'
          ? { metadata: { userId: params.userId, ...params.metadata } }
          : undefined,
    });
    if (!session.url) throw new ServiceUnavailableException('Stripe did not return a checkout URL');
    return { url: session.url, sessionId: session.id };
  }

  async createBillingPortalSession(customerId: string): Promise<string> {
    const session = await this.client().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.webUrl}/billing`,
    });
    return session.url;
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    }
    return this.client().webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    await this.client().subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async getSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.retrieve(stripeSubscriptionId);
  }
}
