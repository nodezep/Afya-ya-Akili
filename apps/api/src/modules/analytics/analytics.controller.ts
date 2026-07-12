import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

export class TrackEventDto {
  @ApiProperty({ example: 'mood.logged' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['web', 'ios', 'android'] })
  @IsOptional()
  @IsIn(['web', 'ios', 'android'])
  platform?: string;
}

export class TrackBatchDto {
  @ApiProperty({ type: [TrackEventDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events!: TrackEventDto[];
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  @ApiOperation({ summary: 'Track client events (batched)' })
  track(@CurrentUser() user: AuthUser, @Body() dto: TrackBatchDto) {
    return this.analytics.track(user.id, dto.events);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'My personal wellbeing dashboard data' })
  dashboard(@CurrentUser() user: AuthUser) {
    return this.analytics.myDashboard(user.id);
  }

  @Get('platform')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide metrics (admin)' })
  platform(@Query('days') days?: number) {
    return this.analytics.platformOverview(days ? Number(days) : 30);
  }
}
