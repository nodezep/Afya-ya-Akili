import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrganizationsService } from './organizations.service';

export class InviteMemberDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class RespondInviteDto {
  @ApiProperty()
  @IsBoolean()
  accept!: boolean;
}

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Organizations I belong to' })
  mine(@CurrentUser() user: AuthUser) {
    return this.organizations.myOrganizations(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Organization details (members only)' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.get(user.id, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List members (org admin)' })
  members(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.organizations.members(user.id, id, pagination);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Invite a member by email (org admin)' })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizations.inviteMember(user.id, id, dto.email);
  }

  @Post(':id/invitation')
  @ApiOperation({ summary: 'Accept or decline my invitation' })
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondInviteDto,
  ) {
    return this.organizations.respondToInvite(user.id, id, dto.accept);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member (org admin)' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.organizations.removeMember(user.id, id, memberId);
  }

  @Get(':id/insights')
  @ApiOperation({ summary: 'Anonymised wellbeing insights (org admin, min cohort 5)' })
  insights(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: number,
  ) {
    return this.organizations.insights(user.id, id, days ? Number(days) : 30);
  }
}
