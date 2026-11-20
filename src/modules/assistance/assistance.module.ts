import { Module } from '@nestjs/common';

import { AuthModule } from '../identity/auth/auth.module.js';
import { AuthorizationModule } from '../identity/authorization/authorization.module.js';
import { NotificationModule } from '../notifications/notification.module.js';

import { AssistanceAdminController } from './admin/assistance-admin.controller.js';
import { AssistanceAgentController } from './agent/assistance-agent.controller.js';
import { AssistanceAgentService } from './agent/assistance-agent.service.js';
import { AssistanceController } from './assistance.controller.js';
import { AssistanceService } from './assistance.service.js';
import { AssistanceProtocolsService } from './protocols/assistance-protocols.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, NotificationModule],

  controllers: [
    AssistanceController,
    AssistanceAgentController,
    AssistanceAdminController,
  ],

  providers: [
    AssistanceService,
    AssistanceAgentService,
    AssistanceProtocolsService,
  ],

  exports: [
    AssistanceService,
    AssistanceAgentService,
    AssistanceProtocolsService,
  ],
})
export class AssistanceModule {}
