import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TherapistStatus } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ApplyTherapistDto,
  ReviewTherapistDto,
  SetAvailabilityDto,
  UpdateTherapistProfileDto,
} from './dto/therapists.dto';

const PUBLIC_THERAPIST_SELECT = {
  id: true,
  title: true,
  yearsExperience: true,
  specialties: true,
  languages: true,
  education: true,
  about: true,
  hourlyRateCents: true,
  currency: true,
  acceptsInsurance: true,
  ratingAvg: true,
  ratingCount: true,
  user: {
    select: {
      profile: { select: { firstName: true, lastName: true, avatarUrl: true, city: true, country: true } },
    },
  },
} satisfies Prisma.TherapistProfileSelect;

@Injectable()
export class TherapistsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Marketplace (public) ----------------

  async list(
    dto: PaginationDto,
    filters: { specialty?: string; language?: string; maxRate?: number; search?: string },
  ) {
    const where: Prisma.TherapistProfileWhereInput = {
      status: TherapistStatus.APPROVED,
      user: { isActive: true, isBanned: false },
      ...(filters.specialty ? { specialties: { has: filters.specialty } } : {}),
      ...(filters.language ? { languages: { has: filters.language } } : {}),
      ...(filters.maxRate ? { hourlyRateCents: { lte: filters.maxRate } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { about: { contains: filters.search, mode: 'insensitive' } },
              { user: { profile: { OR: [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
              ] } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.therapistProfile.findMany({
        where,
        select: PUBLIC_THERAPIST_SELECT,
        orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.therapistProfile.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async get(id: string) {
    const therapist = await this.prisma.therapistProfile.findUnique({
      where: { id },
      select: {
        ...PUBLIC_THERAPIST_SELECT,
        status: true,
        availability: { where: { isActive: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            rating: true,
            comment: true,
            createdAt: true,
            author: { select: { profile: { select: { firstName: true } } } },
          },
        },
      },
    });
    if (!therapist || therapist.status !== TherapistStatus.APPROVED) {
      throw new NotFoundException('Therapist not found');
    }
    return therapist;
  }

  async specialties() {
    const therapists = await this.prisma.therapistProfile.findMany({
      where: { status: TherapistStatus.APPROVED },
      select: { specialties: true },
    });
    const counts = new Map<string, number>();
    for (const t of therapists) {
      for (const s of t.specialties) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }

  // ---------------- Application & self-management ----------------

  async apply(userId: string, dto: ApplyTherapistDto) {
    const existing = await this.prisma.therapistProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('You already have a therapist application');
    return this.prisma.therapistProfile.create({
      data: {
        userId,
        ...dto,
        languages: dto.languages ?? ['en'],
        status: TherapistStatus.PENDING_REVIEW,
      },
    });
  }

  private async getOwnProfile(userId: string) {
    const profile = await this.prisma.therapistProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('You do not have a therapist profile');
    return profile;
  }

  async myProfile(userId: string) {
    const profile = await this.getOwnProfile(userId);
    const availability = await this.prisma.availabilitySlot.findMany({
      where: { therapistId: profile.id, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return { ...profile, availability };
  }

  async updateOwnProfile(userId: string, dto: UpdateTherapistProfileDto) {
    const profile = await this.getOwnProfile(userId);
    return this.prisma.therapistProfile.update({ where: { id: profile.id }, data: dto });
  }

  async setAvailability(userId: string, dto: SetAvailabilityDto) {
    const profile = await this.getOwnProfile(userId);
    for (const slot of dto.slots) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException('startTime must be before endTime');
      }
    }
    await this.prisma.$transaction([
      this.prisma.availabilitySlot.deleteMany({ where: { therapistId: profile.id } }),
      this.prisma.availabilitySlot.createMany({
        data: dto.slots.map((s) => ({ therapistId: profile.id, ...s })),
      }),
    ]);
    return this.prisma.availabilitySlot.findMany({
      where: { therapistId: profile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ---------------- Reviews ----------------

  async review(authorId: string, therapistId: string, dto: ReviewTherapistDto) {
    const therapist = await this.prisma.therapistProfile.findUnique({ where: { id: therapistId } });
    if (!therapist || therapist.status !== TherapistStatus.APPROVED) {
      throw new NotFoundException('Therapist not found');
    }
    if (therapist.userId === authorId) {
      throw new ForbiddenException('You cannot review yourself');
    }
    const completedSession = await this.prisma.appointment.findFirst({
      where: { clientId: authorId, therapistId, status: 'COMPLETED' },
    });
    if (!completedSession) {
      throw new ForbiddenException('You can only review therapists after a completed session');
    }

    const review = await this.prisma.therapistReview.upsert({
      where: { therapistId_authorId: { therapistId, authorId } },
      update: { rating: dto.rating, comment: dto.comment },
      create: { therapistId, authorId, rating: dto.rating, comment: dto.comment },
    });

    const aggregate = await this.prisma.therapistReview.aggregate({
      where: { therapistId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.therapistProfile.update({
      where: { id: therapistId },
      data: {
        ratingAvg: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count._all,
      },
    });
    return review;
  }

  // ---------------- Admin moderation ----------------

  async listApplications(dto: PaginationDto) {
    const where = { status: TherapistStatus.PENDING_REVIEW };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.therapistProfile.findMany({
        where,
        include: { user: { select: { email: true, profile: true } } },
        orderBy: { createdAt: 'asc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.therapistProfile.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async moderate(therapistId: string, approve: boolean, adminId: string) {
    const profile = await this.prisma.therapistProfile.findUnique({ where: { id: therapistId } });
    if (!profile) throw new NotFoundException('Application not found');

    const status = approve ? TherapistStatus.APPROVED : TherapistStatus.REJECTED;
    const [updated] = await this.prisma.$transaction([
      this.prisma.therapistProfile.update({ where: { id: therapistId }, data: { status } }),
      ...(approve
        ? [this.prisma.user.update({ where: { id: profile.userId }, data: { role: Role.THERAPIST } })]
        : []),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: approve ? 'therapist.approve' : 'therapist.reject',
          targetType: 'TherapistProfile',
          targetId: therapistId,
        },
      }),
    ]);
    return updated;
  }
}
