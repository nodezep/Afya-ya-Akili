import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterDeviceDto, UpdatePreferencesDto, UpdateProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me/profile')
  @ApiOperation({ summary: 'Get my profile' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update my profile' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get my preferences (locale, theme, notifications)' })
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.users.getPreferences(user.id);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update my preferences' })
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.id, dto);
  }

  @Post('me/devices')
  @ApiOperation({ summary: 'Register a device for push notifications' })
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.users.registerDevice(user.id, dto);
  }

  @Delete('me/devices/:token')
  @ApiOperation({ summary: 'Remove a push notification device' })
  removeDevice(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.users.removeDevice(user.id, token);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Export all my data (portability)' })
  exportData(@CurrentUser() user: AuthUser) {
    return this.users.exportData(user.id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete my account (anonymised soft delete)' })
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.users.deleteAccount(user.id);
  }
}
