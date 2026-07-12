import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JournalService } from './journal.service';

export class CreateJournalEntryDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ maxLength: 20000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateJournalEntryDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

@ApiTags('journal')
@ApiBearerAuth()
@Controller('journal')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Post()
  @ApiOperation({ summary: 'Create a journal entry (sentiment analysed automatically)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJournalEntryDto) {
    return this.journal.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my journal entries' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.journal.list(user.id, pagination, { search, tag });
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Get reflective writing prompts' })
  prompts() {
    return this.journal.prompts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one journal entry' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.journal.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a journal entry' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journal.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a journal entry' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.journal.remove(user.id, id);
  }
}
