import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async audit(actorId: string, action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  // ---------------- Users ----------------

  async listUsers(dto: PaginationDto, filters: { search?: string; role?: Role }) {
    const where: Prisma.UserWhereInput = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.search
        ? {
            OR: [
              { email: { contains: filters.search, mode: 'insensitive' } },
              { profile: { firstName: { contains: filters.search, mode: 'insensitive' } } },
              { profile: { lastName: { contains: filters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isBanned: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          profile: { select: { firstName: true, lastName: true, country: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async setUserBan(actorId: string, userId: string, banned: boolean) {
    if (actorId === userId) throw new BadRequestException('You cannot ban yourself');
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin accounts cannot be banned');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: banned },
    });
    await this.audit(actorId, banned ? 'user.ban' : 'user.unban', 'User', userId);
    return { id: updated.id, isBanned: updated.isBanned };
  }

  /** Role changes are restricted to super admins (enforced at the controller). */
  async setUserRole(actorId: string, userId: string, role: Role) {
    if (actorId === userId) throw new BadRequestException('You cannot change your own role');
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    await this.audit(actorId, 'user.role_change', 'User', userId, { from: target.role, to: role });
    return { id: updated.id, role: updated.role };
  }

  // ---------------- Crisis queue ----------------

  async crisisQueue(dto: PaginationDto, unacknowledgedOnly = true) {
    const where = unacknowledgedOnly ? { acknowledgedAt: null } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.crisisEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              profile: { select: { firstName: true, lastName: true, emergencyContactName: true, emergencyContactPhone: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.crisisEvent.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async acknowledgeCrisis(actorId: string, crisisEventId: string) {
    const event = await this.prisma.crisisEvent.findUnique({ where: { id: crisisEventId } });
    if (!event) throw new NotFoundException('Crisis event not found');
    const updated = await this.prisma.crisisEvent.update({
      where: { id: crisisEventId },
      data: { acknowledgedBy: actorId, acknowledgedAt: new Date() },
    });
    await this.audit(actorId, 'crisis.acknowledge', 'CrisisEvent', crisisEventId);
    return updated;
  }

  // ---------------- Content moderation ----------------

  async listOrganizations(dto: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.organization.count(),
    ]);
    return paginate(items, total, dto);
  }

  async createOrganization(
    actorId: string,
    data: { name: string; slug: string; contactEmail: string; seats: number; industry?: string },
  ) {
    const organization = await this.prisma.organization.create({ data });
    await this.audit(actorId, 'organization.create', 'Organization', organization.id);
    return organization;
  }

  async auditLogs(dto: PaginationDto, action?: string) {
    const where = action ? { action: { contains: action } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async webhookEvents(dto: PaginationDto, provider?: string) {
    const where = provider ? { provider } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        select: { id: true, provider: true, eventType: true, externalId: true, processedAt: true, error: true, createdAt: true },
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);
    return paginate(items, total, dto);
  }
}
