import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  therapistId!: string;

  @ApiProperty({ example: '2026-07-15T10:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ enum: SessionType, default: SessionType.VIDEO })
  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notesClient?: string;
}

export class CancelAppointmentDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TherapistNotesDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  notes!: string;
}
