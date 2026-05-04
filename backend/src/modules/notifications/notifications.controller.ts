import { Controller, Get, Patch, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiCookieAuth('auth_token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the authenticated user' })
  getNotifications(@Req() req) {
    return this.notificationsService.getUserNotifications(req.user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@Req() req, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  deleteNotification(@Req() req, @Param('id') id: string) {
    return this.notificationsService.deleteNotification(req.user.sub, id);
  }
}
