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

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
  ],

  controllers: [
    AssistanceController,
  ],

  providers: [
    AssistanceService,
  ],

  exports: [
    AssistanceService,
  ],
})
export class AssistanceModule {}