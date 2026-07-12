import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppointmentsService } from './appointments.service';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  TherapistNotesDto,
} from './dto/appointments.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Public()
  @Get('availability/:therapistId')
  @ApiOperation({ summary: 'Available slots for a therapist on a date (YYYY-MM-DD)' })
  availability(
    @Param('therapistId', ParseUUIDPipe) therapistId: string,
    @Query('date') date: string,
  ) {
    return this.appointments.availableSlots(therapistId, date);
  }

  @Post()
  @ApiOperation({ summary: 'Book a session with a therapist' })
  book(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointments.book(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'My appointments as a client' })
  myAppointments(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.appointments.listForClient(user.id, pagination, upcoming === 'true');
  }

  @Get('therapist')
  @Roles(Role.THERAPIST)
  @ApiOperation({ summary: 'My appointments as a therapist' })
  therapistAppointments(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.appointments.listForTherapist(user.id, pagination, upcoming === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one appointment (participant only)' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.get(user.id, id);
  }

  @Post(':id/confirm')
  @Roles(Role.THERAPIST)
  @ApiOperation({ summary: 'Confirm a booking (therapist)' })
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.confirm(user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an appointment (either party)' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointments.cancel(user.id, id, dto.reason);
  }

  @Post(':id/complete')
  @Roles(Role.THERAPIST)
  @ApiOperation({ summary: 'Mark a session complete (therapist)' })
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.complete(user.id, id);
  }

  @Put(':id/notes')
  @Roles(Role.THERAPIST)
  @ApiOperation({ summary: 'Save private session notes (therapist)' })
  notes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TherapistNotesDto,
  ) {
    return this.appointments.addTherapistNotes(user.id, id, dto.notes);
  }
}
