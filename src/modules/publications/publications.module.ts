import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { NotificationModule } from '../notifications/notification.module.js';
import { PublicationsController } from './publications.controller.js';
import { PublicationsService } from './publications.service.js';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [PublicationsController],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}

