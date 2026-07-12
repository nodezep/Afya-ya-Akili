import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MpesaService } from './mpesa.service';

describe('MpesaService', () => {
  let service: MpesaService;

  beforeEach(() => {
    service = new MpesaService(new ConfigService({}));
  });

  describe('normalizePhone', () => {
    it('keeps 254-prefixed numbers', () => {
      expect(service.normalizePhone('254712345678')).toBe('254712345678');
    });

    it('converts 07XX to 2547XX', () => {
      expect(service.normalizePhone('0712345678')).toBe('254712345678');
    });

    it('converts +254 to 254', () => {
      expect(service.normalizePhone('+254712345678')).toBe('254712345678');
    });

    it('converts bare 7XX to 2547XX', () => {
      expect(service.normalizePhone('712345678')).toBe('254712345678');
    });

    it('rejects invalid numbers', () => {
      expect(() => service.normalizePhone('2345')).toThrow(BadRequestException);
    });
  });

  describe('parseCallback', () => {
    it('parses a successful STK callback', () => {
      const result = service.parseCallback({
        Body: {
          stkCallback: {
            MerchantRequestID: 'm1',
            CheckoutRequestID: 'c1',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 999 },
                { Name: 'MpesaReceiptNumber', Value: 'QK12345' },
                { Name: 'PhoneNumber', Value: 254712345678 },
              ],
            },
          },
        },
      });
      expect(result).toEqual({
        checkoutRequestId: 'c1',
        success: true,
        resultDesc: 'Success',
        mpesaReceipt: 'QK12345',
        amount: 999,
        phone: '254712345678',
      });
    });

    it('parses a cancelled STK callback', () => {
      const result = service.parseCallback({
        Body: {
          stkCallback: {
            MerchantRequestID: 'm1',
            CheckoutRequestID: 'c2',
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user',
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.checkoutRequestId).toBe('c2');
    });

    it('rejects malformed payloads', () => {
      expect(() => service.parseCallback({} as never)).toThrow(BadRequestException);
    });
  });
});
