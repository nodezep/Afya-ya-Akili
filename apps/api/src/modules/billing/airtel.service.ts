import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface AirtelCallbackBody {
  transaction?: {
    id?: string;
    status_code?: string;
    message?: string;
    airtel_money_id?: string;
  };
}

/**
 * Airtel Money Collections API integration.
 */
@Injectable()
export class AirtelService {
  private readonly logger = new Logger(AirtelService.name);
  private readonly baseUrl: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly country: string;
  private readonly currency: string;

  private tokenCache?: { token: string; expiresAt: number };

  constructor(config: ConfigService) {
    const env = config.get<string>('AIRTEL_ENV') ?? 'sandbox';
    this.baseUrl =
      env === 'production' ? 'https://openapi.airtel.africa' : 'https://openapiuat.airtel.africa';
    this.clientId = config.get<string>('AIRTEL_CLIENT_ID');
    this.clientSecret = config.get<string>('AIRTEL_CLIENT_SECRET');
    this.country = config.get<string>('AIRTEL_COUNTRY') ?? 'KE';
    this.currency = config.get<string>('AIRTEL_CURRENCY') ?? 'KES';
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async accessToken(): Promise<string> {
    if (!this.isConfigured) throw new ServiceUnavailableException('Airtel Money is not configured');
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
      return this.tokenCache.token;
    }
    const res = await fetch(`${this.baseUrl}/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) {
      this.logger.error(`Airtel OAuth failed: ${res.status} ${await res.text()}`);
      throw new ServiceUnavailableException('Airtel Money authentication failed');
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  /** Initiates a USSD push collection. Returns the transaction reference. */
  async requestPayment(params: {
    phone: string;
    amount: number;
    reference: string;
  }): Promise<{ transactionId: string }> {
    const token = await this.accessToken();
    const transactionId = randomUUID();
    // Airtel expects the MSISDN without country code
    const msisdn = params.phone.replace(/\D/g, '').replace(/^254/, '').replace(/^0/, '');

    const res = await fetch(`${this.baseUrl}/merchant/v1/payments/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Country': this.country,
        'X-Currency': this.currency,
      },
      body: JSON.stringify({
        reference: params.reference.slice(0, 64),
        subscriber: { country: this.country, currency: this.currency, msisdn },
        transaction: {
          amount: Math.max(1, Math.round(params.amount)),
          country: this.country,
          currency: this.currency,
          id: transactionId,
        },
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      status?: { success?: boolean; message?: string };
    };
    if (!res.ok || json.status?.success === false) {
      this.logger.error(`Airtel payment request failed: ${JSON.stringify(json)}`);
      throw new ServiceUnavailableException(json.status?.message ?? 'Airtel Money request failed');
    }
    return { transactionId };
  }

  parseCallback(body: AirtelCallbackBody): {
    transactionId?: string;
    success: boolean;
    message?: string;
    airtelMoneyId?: string;
  } {
    const txn = body?.transaction ?? {};
    return {
      transactionId: txn.id,
      // TS = Transaction Success per Airtel docs
      success: txn.status_code === 'TS',
      message: txn.message,
      airtelMoneyId: txn.airtel_money_id,
    };
  }
}
