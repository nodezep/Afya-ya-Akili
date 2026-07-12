import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AssessmentType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AssessmentsService } from './assessments.service';

export class AnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  value!: number;
}

export class SubmitAssessmentDto {
  @ApiProperty({ enum: AssessmentType })
  @IsEnum(AssessmentType)
  type!: AssessmentType;

  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

@ApiTags('assessments')
@ApiBearerAuth()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Public()
  @Get('templates')
  @ApiOperation({ summary: 'List available assessments (PHQ-9, GAD-7, PSS-10, WHO-5...)' })
  templates() {
    return this.assessments.templates();
  }

  @Public()
  @Get('templates/:type')
  @ApiOperation({ summary: 'Get an assessment with its questions' })
  template(@Param('type') type: string) {
    return this.assessments.template(type.toUpperCase() as AssessmentType);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit answers and receive a scored, interpreted result' })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitAssessmentDto) {
    return this.assessments.submit(user.id, dto);
  }

  @Get('results')
  @ApiOperation({ summary: 'My assessment history' })
  results(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.assessments.results(user.id, pagination);
  }

  @Get('results/latest')
  @ApiOperation({ summary: 'Latest result per assessment type' })
  latest(@CurrentUser() user: AuthUser) {
    return this.assessments.latestPerType(user.id);
  }
}
