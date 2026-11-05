import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { MailModule } from '../../infrastructure/mail/mail.module.js';
import { NotificationEventBusService } from './events/notification-event-bus.service.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { AuthModule } from '../identity/auth/auth.module.js';
import { AuthorizationModule } from '../identity/authorization/authorization.module.js';

@Module({
  imports: [DatabaseModule, MailModule,AuthModule,AuthorizationModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventBusService],
  exports: [NotificationService, NotificationEventBusService],
})
export class NotificationModule {}
