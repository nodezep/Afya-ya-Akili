import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  OAuthLoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account with email and password' })
  register(@Body() dto: RegisterDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.auth.register(dto, { userAgent, ip });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.auth.login(dto, { userAgent, ip });
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a Supabase (Google/Apple) token for AKILI tokens' })
  oauth(@Body() dto: OAuthLoginDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.auth.oauthLogin(dto, { userAgent, ip });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  refresh(@Body() dto: RefreshTokenDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.auth.refresh(dto.refreshToken, { userAgent, ip });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the given refresh token' })
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with the token from the verification email' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resend the email verification link' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password while signed in' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a one-time code (login or phone verification)' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a one-time code' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.auth.verifyOtp(dto, { userAgent, ip });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user with profile and plan' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
