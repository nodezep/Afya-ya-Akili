import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  ApplyTherapistDto,
  ReviewTherapistDto,
  SetAvailabilityDto,
  UpdateTherapistProfileDto,
} from './dto/therapists.dto';
import { TherapistsService } from './therapists.service';

@ApiTags('therapists')
@ApiBearerAuth()
@Controller('therapists')
export class TherapistsController {
  constructor(private readonly therapists: TherapistsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse the therapist marketplace' })
  list(
    @Query() pagination: PaginationDto,
    @Query('specialty') specialty?: string,
    @Query('language') language?: string,
    @Query('maxRate') maxRate?: number,
    @Query('search') search?: string,
  ) {
    return this.therapists.list(pagination, {
      specialty,
      language,
      maxRate: maxRate ? Number(maxRate) : undefined,
      search,
    });
  }

  @Public()
  @Get('specialties')
  @ApiOperation({ summary: 'List specialties with therapist counts' })
  specialties() {
    return this.therapists.specialties();
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply to join AKILI as a therapist' })
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyTherapistDto) {
    return this.therapists.apply(user.id, dto);
  }

  @Get('me')
  @Roles(Role.THERAPIST)
  @ApiOperation({ summary: 'My therapist profile (therapist)' })
  myProfile(@CurrentUser() user: AuthUser) {
    return this.therapists.myProfile(user.id);
  }

  @Patch('me')
  @Roles(Role.THERAPIST)
  @ApiOperation({ summary: 'Update my therapist profile (therapist)' })
  updateMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateTherapistProfileDto) {
    return this.therapists.updateOwnProfile(user.id, dto);
  }

  @Put('me/availability')
  @Roles(Role.THERAPIST)
  @ApiOperation({ summary: 'Replace my weekly availability (therapist)' })
  setAvailability(@CurrentUser() user: AuthUser, @Body() dto: SetAvailabilityDto) {
    return this.therapists.setAvailability(user.id, dto);
  }

  @Get('applications')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List pending therapist applications (admin)' })
  applications(@Query() pagination: PaginationDto) {
    return this.therapists.listApplications(pagination);
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a therapist application (admin)' })
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.therapists.moderate(id, true, user.id);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a therapist application (admin)' })
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.therapists.moderate(id, false, user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'View a therapist profile with availability and reviews' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.therapists.get(id);
  }

  @Post(':id/reviews')
  @ApiOperation({ summary: 'Review a therapist after a completed session' })
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewTherapistDto,
  ) {
    return this.therapists.review(user.id, id, dto);
  }
}
