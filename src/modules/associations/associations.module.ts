import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { NotificationModule } from '../notifications/notification.module.js';
import { AssociationsController } from './associations.controller.js';
import { AssociationsAgentController } from './agent/associations-agent.controller.js';
import { AssociationsService } from './associations.service.js';
import { AuthModule } from '../identity/auth/auth.module.js';
import { AuthorizationModule } from '../identity/authorization/authorization.module.js';

@Module({
  imports: [DatabaseModule, NotificationModule, AuthModule, AuthorizationModule],
  controllers: [AssociationsController, AssociationsAgentController],
  providers: [AssociationsService],
  exports: [AssociationsService],
})
export class AssociationsModule {}
