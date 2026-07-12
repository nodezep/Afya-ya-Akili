import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS delivery via Africa's Talking (primary carrier gateway for KE market).
 * When no API key is configured (local dev), messages are logged instead.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey?: string;
  private readonly username: string;
  private readonly senderId?: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('AFRICASTALKING_API_KEY');
    this.username = config.get<string>('AFRICASTALKING_USERNAME') ?? 'sandbox';
    this.senderId = config.get<string>('AFRICASTALKING_SENDER_ID');
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(`[DEV] SMS to ${to}: ${message}`);
      return;
    }

    const baseUrl =
      this.username === 'sandbox'
        ? 'https://api.sandbox.africastalking.com'
        : 'https://api.africastalking.com';

    const body = new URLSearchParams({
      username: this.username,
      to,
      message,
      ...(this.senderId ? { from: this.senderId } : {}),
    });

    const res = await fetch(`${baseUrl}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey: this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`SMS delivery to ${to} failed (${res.status}): ${text}`);
    }
  }
}
