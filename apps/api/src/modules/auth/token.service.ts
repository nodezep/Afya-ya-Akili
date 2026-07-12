import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.accessTtl = Number(config.get('JWT_ACCESS_TTL') ?? 900);
    this.refreshTtl = Number(config.get('JWT_REFRESH_TTL') ?? 2_592_000);
    this.refreshSecret = config.get<string>('JWT_REFRESH_SECRET')!;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async issueTokenPair(
    user: Pick<User, 'id' | 'email' | 'role'>,
    context?: { userAgent?: string; ip?: string },
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
      { expiresIn: this.accessTtl },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        userAgent: context?.userAgent?.slice(0, 255),
        ip: context?.ip,
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: this.accessTtl };
  }

  async rotateRefreshToken(
    refreshToken: string,
    context?: { userAgent?: string; ip?: string },
  ): Promise<{ user: Pick<User, 'id' | 'email' | 'role'>; tokens: TokenPair }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      include: { user: true },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const { user } = record;
    if (!user.isActive || user.isBanned || user.deletedAt) {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user, context);
    return { user: { id: user.id, email: user.email, role: user.role as Role }, tokens };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
