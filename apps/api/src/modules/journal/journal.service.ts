import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreateJournalEntryDto, UpdateJournalEntryDto } from './journal.controller';

const PROMPTS = [
  'What is one thing that went well today, however small?',
  'Describe a moment this week when you felt at peace. What made it possible?',
  'What is weighing on your mind right now? Write it out without judging it.',
  'Write a short letter to yourself from one year in the future.',
  'What are three things you are grateful for today, and why?',
  'What would you tell a close friend who was feeling the way you feel now?',
  'What drained your energy today, and what restored it?',
  'Describe a fear you are carrying. What is the kindest response you could give it?',
  'What boundaries do you need to protect your peace this week?',
  'What did you learn about yourself this week?',
];

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async create(userId: string, dto: CreateJournalEntryDto) {
    const sentimentScore = await this.ai
      .analyzeSentiment(`${dto.title}\n${dto.content}`)
      .catch(() => null);
    return this.prisma.journalEntry.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
        tags: dto.tags ?? [],
        sentimentScore,
      },
    });
  }

  async list(
    userId: string,
    dto: PaginationDto,
    filters: { search?: string; tag?: string },
  ) {
    const where: Prisma.JournalEntryWhereInput = {
      userId,
      ...(filters.tag ? { tags: { has: filters.tag } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { content: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  prompts() {
    // Rotate the highlighted prompt daily; return the full list for browsing
    const index = Math.floor(Date.now() / 86_400_000) % PROMPTS.length;
    return { promptOfTheDay: PROMPTS[index], all: PROMPTS };
  }

  async get(userId: string, id: string) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Journal entry not found');
    if (entry.userId !== userId) throw new ForbiddenException();
    return entry;
  }

  async update(userId: string, id: string, dto: UpdateJournalEntryDto) {
    await this.get(userId, id);
    const data: Prisma.JournalEntryUpdateInput = { ...dto };
    if (dto.content) {
      data.sentimentScore = await this.ai
        .analyzeSentiment(`${dto.title ?? ''}\n${dto.content}`)
        .catch(() => null);
    }
    return this.prisma.journalEntry.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.journalEntry.delete({ where: { id } });
    return { message: 'Journal entry deleted' };
  }
}
