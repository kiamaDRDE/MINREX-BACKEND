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
  ],

  providers: [
    CensusService,
  ],

  exports: [
    CensusService,
  ],
})
export class CensusModule {}