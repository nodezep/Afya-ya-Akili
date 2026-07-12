import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, NotificationChannel, Prisma, TherapistStatus } from '@prisma/client';
import { MailService } from '../../mail/mail.service';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VideoService } from '../video/video.service';
import { CreateAppointmentDto } from './dto/appointments.dto';

const SESSION_MINUTES = 60;
const CANCELLATION_WINDOW_HOURS = 24;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly video: VideoService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------
  // Booking
  // ------------------------------------------------------------

  /** Available start times (hourly grid) for a therapist on a given day. */
  async availableSlots(therapistId: string, dateIso: string) {
    const therapist = await this.prisma.therapistProfile.findUnique({
      where: { id: therapistId },
      include: { availability: { where: { isActive: true } } },
    });
    if (!therapist || therapist.status !== TherapistStatus.APPROVED) {
      throw new NotFoundException('Therapist not found');
    }

    const day = new Date(`${dateIso}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime())) throw new BadRequestException('Invalid date');
    const dayOfWeek = day.getUTCDay();

    const windows = therapist.availability.filter((s) => s.dayOfWeek === dayOfWeek);
    if (windows.length === 0) {
      return { date: dateIso, durationMinutes: SESSION_MINUTES, slots: [] as string[] };
    }

    const dayStart = new Date(day);
    const dayEnd = new Date(day.getTime() + 86_400_000);
    const booked = await this.prisma.appointment.findMany({
      where: {
        therapistId,
        startsAt: { gte: dayStart, lt: dayEnd },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: string[] = [];
    for (const window of windows) {
      const [startH, startM] = window.startTime.split(':').map(Number);
      const [endH, endM] = window.endTime.split(':').map(Number);
      const cursor = new Date(day);
      cursor.setUTCHours(startH, startM, 0, 0);
      const windowEnd = new Date(day);
      windowEnd.setUTCHours(endH, endM, 0, 0);

      while (cursor.getTime() + SESSION_MINUTES * 60_000 <= windowEnd.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor.getTime() + SESSION_MINUTES * 60_000);
        const overlaps = booked.some((b) => slotStart < b.endsAt && slotEnd > b.startsAt);
        if (!overlaps && slotStart > new Date()) {
          slots.push(slotStart.toISOString());
        }
        cursor.setUTCMinutes(cursor.getUTCMinutes() + SESSION_MINUTES);
      }
    }
    return { date: dateIso, durationMinutes: SESSION_MINUTES, slots };
  }

  async book(clientId: string, dto: CreateAppointmentDto) {
    const therapist = await this.prisma.therapistProfile.findUnique({
      where: { id: dto.therapistId },
      include: { user: { include: { profile: true } } },
    });
    if (!therapist || therapist.status !== TherapistStatus.APPROVED) {
      throw new NotFoundException('Therapist not found');
    }
    if (therapist.userId === clientId) {
      throw new BadRequestException('You cannot book a session with yourself');
    }

    const startsAt = new Date(dto.startsAt);
    if (startsAt <= new Date()) throw new BadRequestException('Start time must be in the future');
    const endsAt = new Date(startsAt.getTime() + SESSION_MINUTES * 60_000);

    // Verify the slot is inside the therapist's availability
    const dateIso = startsAt.toISOString().slice(0, 10);
    const { slots } = await this.availableSlots(dto.therapistId, dateIso);
    if (!slots.includes(startsAt.toISOString())) {
      throw new ConflictException('This time slot is not available');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        clientId,
        therapistId: dto.therapistId,
        startsAt,
        endsAt,
        sessionType: dto.sessionType ?? 'VIDEO',
        priceCents: therapist.hourlyRateCents,
        currency: therapist.currency,
        notesClient: dto.notesClient,
        status: AppointmentStatus.PENDING,
      },
    });

    await this.notifications.create(therapist.userId, {
      type: 'APPOINTMENT',
      title: 'New booking request',
      body: `You have a new session request for ${startsAt.toUTCString()}.`,
      data: { appointmentId: appointment.id },
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
    });

    return appointment;
  }

  // ------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------

  async confirm(userId: string, appointmentId: string) {
    const appointment = await this.getWithParties(appointmentId);
    if (appointment.therapist.userId !== userId) {
      throw new ForbiddenException('Only the therapist can confirm a booking');
    }
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(`Cannot confirm a ${appointment.status} appointment`);
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CONFIRMED },
    });

    if (appointment.sessionType === 'VIDEO') {
      await this.video.createRoomForAppointment(appointmentId, appointment.endsAt);
    }

    const therapistName = `${appointment.therapist.user.profile?.firstName ?? ''} ${appointment.therapist.user.profile?.lastName ?? ''}`.trim();
    await this.notifications.create(appointment.clientId, {
      type: 'APPOINTMENT',
      title: 'Session confirmed',
      body: `Your session on ${appointment.startsAt.toUTCString()} was confirmed.`,
      data: { appointmentId },
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
    });
    await this.mail.sendAppointmentConfirmation(appointment.client.email, {
      therapistName: therapistName || 'your therapist',
      startsAt: appointment.startsAt,
    });

    return updated;
  }

  async cancel(userId: string, appointmentId: string, reason?: string) {
    const appointment = await this.getWithParties(appointmentId);
    const isClient = appointment.clientId === userId;
    const isTherapist = appointment.therapist.userId === userId;
    if (!isClient && !isTherapist) throw new ForbiddenException();

    if (
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel a ${appointment.status} appointment`);
    }
    if (
      isClient &&
      appointment.startsAt.getTime() - Date.now() < CANCELLATION_WINDOW_HOURS * 3_600_000 &&
      appointment.status === AppointmentStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Confirmed sessions must be cancelled at least ${CANCELLATION_WINDOW_HOURS} hours in advance`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
    });

    const counterpartyId = isClient ? appointment.therapist.userId : appointment.clientId;
    await this.notifications.create(counterpartyId, {
      type: 'APPOINTMENT',
      title: 'Session cancelled',
      body: `The session on ${appointment.startsAt.toUTCString()} was cancelled.`,
      data: { appointmentId },
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
    });
    return updated;
  }

  async complete(userId: string, appointmentId: string) {
    const appointment = await this.getWithParties(appointmentId);
    if (appointment.therapist.userId !== userId) {
      throw new ForbiddenException('Only the therapist can complete a session');
    }
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)) {
      throw new BadRequestException(`Cannot complete a ${appointment.status} appointment`);
    }
    await this.video.markEnded(appointmentId);
    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED },
    });
  }

  async addTherapistNotes(userId: string, appointmentId: string, notes: string) {
    const appointment = await this.getWithParties(appointmentId);
    if (appointment.therapist.userId !== userId) throw new ForbiddenException();
    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { notesTherapist: notes },
    });
  }

  // ------------------------------------------------------------
  // Listing
  // ------------------------------------------------------------

  async listForClient(clientId: string, dto: PaginationDto, upcoming?: boolean) {
    const where: Prisma.AppointmentWhereInput = {
      clientId,
      ...(upcoming === true ? { startsAt: { gte: new Date() }, status: { notIn: ['CANCELLED'] } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        orderBy: { startsAt: upcoming ? 'asc' : 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: {
          therapist: {
            select: {
              id: true,
              title: true,
              user: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            },
          },
          videoRoom: { select: { roomUrl: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async listForTherapist(userId: string, dto: PaginationDto, upcoming?: boolean) {
    const therapist = await this.prisma.therapistProfile.findUnique({ where: { userId } });
    if (!therapist) throw new NotFoundException('You do not have a therapist profile');

    const where: Prisma.AppointmentWhereInput = {
      therapistId: therapist.id,
      ...(upcoming === true ? { startsAt: { gte: new Date() }, status: { notIn: ['CANCELLED'] } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        orderBy: { startsAt: upcoming ? 'asc' : 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: {
          client: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          videoRoom: { select: { roomUrl: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async get(userId: string, appointmentId: string) {
    const appointment = await this.getWithParties(appointmentId);
    if (appointment.clientId !== userId && appointment.therapist.userId !== userId) {
      throw new ForbiddenException();
    }
    return appointment;
  }

  private async getWithParties(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: { select: { id: true, email: true, profile: true } },
        therapist: { include: { user: { select: { id: true, email: true, profile: true } } } },
        videoRoom: true,
        payment: true,
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }
}
