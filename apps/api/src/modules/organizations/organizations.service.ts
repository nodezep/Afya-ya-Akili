import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationChannel, OrgMemberStatus, Prisma } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireOrgAdmin(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership || membership.status !== OrgMemberStatus.ACTIVE || !membership.isAdmin) {
      throw new ForbiddenException('Organization admin access required');
    }
    return membership;
  }

  async myOrganizations(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId, status: OrgMemberStatus.ACTIVE },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true, seats: true, industry: true },
        },
      },
    });
  }

  async get(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { organization: { include: { _count: { select: { members: true } } } } },
    });
    if (!membership || membership.status !== OrgMemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return { ...membership.organization, isAdmin: membership.isAdmin };
  }

  async members(userId: string, organizationId: string, dto: PaginationDto) {
    await this.requireOrgAdmin(userId, organizationId);
    const where = { organizationId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organizationMember.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              lastLoginAt: true,
              profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.organizationMember.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async inviteMember(userId: string, organizationId: string, email: string) {
    await this.requireOrgAdmin(userId, organizationId);
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { _count: { select: { members: { where: { status: { not: 'REMOVED' } } } } } },
    });
    if (organization._count.members >= organization.seats) {
      throw new BadRequestException('All seats are in use. Increase your seat count to invite more members.');
    }

    const invitee = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!invitee) {
      throw new NotFoundException(
        'No AKILI account exists for this email. Ask them to sign up first.',
      );
    }

    const membership = await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId: invitee.id } },
      update: { status: OrgMemberStatus.INVITED, invitedEmail: email.toLowerCase() },
      create: {
        organizationId,
        userId: invitee.id,
        status: OrgMemberStatus.INVITED,
        invitedEmail: email.toLowerCase(),
      },
    });

    await this.notifications.create(invitee.id, {
      type: 'ORGANIZATION',
      title: `You're invited to join ${organization.name}`,
      body: 'Accept the invitation from your AKILI dashboard to access your workplace wellbeing benefits.',
      data: { organizationId },
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
    });
    return membership;
  }

  async respondToInvite(userId: string, organizationId: string, accept: boolean) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership || membership.status !== OrgMemberStatus.INVITED) {
      throw new NotFoundException('No pending invitation for this organization');
    }
    if (!accept) {
      await this.prisma.organizationMember.delete({ where: { id: membership.id } });
      return { message: 'Invitation declined' };
    }
    return this.prisma.organizationMember.update({
      where: { id: membership.id },
      data: { status: OrgMemberStatus.ACTIVE, joinedAt: new Date() },
    });
  }

  async removeMember(userId: string, organizationId: string, memberId: string) {
    await this.requireOrgAdmin(userId, organizationId);
    const membership = await this.prisma.organizationMember.findUnique({ where: { id: memberId } });
    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundException('Member not found');
    }
    if (membership.userId === userId) {
      throw new BadRequestException('You cannot remove yourself');
    }
    await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { status: OrgMemberStatus.REMOVED },
    });
    return { message: 'Member removed' };
  }

  /**
   * Anonymised wellbeing insights for the corporate dashboard.
   * Aggregates are only revealed when at least 5 active members exist,
   * protecting individual privacy.
   */
  async insights(userId: string, organizationId: string, days = 30) {
    await this.requireOrgAdmin(userId, organizationId);
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: OrgMemberStatus.ACTIVE },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    const MIN_COHORT = 5;
    if (memberIds.length < MIN_COHORT) {
      return {
        memberCount: memberIds.length,
        minimumCohort: MIN_COHORT,
        message: `Insights unlock when your organization has at least ${MIN_COHORT} active members.`,
      };
    }

    const since = new Date(Date.now() - days * 86_400_000);

    const [moodAgg, moodTrend, activeUserRows, assessmentAgg] = await Promise.all([
      this.prisma.moodEntry.aggregate({
        where: { userId: { in: memberIds }, createdAt: { gte: since } },
        _avg: { score: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ week: Date; avg: number }>>(Prisma.sql`
        SELECT date_trunc('week', "createdAt") AS week, AVG("score") AS avg
        FROM "mood_entries"
        WHERE "userId" = ANY(${memberIds}) AND "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT "userId") AS count
        FROM "analytics_events"
        WHERE "userId" = ANY(${memberIds}) AND "createdAt" >= ${since}
      `),
      this.prisma.$queryRaw<Array<{ severity: string; count: bigint }>>(Prisma.sql`
        SELECT r."severity", COUNT(*) AS count
        FROM "assessment_results" r
        WHERE r."userId" = ANY(${memberIds}) AND r."createdAt" >= ${since}
        GROUP BY 1
      `),
    ]);

    return {
      memberCount: memberIds.length,
      periodDays: days,
      engagement: {
        activeMembers: Number(activeUserRows[0]?.count ?? 0),
        moodCheckIns: moodAgg._count._all,
      },
      wellbeing: {
        averageMood: moodAgg._avg.score,
        weeklyMoodTrend: moodTrend.map((r) => ({ week: r.week, average: Number(r.avg) })),
        assessmentSeverityMix: assessmentAgg.map((r) => ({
          severity: r.severity,
          count: Number(r.count),
        })),
      },
    };
  }
}
