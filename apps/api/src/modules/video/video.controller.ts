import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoService } from './video.service';

@ApiTags('video')
@ApiBearerAuth()
@Controller('video')
export class VideoController {
  constructor(
    private readonly video: VideoService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('appointments/:id/join')
  @ApiOperation({ summary: 'Get the room URL and access token to join a session' })
  async join(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        videoRoom: true,
        therapist: { select: { userId: true } },
        client: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const isClient = appointment.clientId === user.id;
    const isTherapist = appointment.therapist.userId === user.id;
    if (!isClient && !isTherapist) throw new ForbiddenException();

    if (!['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)) {
      throw new ForbiddenException('This session is not joinable in its current state');
    }

    let room = appointment.videoRoom;
    if (!room) {
      room = await this.video.createRoomForAppointment(appointment.id, appointment.endsAt);
    }

    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });
    const displayName = profile ? `${profile.firstName} ${profile.lastName}` : 'AKILI member';
    const token = await this.video.createMeetingToken(room.roomName, displayName, isTherapist);

    if (appointment.status === 'CONFIRMED') {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'IN_PROGRESS' },
      });
      await this.video.markStarted(appointment.id);
    }

    return { roomUrl: room.roomUrl, roomName: room.roomName, token };
  }
}
