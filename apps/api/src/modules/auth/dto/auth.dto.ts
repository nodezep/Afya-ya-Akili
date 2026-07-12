import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_MESSAGE =
  'Password must contain at least one lowercase letter, one uppercase letter and one digit';

export class RegisterDto {
  @ApiProperty({ example: 'amina@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Str0ngPass!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULES, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty({ example: 'Amina' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ example: 'Hassan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName!: string;

  @ApiPropertyOptional({ example: '+254712345678' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULES, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class RequestOtpDto {
  @ApiProperty({ enum: ['LOGIN', 'VERIFY_PHONE'] })
  @IsIn(['LOGIN', 'VERIFY_PHONE'])
  purpose!: 'LOGIN' | 'VERIFY_PHONE';

  @ApiProperty({ description: 'Email or phone number in E.164 format' })
  @IsString()
  @IsNotEmpty()
  target!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ enum: ['LOGIN', 'VERIFY_PHONE'] })
  @IsIn(['LOGIN', 'VERIFY_PHONE'])
  purpose!: 'LOGIN' | 'VERIFY_PHONE';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  target!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class OAuthLoginDto {
  @ApiProperty({
    description: 'Supabase access token obtained after Google/Apple sign-in on the client',
  })
  @IsString()
  @IsNotEmpty()
  supabaseAccessToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULES, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
