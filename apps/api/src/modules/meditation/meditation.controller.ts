import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { MeditationService } from './meditation.service';

export class ProgressDto {
  @ApiProperty({ description: 'Seconds listened so far' })
  @IsInt()
  @Min(0)
  progressSec!: number;

  @ApiPropertyOptional({ description: 'Set when the session finished' })
  @IsOptional()
  completed?: boolean;
}

export class StartSessionDto {
  @ApiProperty()
  @IsUUID()
  meditationId!: string;
}

@ApiTags('meditation')
@ApiBearerAuth()
@Controller('meditations')
export class MeditationController {
  constructor(private readonly meditation: MeditationService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse the meditation library' })
  list(
    @Query() pagination: PaginationDto,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.meditation.list(pagination, { category, search });
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List meditation categories with counts' })
  categories() {
    return this.meditation.categories();
  }

  @Get('stats')
  @ApiOperation({ summary: 'My meditation stats (minutes, sessions, streak)' })
  stats(@CurrentUser() user: AuthUser) {
    return this.meditation.stats(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get one meditation' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.meditation.get(id);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Start a listening session' })
  startSession(@CurrentUser() user: AuthUser, @Body() dto: StartSessionDto) {
    return this.meditation.startSession(user.id, dto.meditationId);
  }

  @Post('sessions/:id/progress')
  @ApiOperation({ summary: 'Update session progress / mark complete' })
  updateProgress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProgressDto,
  ) {
    return this.meditation.updateProgress(user.id, id, dto);
  }
}
