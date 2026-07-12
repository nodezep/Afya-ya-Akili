import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMoodEntryDto } from './mood.controller';

@Injectable()
export class MoodService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMoodEntryDto) {
    return this.prisma.moodEntry.create({
      data: {
        userId,
        score: dto.score,
        emotions: dto.emotions ?? [],
        factors: dto.factors ?? [],
        note: dto.note,
      },
    });
  }

  async list(userId: string, dto: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.moodEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.moodEntry.count({ where: { userId } }),
    ]);
    return paginate(items, total, dto);
  }

  async stats(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);

    const daily = await this.prisma.$queryRaw<Array<{ day: Date; avg: number; count: bigint }>>(
      Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day, AVG("score") AS avg, COUNT(*) AS count
        FROM "mood_entries"
        WHERE "userId" = ${userId} AND "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `,
    );

    const entries = await this.prisma.moodEntry.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { score: true, emotions: true, factors: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const emotionCounts = new Map<string, number>();
    const factorCounts = new Map<string, number>();
    for (const entry of entries) {
      for (const e of entry.emotions) emotionCounts.set(e, (emotionCounts.get(e) ?? 0) + 1);
      for (const f of entry.factors) factorCounts.set(f, (factorCounts.get(f) ?? 0) + 1);
    }
    const top = (map: Map<string, number>) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    // Streak: consecutive days (ending today or yesterday) with at least one entry
    const daySet = new Set(entries.map((e) => e.createdAt.toISOString().slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    if (!daySet.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const average =
      entries.length > 0 ? entries.reduce((sum, e) => sum + e.score, 0) / entries.length : null;

    return {
      days,
      totalEntries: entries.length,
      averageScore: average,
      streakDays: streak,
      daily: daily.map((d) => ({ date: d.day, average: Number(d.avg), count: Number(d.count) })),
      topEmotions: top(emotionCounts),
      topFactors: top(factorCounts),
    };
  }

  async remove(userId: string, id: string) {
    const entry = await this.prisma.moodEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Mood entry not found');
    if (entry.userId !== userId) throw new ForbiddenException();
    await this.prisma.moodEntry.delete({ where: { id } });
    return { message: 'Mood entry deleted' };
  }
}
