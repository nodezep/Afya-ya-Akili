import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.list(user.id, pagination, unread === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count of unread notifications' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}
