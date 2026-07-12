import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MpesaCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

/**
 * Safaricom Daraja M-Pesa integration (Lipa na M-Pesa Online / STK Push).
 */
@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private readonly baseUrl: string;
  private readonly consumerKey?: string;
  private readonly consumerSecret?: string;
  private readonly shortcode: string;
  private readonly passkey?: string;
  private readonly callbackUrl: string;

  private tokenCache?: { token: string; expiresAt: number };

  constructor(config: ConfigService) {
    const env = config.get<string>('MPESA_ENV') ?? 'sandbox';
    this.baseUrl =
      env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    this.consumerKey = config.get<string>('MPESA_CONSUMER_KEY');
    this.consumerSecret = config.get<string>('MPESA_CONSUMER_SECRET');
    this.shortcode = config.get<string>('MPESA_SHORTCODE') ?? '174379';
    this.passkey = config.get<string>('MPESA_PASSKEY');
    this.callbackUrl =
      config.get<string>('MPESA_CALLBACK_URL') ??
      'http://localhost:4000/api/v1/billing/mpesa/callback';
  }

  get isConfigured(): boolean {
    return Boolean(this.consumerKey && this.consumerSecret && this.passkey);
  }

  private async accessToken(): Promise<string> {
    if (!this.isConfigured) throw new ServiceUnavailableException('M-Pesa is not configured');
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
      return this.tokenCache.token;
    }
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!res.ok) {
      this.logger.error(`M-Pesa OAuth failed: ${res.status} ${await res.text()}`);
      throw new ServiceUnavailableException('M-Pesa authentication failed');
    }
    const json = (await res.json()) as { access_token: string; expires_in: string };
    this.tokenCache = {
      token: json.access_token,
      expiresAt: Date.now() + Number(json.expires_in) * 1000,
    };
    return json.access_token;
  }

  /** Normalises 07XX / +2547XX to 2547XX as Daraja requires. */
  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) return digits;
    if (digits.startsWith('0')) return `254${digits.slice(1)}`;
    if (digits.startsWith('7') || digits.startsWith('1')) return `254${digits}`;
    throw new BadRequestException('Invalid Kenyan phone number');
  }

  async stkPush(params: {
    phone: string;
    amountKes: number;
    accountReference: string;
    description: string;
  }): Promise<{ merchantRequestId: string; checkoutRequestId: string; customerMessage: string }> {
    const token = await this.accessToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:]/g, '')
      .slice(0, 14);
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    const phone = this.normalizePhone(params.phone);

    const res = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.max(1, Math.round(params.amountKes)),
        PartyA: phone,
        PartyB: this.shortcode,
        PhoneNumber: phone,
        CallBackURL: this.callbackUrl,
        AccountReference: params.accountReference.slice(0, 12),
        TransactionDesc: params.description.slice(0, 13),
      }),
    });

    const json = (await res.json()) as StkPushResponse & { errorMessage?: string };
    if (!res.ok || json.ResponseCode !== '0') {
      this.logger.error(`STK push failed: ${JSON.stringify(json)}`);
      throw new ServiceUnavailableException(json.errorMessage ?? 'M-Pesa request failed');
    }
    return {
      merchantRequestId: json.MerchantRequestID,
      checkoutRequestId: json.CheckoutRequestID,
      customerMessage: json.CustomerMessage,
    };
  }

  parseCallback(body: MpesaCallbackBody): {
    checkoutRequestId: string;
    success: boolean;
    resultDesc: string;
    mpesaReceipt?: string;
    amount?: number;
    phone?: string;
  } {
    const cb = body?.Body?.stkCallback;
    if (!cb) throw new BadRequestException('Malformed M-Pesa callback');
    const items = cb.CallbackMetadata?.Item ?? [];
    const find = (name: string) => items.find((i) => i.Name === name)?.Value;
    return {
      checkoutRequestId: cb.CheckoutRequestID,
      success: cb.ResultCode === 0,
      resultDesc: cb.ResultDesc,
      mpesaReceipt: find('MpesaReceiptNumber') as string | undefined,
      amount: find('Amount') as number | undefined,
      phone: find('PhoneNumber')?.toString(),
    };
  }
}
