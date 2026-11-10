import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { MailService } from '../../infrastructure/mail/mail.service.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import {
  NotificationPreferenceItemDto,
  UpdateNotificationPreferencesDto,
} from './dto/update-notification-preferences.dto.js';
import type { DispatchNotificationEvent } from './events/notification-event-bus.service.js';
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async processNotificationEvent(event: DispatchNotificationEvent): Promise<void> {
    const priority = event.priority ?? NotificationPriority.NORMAL;
    const channels = event.channels ?? [NotificationChannel.IN_APP, NotificationChannel.EMAIL];

    // Check user preferences
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_type: {
          userId: event.recipientId,
          type: event.type,
        },
      },
    });

    const isEmailEnabled = preference?.emailEnabled ?? true;
    const isInAppEnabled = preference?.inAppEnabled ?? true;

    // 1. Create In-App Notification if enabled
    if (isInAppEnabled && channels.includes(NotificationChannel.IN_APP)) {
      await this.prisma.notification.create({
        data: {
          recipientId: event.recipientId,
          type: event.type,
          priority,
          channels: [NotificationChannel.IN_APP],
          title: event.title,
          content: event.content,
          actionUrl: event.actionUrl,
          icon: event.icon,
          status: NotificationStatus.UNREAD,
          metadata: (event.metadata as object) ?? {},
        },
      });
    }

    // 2. Send Email if enabled
    if (isEmailEnabled && channels.includes(NotificationChannel.EMAIL)) {
      const recipient = await this.prisma.user.findUnique({
        where: { id: event.recipientId },
        select: {
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (recipient?.email) {
        const recipientName = recipient.profile
          ? `${recipient.profile.firstName ?? ''} ${recipient.profile.lastName ?? ''}`.trim()
          : null;

        await this.mailService.sendNotificationEmail({
          to: recipient.email,
          recipientName,
          subject: event.title,
          title: event.title,
          content: event.content,
          actionUrl: event.actionUrl,
          actionLabel: event.actionLabel ?? 'Consulter sur le portail',
        });
      }
    }
  }

  async getMyNotifications(userId: string, query: QueryNotificationsDto) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      recipientId: userId,
      ...(status ? { status } : {}),
    };

    const [total, items, unreadCount] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { recipientId: userId, status: NotificationStatus.UNREAD },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        recipientId: userId,
        status: NotificationStatus.UNREAD,
      },
    });

    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification non trouvée.');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        status: NotificationStatus.UNREAD,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  async archiveNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification non trouvée.');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.ARCHIVED,
      },
    });
  }

  async getMyPreferences(userId: string): Promise<NotificationPreferenceItemDto[]> {
    const existing = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    const prefMap = new Map(existing.map((p) => [p.type, p]));

    // All available notification types
    const allTypes = Object.values(NotificationType);

    return allTypes.map((type) => {
      const p = prefMap.get(type);
      return {
        type,
        emailEnabled: p?.emailEnabled ?? true,
        inAppEnabled: p?.inAppEnabled ?? true,
      };
    });
  }

  async updateMyPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceItemDto[]> {
    for (const item of dto.preferences) {
      await this.prisma.notificationPreference.upsert({
        where: {
          userId_type: {
            userId,
            type: item.type,
          },
        },
        update: {
          emailEnabled: item.emailEnabled,
          inAppEnabled: item.inAppEnabled,
        },
        create: {
          userId,
          type: item.type,
          emailEnabled: item.emailEnabled,
          inAppEnabled: item.inAppEnabled,
        },
      });
    }

    return this.getMyPreferences(userId);
  }
}
