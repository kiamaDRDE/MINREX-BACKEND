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
  CensusAgentController,
} from './agent/census-agent.controller.js';

import {
  CensusAgentService,
} from './agent/census-agent.service.js';

import {
  CensusController,
} from './census.controller.js';

import {
  CensusService,
} from './census.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
  ],

  controllers: [
    CensusController,
    CensusAgentController,
  ],

  providers: [
    CensusService,
    CensusAgentService,
  ],

  exports: [
    CensusService,
    CensusAgentService,
  ],
})
export class CensusModule {}