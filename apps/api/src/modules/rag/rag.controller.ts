import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RagService } from './rag.service';

class IngestDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

@ApiTags('knowledge-base')
@ApiBearerAuth()
@Controller('knowledge')
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get('documents')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List knowledge base documents (admin)' })
  list() {
    return this.rag.listDocuments();
  }

  @Post('documents')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ingest a document into the RAG knowledge base (admin)' })
  ingest(@Body() dto: IngestDocumentDto) {
    return this.rag.ingestDocument(dto);
  }

  @Post('documents/:id/reindex')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rebuild embeddings for a document (admin)' })
  reindex(@Param('id', ParseUUIDPipe) id: string) {
    return this.rag.indexDocument(id);
  }

  @Post('reindex-all')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rebuild embeddings for all documents (super admin)' })
  reindexAll() {
    return this.rag.reindexAll();
  }

  @Delete('documents/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a knowledge base document (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rag.deleteDocument(id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Semantic search over the knowledge base' })
  search(@Query('q') q: string) {
    return this.rag.retrieve(q ?? '', 6);
  }
}
