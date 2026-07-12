import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RagService } from './rag.service';

describe('RagService.chunkText', () => {
  let service: RagService;

  beforeEach(() => {
    const ai = new AiService(new ConfigService({}));
    service = new RagService({} as PrismaService, ai);
  });

  it('returns a single chunk for short text', () => {
    const chunks = service.chunkText('Short text.');
    expect(chunks).toEqual(['Short text.']);
  });

  it('returns empty array for empty text', () => {
    expect(service.chunkText('   ')).toEqual([]);
  });

  it('splits long text into overlapping chunks', () => {
    const sentence = 'This is a sentence about mental health and wellbeing practices. ';
    const text = sentence.repeat(40); // ~2600 chars
    const chunks = service.chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(800);
    }
    // Overlap: consecutive chunks share content
    const tail = chunks[0].slice(-50);
    expect(chunks[1]).toContain(tail.split(' ').slice(1).join(' ').slice(0, 20));
  });

  it('normalises whitespace', () => {
    const chunks = service.chunkText('hello\n\n   world');
    expect(chunks).toEqual(['hello world']);
  });
});
