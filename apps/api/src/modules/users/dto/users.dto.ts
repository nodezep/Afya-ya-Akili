import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'])
  gender?: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  emergencyContactPhone?: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: 'sw' })
  @IsOptional()
  @IsIn(['en', 'sw', 'fr'])
  locale?: string;

  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiPropertyOptional({ example: '20:30', description: 'HH:mm, user-local time' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  moodReminderTime?: string;

  @ApiPropertyOptional({ example: '21:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  journalReminderTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dataSharingOptIn?: boolean;
}

export class RegisterDeviceDto {
  @ApiPropertyOptional({ example: 'ExponentPushToken[xxxxxxxxxxxx]' })
  @IsString()
  expoPushToken!: string;

  @ApiPropertyOptional({ enum: ['ios', 'android', 'web'] })
  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}
