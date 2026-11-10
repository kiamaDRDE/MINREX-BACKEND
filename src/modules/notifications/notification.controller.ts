import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../identity/auth/guards/access-token.guard.js';
import { RequirePermissions } from '../identity/authorization/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../identity/authorization/guards/permissions.guard.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto.js';
import { NotificationService } from './notification.service.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(['', 'me'])
  @RequirePermissions('notifications.read.self')
  @ApiOperation({ summary: 'Get paginated notifications of current user' })
  @ApiOkResponse({ description: 'List of user notifications with metadata.' })
  getMyNotifications(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationService.getMyNotifications(
      request.auth!.userId!,
      query,
    );
  }

  @Get(['unread-count', 'me/unread-count'])
  @RequirePermissions('notifications.read.self')
  @ApiOperation({ summary: 'Get unread notifications count for badge' })
  @ApiOkResponse({ description: 'Unread notifications count.' })
  getUnreadCount(@Req() request: AuthenticatedRequest) {
    return this.notificationService.getUnreadCount(request.auth!.userId!);
  }

  @Patch([':id/read', 'me/:id/read'])
  @RequirePermissions('notifications.manage.self')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({ description: 'Notification marked as read.' })
  markAsRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.markAsRead(request.auth!.userId!, id);
  }

  @Patch(['read-all', 'me/read-all'])
  @Post('me/read-all')
  @RequirePermissions('notifications.manage.self')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  @ApiOkResponse({ description: 'All notifications marked as read.' })
  markAllAsRead(@Req() request: AuthenticatedRequest) {
    return this.notificationService.markAllAsRead(request.auth!.userId!);
  }

  @Delete([':id', 'me/:id'])
  @RequirePermissions('notifications.manage.self')
  @ApiOperation({ summary: 'Archive a notification' })
  @ApiOkResponse({ description: 'Notification archived.' })
  archiveNotification(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.archiveNotification(request.auth!.userId!, id);
  }

  @Get(['preferences', 'me/preferences'])
  @RequirePermissions('notifications.read.self')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiOkResponse({ description: 'Notification preferences per event type.' })
  getMyPreferences(@Req() request: AuthenticatedRequest) {
    return this.notificationService.getMyPreferences(request.auth!.userId!);
  }

  @Patch(['preferences', 'me/preferences'])
  @RequirePermissions('notifications.manage.self')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiOkResponse({ description: 'Updated notification preferences.' })
  updateMyPreferences(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationService.updateMyPreferences(
      request.auth!.userId!,
      dto,
    );
  }
}
