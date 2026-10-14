import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../identity/auth/auth.module.js';

import {
  AuthorizationModule,
} from '../identity/authorization/authorization.module.js';

import {
  AssistanceController,
} from './assistance.controller.js';

import {
  AssistanceService,
} from './assistance.service.js';

import {
  AssistanceAgentController,
} from './agent/assistance-agent.controller.js';

import {
  AssistanceAgentService,
} from './agent/assistance-agent.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
  ],

  controllers: [
    AssistanceController,
    AssistanceAgentController,
  ],

  providers: [
    AssistanceService,
    AssistanceAgentService,
  ],

  exports: [
    AssistanceService,
    AssistanceAgentService,
  ],
})
export class AssistanceModule {}