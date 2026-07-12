import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MoodService } from './mood.service';

export class CreateMoodEntryDto {
  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  score!: number;

  @ApiPropertyOptional({ type: [String], example: ['calm', 'hopeful'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  emotions?: string[];

  @ApiPropertyOptional({ type: [String], example: ['work', 'sleep'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  factors?: string[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags('mood')
@ApiBearerAuth()
@Controller('mood')
export class MoodController {
  constructor(private readonly mood: MoodService) {}

  @Post()
  @ApiOperation({ summary: 'Log a mood check-in' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMoodEntryDto) {
    return this.mood.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my mood entries' })
  list(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.mood.list(user.id, pagination);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Mood trends: daily averages, streak, top emotions' })
  stats(@CurrentUser() user: AuthUser, @Query('days') days?: number) {
    return this.mood.stats(user.id, days ? Number(days) : 30);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a mood entry' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.mood.remove(user.id, id);
  }
}
