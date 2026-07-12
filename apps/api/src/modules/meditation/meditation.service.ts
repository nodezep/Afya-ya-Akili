import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgressDto } from './meditation.controller';

@Injectable()
export class MeditationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: PaginationDto, filters: { category?: string; search?: string }) {
    const where: Prisma.MeditationWhereInput = {
      status: 'PUBLISHED',
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.meditation.findMany({
        where,
        orderBy: { playCount: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.meditation.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async categories() {
    const groups = await this.prisma.meditation.groupBy({
      by: ['category'],
      where: { status: 'PUBLISHED' },
      _count: { _all: true },
    });
    return groups.map((g) => ({ category: g.category, count: g._count._all }));
  }

  async get(id: string) {
    const meditation = await this.prisma.meditation.findUnique({ where: { id } });
    if (!meditation || meditation.status !== 'PUBLISHED') {
      throw new NotFoundException('Meditation not found');
    }
    return meditation;
  }

  async startSession(userId: string, meditationId: string) {
    await this.get(meditationId);
    const [session] = await this.prisma.$transaction([
      this.prisma.meditationSession.create({ data: { userId, meditationId } }),
      this.prisma.meditation.update({
        where: { id: meditationId },
        data: { playCount: { increment: 1 } },
      }),
    ]);
    return session;
  }

  async updateProgress(userId: string, sessionId: string, dto: ProgressDto) {
    const session = await this.prisma.meditationSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException();
    return this.prisma.meditationSession.update({
      where: { id: sessionId },
      data: {
        progressSec: dto.progressSec,
        ...(dto.completed ? { completedAt: new Date() } : {}),
      },
    });
  }

  async stats(userId: string) {
    const sessions = await this.prisma.meditationSession.findMany({
      where: { userId },
      select: { progressSec: true, completedAt: true, startedAt: true },
    });
    const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.progressSec, 0) / 60);
    const completed = sessions.filter((s) => s.completedAt).length;

    const daySet = new Set(sessions.map((s) => s.startedAt.toISOString().slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    if (!daySet.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return { totalSessions: sessions.length, completedSessions: completed, totalMinutes, streakDays: streak };
  }
}
