import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Video rooms via Daily.co. When no API key is configured (local dev),
 * rooms resolve to the built-in web fallback URL so flows stay testable.
 */
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly apiKey?: string;
  private readonly domain?: string;
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('DAILY_API_KEY');
    this.domain = config.get<string>('DAILY_DOMAIN');
    this.webUrl = config.get<string>('WEB_URL') ?? 'http://localhost:3000';
  }

  async createRoomForAppointment(appointmentId: string, endsAt: Date) {
    const roomName = `akili-${appointmentId.slice(0, 13)}`;

    let roomUrl: string;
    if (this.apiKey && this.domain) {
      const res = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'private',
          properties: {
            exp: Math.floor(endsAt.getTime() / 1000) + 3600,
            enable_chat: true,
            enable_screenshare: true,
            eject_at_room_exp: true,
          },
        }),
      });
      if (!res.ok) {
        this.logger.error(`Daily room creation failed: ${res.status} ${await res.text()}`);
        throw new ServiceUnavailableException('Video room creation failed');
      }
      const json = (await res.json()) as { url: string };
      roomUrl = json.url;
    } else {
      roomUrl = `${this.webUrl}/session/${roomName}`;
      this.logger.warn(`[DEV] Daily not configured; using fallback room ${roomUrl}`);
    }

    return this.prisma.videoRoom.upsert({
      where: { appointmentId },
      update: { roomName, roomUrl },
      create: { appointmentId, roomName, roomUrl },
    });
  }

  /** Short-lived meeting token so only the two participants can join. */
  async createMeetingToken(roomName: string, userName: string, isOwner: boolean): Promise<string | null> {
    if (!this.apiKey) return null;
    const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName,
          is_owner: isOwner,
          exp: Math.floor(Date.now() / 1000) + 7200,
        },
      }),
    });
    if (!res.ok) {
      this.logger.error(`Daily token creation failed: ${res.status} ${await res.text()}`);
      throw new ServiceUnavailableException('Video token creation failed');
    }
    const json = (await res.json()) as { token: string };
    return json.token;
  }

  async markStarted(appointmentId: string) {
    await this.prisma.videoRoom.updateMany({
      where: { appointmentId, startedAt: null },
      data: { startedAt: new Date() },
    });
  }

  async markEnded(appointmentId: string) {
    await this.prisma.videoRoom.updateMany({
      where: { appointmentId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }
}
