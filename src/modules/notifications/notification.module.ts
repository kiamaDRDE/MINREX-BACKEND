import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { MailModule } from '../../infrastructure/mail/mail.module.js';
import { NotificationEventBusService } from './events/notification-event-bus.service.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventBusService],
  exports: [NotificationService, NotificationEventBusService],
})
export class NotificationModule {}
