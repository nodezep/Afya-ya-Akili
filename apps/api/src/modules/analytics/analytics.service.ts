import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(
    userId: string | null,
    events: Array<{ name: string; properties?: Record<string, unknown>; platform?: string }>,
  ) {
    await this.prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        userId,
        name: e.name.slice(0, 100),
        properties: (e.properties ?? undefined) as Prisma.InputJsonValue | undefined,
        platform: e.platform ?? 'web',
      })),
    });
    return { tracked: events.length };
  }

  /** Personal wellbeing dashboard: one call powering the user dashboard. */
  async myDashboard(userId: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [moodAgg, moodLatest, journalCount, meditationAgg, conversationCount, upcoming, assessmentsDue] =
      await Promise.all([
        this.prisma.moodEntry.aggregate({
          where: { userId, createdAt: { gte: since } },
          _avg: { score: true },
          _count: { _all: true },
        }),
        this.prisma.moodEntry.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.journalEntry.count({ where: { userId, createdAt: { gte: since } } }),
        this.prisma.meditationSession.aggregate({
          where: { userId, startedAt: { gte: since } },
          _sum: { progressSec: true },
          _count: { _all: true },
        }),
        this.prisma.conversation.count({ where: { userId } }),
        this.prisma.appointment.findFirst({
          where: { clientId: userId, startsAt: { gte: new Date() }, status: { in: ['PENDING', 'CONFIRMED'] } },
          orderBy: { startsAt: 'asc' },
          include: {
            therapist: {
              select: {
                title: true,
                user: { select: { profile: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        }),
        this.prisma.assessmentResult.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { template: { select: { type: true, name: true } } },
        }),
      ]);

    return {
      period: { days: 30, since },
      mood: {
        average: moodAgg._avg.score,
        checkIns: moodAgg._count._all,
        latest: moodLatest,
      },
      journalEntries: journalCount,
      meditation: {
        sessions: meditationAgg._count._all,
        minutes: Math.round((meditationAgg._sum.progressSec ?? 0) / 60),
      },
      conversations: conversationCount,
      nextAppointment: upcoming,
      recentAssessments: assessmentsDue,
    };
  }

  /** Platform-wide metrics for the admin dashboard. */
  async platformOverview(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [totalUsers, newUsers, activeRows, therapists, appointments, revenueAgg, crisisOpen, signupTrend] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(DISTINCT "userId") AS count FROM "analytics_events"
          WHERE "createdAt" >= ${since} AND "userId" IS NOT NULL
        `),
        this.prisma.therapistProfile.count({ where: { status: 'APPROVED' } }),
        this.prisma.appointment.count({ where: { createdAt: { gte: since } } }),
        this.prisma.payment.aggregate({
          where: { status: 'SUCCEEDED', createdAt: { gte: since } },
          _sum: { amountCents: true },
          _count: { _all: true },
        }),
        this.prisma.crisisEvent.count({ where: { acknowledgedAt: null } }),
        this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(Prisma.sql`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
          FROM "users" WHERE "createdAt" >= ${since}
          GROUP BY 1 ORDER BY 1
        `),
      ]);

    return {
      periodDays: days,
      users: {
        total: totalUsers,
        new: newUsers,
        active: Number(activeRows[0]?.count ?? 0),
        signupTrend: signupTrend.map((r) => ({ date: r.day, count: Number(r.count) })),
      },
      therapists: { approved: therapists },
      appointments: { created: appointments },
      revenue: {
        totalCents: revenueAgg._sum.amountCents ?? 0,
        payments: revenueAgg._count._all,
      },
      crisis: { unacknowledged: crisisOpen },
    };
  }
}
