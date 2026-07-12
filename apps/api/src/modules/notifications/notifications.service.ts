import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

export interface CreateNotificationInput {
  type: keyof typeof NotificationType | NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoToken?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.expoToken = config.get<string>('EXPO_ACCESS_TOKEN');
  }

  /** Creates the in-app notification and fans out to enabled channels. */
  async create(userId: string, input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: input.type as NotificationType,
        channel: NotificationChannel.IN_APP,
        title: input.title,
        body: input.body,
        data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
        sentAt: new Date(),
      },
    });

    const channels = input.channels ?? [];
    if (channels.length > 0) {
      const [user, prefs, devices] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
        this.prisma.userPreference.findUnique({ where: { userId } }),
        this.prisma.device.findMany({ where: { userId } }),
      ]);

      if (channels.includes(NotificationChannel.EMAIL) && user && (prefs?.emailNotifications ?? true)) {
        await this.mail.send({
          to: user.email,
          subject: input.title,
          html: `<p>${input.body}</p>`,
        });
      }
      if (channels.includes(NotificationChannel.PUSH) && (prefs?.pushNotifications ?? true)) {
        await this.sendPush(
          devices.map((d) => d.expoPushToken),
          input.title,
          input.body,
          input.data,
        );
      }
    }
    return notification;
  }

  private async sendPush(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    if (tokens.length === 0) return;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.expoToken ? { Authorization: `Bearer ${this.expoToken}` } : {}),
        },
        body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: 'default' }))),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      this.logger.warn(`Expo push error: ${(err as Error).message}`);
    }
  }

  async list(userId: string, dto: PaginationDto, unreadOnly = false) {
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }
}
