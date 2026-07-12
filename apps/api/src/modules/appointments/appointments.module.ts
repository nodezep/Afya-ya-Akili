import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { VideoModule } from '../video/video.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [VideoModule, NotificationsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
