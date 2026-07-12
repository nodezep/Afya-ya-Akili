import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TherapistsModule } from './modules/therapists/therapists.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { VideoModule } from './modules/video/video.module';
import { AiModule } from './modules/ai/ai.module';
import { ChatModule } from './modules/chat/chat.module';
import { RagModule } from './modules/rag/rag.module';
import { MoodModule } from './modules/mood/mood.module';
import { JournalModule } from './modules/journal/journal.module';
import { MeditationModule } from './modules/meditation/meditation.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { LearningModule } from './modules/learning/learning.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BillingModule } from './modules/billing/billing.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AdminModule } from './modules/admin/admin.module';
import { SearchModule } from './modules/search/search.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    UsersModule,
    TherapistsModule,
    AppointmentsModule,
    VideoModule,
    AiModule,
    ChatModule,
    RagModule,
    MoodModule,
    JournalModule,
    MeditationModule,
    AssessmentsModule,
    LearningModule,
    NotificationsModule,
    AnalyticsModule,
    BillingModule,
    OrganizationsModule,
    AdminModule,
    SearchModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
