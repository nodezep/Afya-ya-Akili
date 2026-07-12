import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AirtelCallbackBody } from './airtel.service';
import { BillingService } from './billing.service';
import { MpesaCallbackBody } from './mpesa.service';
import { StripeService } from './stripe.service';

export class StripeCheckoutDto {
  @ApiProperty({ enum: ['month', 'year'] })
  @IsIn(['month', 'year'])
  interval!: 'month' | 'year';
}

export class MobileMoneyCheckoutDto {
  @ApiProperty({ enum: ['MPESA', 'AIRTEL_MONEY'] })
  @IsIn(['MPESA', 'AIRTEL_MONEY'])
  provider!: 'MPESA' | 'AIRTEL_MONEY';

  @ApiProperty({ example: '+254712345678' })
  @IsString()
  phone!: string;

  @ApiProperty({ enum: ['PREMIUM_MONTH', 'PREMIUM_YEAR', 'APPOINTMENT'] })
  @IsIn(['PREMIUM_MONTH', 'PREMIUM_YEAR', 'APPOINTMENT'])
  purpose!: 'PREMIUM_MONTH' | 'PREMIUM_YEAR' | 'APPOINTMENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  appointmentId?: string;
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List pricing plans' })
  plans() {
    return this.billing.plans();
  }

  @Get('subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My current subscription' })
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.mySubscription(user.id);
  }

  @Get('payments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My payment history' })
  payments(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.billing.myPayments(user.id, pagination);
  }

  @Get('payments/:id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Poll a payment status (mobile money)' })
  paymentStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.paymentStatus(user.id, id);
  }

  @Post('stripe/checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe Checkout session for Premium' })
  stripeCheckout(@CurrentUser() user: AuthUser, @Body() dto: StripeCheckoutDto) {
    return this.billing.createStripeCheckout(user.id, dto.interval);
  }

  @Post('subscription/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel my subscription at period end' })
  cancelSubscription(@CurrentUser() user: AuthUser) {
    return this.billing.cancelSubscription(user.id);
  }

  @Post('mobile-money/checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay with M-Pesa (STK push) or Airtel Money' })
  mobileMoney(@CurrentUser() user: AuthUser, @Body() dto: MobileMoneyCheckoutDto) {
    return this.billing.mobileMoneyCheckout(user.id, dto);
  }

  // ---------------- Webhooks (public, verified by signature/shape) ----------------

  @Public()
  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing webhook payload or signature');
    }
    const event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    return this.billing.handleStripeWebhook(event);
  }

  @Public()
  @Post('mpesa/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Safaricom Daraja STK callback' })
  mpesaCallback(@Body() body: MpesaCallbackBody) {
    return this.billing.handleMpesaCallback(body);
  }

  @Public()
  @Post('airtel/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Airtel Money collection callback' })
  airtelCallback(@Body() body: AirtelCallbackBody) {
    return this.billing.handleAirtelCallback(body);
  }
}
