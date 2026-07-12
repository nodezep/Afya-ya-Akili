import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { TooManyRequestsException } from './otp.exceptions';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { SmsService } from './sms.service';

const OTP_TTL_SECONDS = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private isEmail(target: string): boolean {
    return target.includes('@');
  }

  async issue(userId: string, purpose: OtpPurpose, target: string): Promise<void> {
    const allowed = await this.redis.rateLimit(`otp:issue:${target}`, 3, 300);
    if (!allowed) {
      throw new TooManyRequestsException('Too many OTP requests. Try again in a few minutes.');
    }

    // Invalidate previous unexpired codes for this purpose
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = randomInt(100000, 1000000).toString();
    await this.prisma.otpCode.create({
      data: {
        userId,
        purpose,
        target,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    if (this.isEmail(target)) {
      await this.mail.sendOtpEmail(target, code);
    } else {
      await this.sms.send(target, `${code} is your AKILI verification code. Valid for 10 minutes.`);
    }
    this.logger.log(`OTP issued for user ${userId} (${purpose})`);
  }

  async verify(userId: string, purpose: OtpPurpose, code: string): Promise<void> {
    const record = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Code is invalid or has expired');
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    if (record.codeHash !== this.hash(code)) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code');
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }
}
