import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface RetrievedChunk {
  id: string;
  content: string;
  documentTitle: string;
  similarity: number;
}

const CHUNK_SIZE = 800; // characters
const CHUNK_OVERLAP = 150;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Split text into overlapping chunks at sentence-ish boundaries. */
  chunkText(text: string): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= CHUNK_SIZE) return clean ? [clean] : [];
    const chunks: string[] = [];
    let start = 0;
    while (start < clean.length) {
      let end = Math.min(start + CHUNK_SIZE, clean.length);
      if (end < clean.length) {
        const lastPeriod = clean.lastIndexOf('. ', end);
        if (lastPeriod > start + CHUNK_SIZE / 2) end = lastPeriod + 1;
      }
      chunks.push(clean.slice(start, end).trim());
      if (end >= clean.length) break;
      start = end - CHUNK_OVERLAP;
    }
    return chunks;
  }

  async ingestDocument(input: {
    title: string;
    content: string;
    category?: string;
    source?: string;
    locale?: string;
  }) {
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        title: input.title,
        content: input.content,
        category: input.category ?? 'general',
        source: input.source ?? 'api',
        locale: input.locale ?? 'en',
      },
    });
    await this.indexDocument(document.id);
    return document;
  }

  /** (Re)builds embeddings for a document's chunks. */
  async indexDocument(documentId: string): Promise<{ chunks: number }> {
    const document = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document not found');

    const chunks = this.chunkText(document.content);
    await this.prisma.documentChunk.deleteMany({ where: { documentId } });

    if (!this.ai.isConfigured) {
      // Store chunks without embeddings; searchable once AI is configured and reindexed.
      for (let i = 0; i < chunks.length; i++) {
        await this.prisma.documentChunk.create({
          data: { documentId, chunkIndex: i, content: chunks[i] },
        });
      }
      this.logger.warn(`Indexed ${chunks.length} chunks WITHOUT embeddings (AI not configured)`);
      return { chunks: chunks.length };
    }

    const embeddings = await this.ai.embed(chunks);
    for (let i = 0; i < chunks.length; i++) {
      const vector = `[${embeddings[i].join(',')}]`;
      await this.prisma.$executeRaw`
        INSERT INTO "document_chunks" ("id", "documentId", "chunkIndex", "content", "embedding")
        VALUES (gen_random_uuid(), ${documentId}, ${i}, ${chunks[i]}, ${vector}::vector)
      `;
    }
    return { chunks: chunks.length };
  }

  /** Reindex all documents that are missing embeddings (used by seed/admin). */
  async reindexAll(): Promise<{ documents: number }> {
    const docs = await this.prisma.knowledgeDocument.findMany({ select: { id: true } });
    for (const doc of docs) {
      await this.indexDocument(doc.id);
    }
    return { documents: docs.length };
  }

  /** Vector similarity search over the knowledge base. */
  async retrieve(query: string, topK = 4): Promise<RetrievedChunk[]> {
    if (!this.ai.isConfigured) return [];
    try {
      const [queryEmbedding] = await this.ai.embed([query]);
      const vector = `[${queryEmbedding.join(',')}]`;
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; content: string; title: string; similarity: number }>
      >(Prisma.sql`
        SELECT c."id", c."content", d."title", 1 - (c."embedding" <=> ${vector}::vector) AS "similarity"
        FROM "document_chunks" c
        JOIN "knowledge_documents" d ON d."id" = c."documentId"
        WHERE c."embedding" IS NOT NULL
        ORDER BY c."embedding" <=> ${vector}::vector
        LIMIT ${topK}
      `);
      return rows
        .filter((r) => r.similarity > 0.3)
        .map((r) => ({
          id: r.id,
          content: r.content,
          documentTitle: r.title,
          similarity: Number(r.similarity),
        }));
    } catch (err) {
      this.logger.error(`RAG retrieval failed: ${(err as Error).message}`);
      return [];
    }
  }

  async listDocuments() {
    return this.prisma.knowledgeDocument.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        source: true,
        locale: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteDocument(id: string) {
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    return { message: 'Document deleted' };
  }
}
