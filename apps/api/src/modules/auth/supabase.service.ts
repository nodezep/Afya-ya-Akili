import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface SupabaseIdentity {
  supabaseId: string;
  email: string;
  provider: 'google' | 'apple' | 'email';
  fullName?: string;
  avatarUrl?: string;
}

/**
 * Verifies Supabase-issued access tokens. Google and Apple sign-in are
 * performed by Supabase Auth on the client; the resulting JWT is exchanged
 * here for first-party AKILI tokens.
 */
@Injectable()
export class SupabaseService {
  private readonly jwtSecret?: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.jwtSecret = config.get<string>('SUPABASE_JWT_SECRET');
  }

  async verifyAccessToken(token: string): Promise<SupabaseIdentity> {
    if (!this.jwtSecret) {
      throw new UnauthorizedException('OAuth login is not configured on this server');
    }

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.jwtSecret,
        // Supabase signs user JWTs with HS256 and aud=authenticated
        audience: 'authenticated',
      });
    } catch {
      throw new UnauthorizedException('Invalid Supabase token');
    }

    const email = payload.email as string | undefined;
    const sub = payload.sub as string | undefined;
    if (!email || !sub) {
      throw new UnauthorizedException('Supabase token is missing identity claims');
    }

    const appMeta = (payload.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const provider = (appMeta.provider as string) ?? 'email';

    return {
      supabaseId: sub,
      email,
      provider: provider === 'google' || provider === 'apple' ? provider : 'email',
      fullName: (userMeta.full_name as string) ?? (userMeta.name as string),
      avatarUrl: (userMeta.avatar_url as string) ?? (userMeta.picture as string),
    };
  }
}
