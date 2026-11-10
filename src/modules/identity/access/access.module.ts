import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  AuthorizationModule,
} from '../authorization/authorization.module.js';

import {
  NotificationModule,
} from '../../notifications/notification.module.js';

import {
  AccessController,
} from './access.controller.js';

import {
  AccessService,
} from './access.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    NotificationModule,
  ],

  controllers: [
    AccessController,
  ],

  providers: [
    AccessService,
  ],

  exports: [
    AccessService,
  ],
})
export class AccessModule {}