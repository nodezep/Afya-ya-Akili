import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly webUrl: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM') ?? 'AKILI <no-reply@akili.health>';
    this.webUrl = config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST') ?? 'localhost',
      port: config.get<number>('SMTP_PORT') ?? 1025,
      secure: config.get<string>('SMTP_SECURE') === 'true',
      auth: config.get<string>('SMTP_USER')
        ? {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
  }

  private layout(title: string, body: string): string {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#0f766e;padding:20px 32px;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">AKILI</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${title}</h1>
            <div style="font-size:15px;line-height:1.6;color:#334155;">${body}</div>
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              You received this email because you have an AKILI account.
              If this wasn't you, please secure your account or contact support.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }

  private button(url: string, label: string): string {
    return `<p style="margin:24px 0;"><a href="${url}" style="background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block;">${label}</a></p>`;
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...options });
    } catch (err) {
      // Email failures must never break auth flows; they are logged for ops.
      this.logger.error(`Failed to send email to ${options.to}: ${(err as Error).message}`);
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${this.webUrl}/auth/verify-email?token=${token}`;
    await this.send({
      to,
      subject: 'Verify your AKILI email address',
      html: this.layout(
        'Verify your email',
        `<p>Welcome to AKILI — your companion for better mental health.</p>
         <p>Please confirm your email address to activate your account. This link expires in 24 hours.</p>
         ${this.button(url, 'Verify email')}
         <p>Or paste this link into your browser:<br/><a href="${url}">${url}</a></p>`,
      ),
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = `${this.webUrl}/auth/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Reset your AKILI password',
      html: this.layout(
        'Reset your password',
        `<p>We received a request to reset your password. This link expires in 1 hour.</p>
         ${this.button(url, 'Reset password')}
         <p>If you didn't request this, you can safely ignore this email.</p>`,
      ),
    });
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: `${code} is your AKILI verification code`,
      html: this.layout(
        'Your verification code',
        `<p>Enter this code to continue. It expires in 10 minutes.</p>
         <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f766e;margin:24px 0;">${code}</p>
         <p>Never share this code with anyone — AKILI staff will never ask for it.</p>`,
      ),
    });
  }

  async sendAppointmentConfirmation(
    to: string,
    details: { therapistName: string; startsAt: Date; joinUrl?: string },
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Your AKILI session is confirmed',
      html: this.layout(
        'Session confirmed',
        `<p>Your session with <strong>${details.therapistName}</strong> is confirmed for
         <strong>${details.startsAt.toUTCString()}</strong>.</p>
         ${details.joinUrl ? this.button(details.joinUrl, 'Join video session') : ''}
         <p>You can manage or reschedule this appointment from your dashboard.</p>`,
      ),
    });
  }
}
