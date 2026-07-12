import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AirtelService } from './airtel.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MpesaService } from './mpesa.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BillingController],
  providers: [BillingService, StripeService, MpesaService, AirtelService],
  exports: [BillingService],
})
export class BillingModule {}
