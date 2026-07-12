import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const RESULTS_PER_TYPE = 5;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async global(userId: string, query: string) {
    const q = query.trim();
    if (q.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    const [therapists, meditations, courses, journalEntries, conversations] = await Promise.all([
      this.prisma.therapistProfile.findMany({
        where: {
          status: 'APPROVED',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { about: { contains: q, mode: 'insensitive' } },
            { specialties: { has: q.toLowerCase() } },
            { user: { profile: { OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ] } } },
          ],
        },
        take: RESULTS_PER_TYPE,
        select: {
          id: true,
          title: true,
          specialties: true,
          ratingAvg: true,
          user: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
      }),
      this.prisma.meditation.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: RESULTS_PER_TYPE,
        select: { id: true, title: true, category: true, durationSec: true, imageUrl: true },
      }),
      this.prisma.course.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: RESULTS_PER_TYPE,
        select: { id: true, title: true, slug: true, category: true, imageUrl: true },
      }),
      this.prisma.journalEntry.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: RESULTS_PER_TYPE,
        select: { id: true, title: true, createdAt: true },
      }),
      this.prisma.conversation.findMany({
        where: { userId, title: { contains: q, mode: 'insensitive' } },
        take: RESULTS_PER_TYPE,
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);

    return { query: q, therapists, meditations, courses, journalEntries, conversations };
  }
}
