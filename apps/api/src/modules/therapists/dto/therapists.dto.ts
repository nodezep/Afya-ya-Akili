import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ApplyTherapistDto {
  @ApiProperty({ example: 'Clinical Psychologist' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  licenseNumber!: string;

  @ApiProperty({ example: 'Kenya Counselling and Psychological Association' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  licenseBody!: string;

  @ApiProperty({ minimum: 0, maximum: 60 })
  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience!: number;

  @ApiProperty({ type: [String], example: ['anxiety', 'depression'] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  specialties!: string[];

  @ApiPropertyOptional({ type: [String], example: ['en', 'sw'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  education?: string;

  @ApiProperty({ description: 'Hourly rate in cents', example: 350000 })
  @IsInt()
  @Min(0)
  hourlyRateCents!: number;
}

export class UpdateTherapistProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  education?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyRateCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptsInsurance?: boolean;
}

export class AvailabilitySlotDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Sunday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;
}

export class SetAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots!: AvailabilitySlotDto[];
}

export class ReviewTherapistDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
