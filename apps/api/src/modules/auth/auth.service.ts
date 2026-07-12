import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProvider, OtpPurpose, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  ChangePasswordDto,
  LoginDto,
  OAuthLoginDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { OtpService } from './otp.service';
import { SupabaseService } from './supabase.service';
import { TokenPair, TokenService } from './token.service';

const VERIFY_EMAIL_TTL = 24 * 3600;
const RESET_PASSWORD_TTL = 3600;

export interface AuthResult {
  user: {
    id: string;
    email: string;
    role: Role;
    emailVerified: boolean;
    firstName?: string;
    lastName?: string;
  };
  tokens: TokenPair;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly supabase: SupabaseService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(user: User & { profile?: { firstName: string; lastName: string } | null }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
    };
  }

  // ------------------------------------------------------------
  // Registration & email verification
  // ------------------------------------------------------------

  async register(dto: RegisterDto, context?: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        provider: AuthProvider.EMAIL,
        profile: { create: { firstName: dto.firstName, lastName: dto.lastName } },
        preferences: { create: {} },
      },
      include: { profile: true },
    });

    await this.sendVerificationEmail(user.id, user.email);
    const tokens = await this.tokens.issueTokenPair(user, context);
    this.logger.log(`New registration: ${user.email}`);
    return { user: this.toAuthUser(user), tokens };
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.set(`verify-email:${this.hashToken(token)}`, userId, VERIFY_EMAIL_TTL);
    await this.mail.sendVerificationEmail(email, token);
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Do not leak account existence
    if (user && !user.emailVerifiedAt) {
      const allowed = await this.redis.rateLimit(`verify-resend:${user.id}`, 3, 900);
      if (allowed) await this.sendVerificationEmail(user.id, user.email);
    }
    return { message: 'If the account exists, a verification email has been sent.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const key = `verify-email:${this.hashToken(token)}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.redis.del(key);
    return { message: 'Email verified successfully' };
  }

  // ------------------------------------------------------------
  // Login / logout / refresh
  // ------------------------------------------------------------

  async login(dto: LoginDto, context?: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const allowed = await this.redis.rateLimit(`login:${dto.email.toLowerCase()}`, 10, 900);
    if (!allowed) {
      throw new UnauthorizedException('Too many login attempts. Try again later.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive || user.isBanned || user.deletedAt) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.tokens.issueTokenPair(user, context);
    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(refreshToken: string, context?: { userAgent?: string; ip?: string }): Promise<TokenPair> {
    const { tokens } = await this.tokens.rotateRefreshToken(refreshToken, context);
    return tokens;
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokens.revokeRefreshToken(refreshToken);
    return { message: 'Logged out' };
  }

  // ------------------------------------------------------------
  // Password reset & change
  // ------------------------------------------------------------

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const allowed = await this.redis.rateLimit(`pw-reset:${user.id}`, 3, 900);
      if (allowed) {
        const token = randomBytes(32).toString('base64url');
        await this.redis.set(`reset-password:${this.hashToken(token)}`, user.id, RESET_PASSWORD_TTL);
        await this.mail.sendPasswordResetEmail(user.email, token);
      }
    }
    return { message: 'If the account exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const key = `reset-password:${this.hashToken(dto.token)}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.redis.del(key);
    await this.tokens.revokeAllForUser(userId);
    return { message: 'Password updated. Please sign in with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(userId);
    return { message: 'Password changed. Other sessions have been signed out.' };
  }

  // ------------------------------------------------------------
  // OTP flows (passwordless login, phone verification)
  // ------------------------------------------------------------

  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const isEmail = dto.target.includes('@');
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: dto.target.toLowerCase() } : { phone: dto.target },
    });
    // Never reveal whether the account exists
    if (user) {
      const purpose = dto.purpose === 'LOGIN' ? OtpPurpose.LOGIN : OtpPurpose.VERIFY_PHONE;
      await this.otp.issue(user.id, purpose, isEmail ? user.email : dto.target);
    }
    return { message: 'If the account exists, a code has been sent.' };
  }

  async verifyOtp(dto: VerifyOtpDto, context?: { userAgent?: string; ip?: string }): Promise<AuthResult | { message: string }> {
    const isEmail = dto.target.includes('@');
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: dto.target.toLowerCase() } : { phone: dto.target },
      include: { profile: true },
    });
    if (!user) {
      throw new BadRequestException('Code is invalid or has expired');
    }

    const purpose = dto.purpose === 'LOGIN' ? OtpPurpose.LOGIN : OtpPurpose.VERIFY_PHONE;
    await this.otp.verify(user.id, purpose, dto.code);

    if (purpose === OtpPurpose.VERIFY_PHONE) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: new Date() },
      });
      return { message: 'Phone number verified' };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.tokens.issueTokenPair(user, context);
    return { user: this.toAuthUser(user), tokens };
  }

  // ------------------------------------------------------------
  // OAuth (Google / Apple through Supabase)
  // ------------------------------------------------------------

  async oauthLogin(dto: OAuthLoginDto, context?: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const identity = await this.supabase.verifyAccessToken(dto.supabaseAccessToken);

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ supabaseId: identity.supabaseId }, { email: identity.email.toLowerCase() }] },
      include: { profile: true },
    });

    if (user) {
      if (!user.supabaseId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            supabaseId: identity.supabaseId,
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          },
          include: { profile: true },
        });
      }
    } else {
      const [firstName, ...rest] = (identity.fullName ?? identity.email.split('@')[0]).split(' ');
      user = await this.prisma.user.create({
        data: {
          email: identity.email.toLowerCase(),
          supabaseId: identity.supabaseId,
          provider: identity.provider === 'apple' ? AuthProvider.APPLE : AuthProvider.GOOGLE,
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              firstName: firstName || 'AKILI',
              lastName: rest.join(' ') || 'Member',
              avatarUrl: identity.avatarUrl,
            },
          },
          preferences: { create: {} },
        },
        include: { profile: true },
      });
      this.logger.log(`New OAuth registration (${identity.provider}): ${user.email}`);
    }

    if (!user.isActive || user.isBanned || user.deletedAt) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.tokens.issueTokenPair(user, context);
    return { user: this.toAuthUser(user), tokens };
  }

  // ------------------------------------------------------------
  // Session info
  // ------------------------------------------------------------

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
        therapistProfile: { select: { id: true, status: true } },
        orgMemberships: {
          where: { status: 'ACTIVE' },
          include: { organization: { select: { id: true, name: true, slug: true } } },
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          include: { plan: { select: { tier: true, name: true } } },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const { passwordHash: _ignored, ...safe } = user;
    return {
      ...safe,
      emailVerified: Boolean(user.emailVerifiedAt),
      planTier: user.subscriptions[0]?.plan.tier ?? 'FREE',
    };
  }
}
