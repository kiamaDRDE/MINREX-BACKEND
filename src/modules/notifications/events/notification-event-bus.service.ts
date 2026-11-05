import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '../../../generated/prisma/enums.js';

export interface DispatchNotificationEvent {
  recipientId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  title: string;
  content: string;
  actionUrl?: string;
  actionLabel?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationEventBusService {
  private readonly logger = new Logger(NotificationEventBusService.name);
  private readonly bus$ = new Subject<DispatchNotificationEvent>();

  get events$() {
    return this.bus$.asObservable();
  }

  emit(event: DispatchNotificationEvent): void {
    this.logger.debug(
      `Dispatching notification event: [${event.type}] for user ${event.recipientId}`,
    );
    this.bus$.next(event);
  }
}
