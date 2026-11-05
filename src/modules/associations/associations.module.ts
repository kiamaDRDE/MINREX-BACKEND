import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { NotificationModule } from '../notifications/notification.module.js';
import { AssociationsController } from './associations.controller.js';
import { AssociationsService } from './associations.service.js';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [AssociationsController],
  providers: [AssociationsService],
  exports: [AssociationsService],
})
export class AssociationsModule {}
