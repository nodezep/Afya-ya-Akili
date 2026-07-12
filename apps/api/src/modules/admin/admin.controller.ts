import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

export class SetBanDto {
  @ApiProperty()
  @IsBoolean()
  banned!: boolean;
}

export class SetRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'acme-kenya' })
  @Matches(/^[a-z0-9-]{3,50}$/)
  slug!: string;

  @ApiProperty()
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  seats!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  industry?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List/search users (admin)' })
  users(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('role') role?: Role,
  ) {
    return this.admin.listUsers(pagination, { search, role });
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban or unban a user (admin)' })
  setBan(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBanDto,
  ) {
    return this.admin.setUserBan(user.id, id, dto.banned);
  }

  @Post('users/:id/role')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Change a user role (super admin only)' })
  setRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.admin.setUserRole(user.id, id, dto.role);
  }

  @Get('crisis-queue')
  @ApiOperation({ summary: 'Unacknowledged crisis events (admin)' })
  crisisQueue(@Query() pagination: PaginationDto, @Query('all') all?: string) {
    return this.admin.crisisQueue(pagination, all !== 'true');
  }

  @Post('crisis-queue/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a crisis event (admin)' })
  acknowledgeCrisis(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.acknowledgeCrisis(user.id, id);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List organizations (admin)' })
  organizations(@Query() pagination: PaginationDto) {
    return this.admin.listOrganizations(pagination);
  }

  @Post('organizations')
  @ApiOperation({ summary: 'Create an organization (admin)' })
  createOrganization(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.admin.createOrganization(user.id, dto);
  }

  @Get('audit-logs')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Audit trail (super admin)' })
  auditLogs(@Query() pagination: PaginationDto, @Query('action') action?: string) {
    return this.admin.auditLogs(pagination, action);
  }

  @Get('webhook-events')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Payment/webhook event log (super admin)' })
  webhookEvents(@Query() pagination: PaginationDto, @Query('provider') provider?: string) {
    return this.admin.webhookEvents(pagination, provider);
  }
}
