import {
  Module,
} from '@nestjs/common';

import {
  AccessModule,
} from './access/access.module.js';

import {
  AuthModule,
} from './auth/auth.module.js';

import {
  AuthorizationModule,
} from './authorization/authorization.module.js';

import {
  UsersModule,
} from './users/users.module.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    UsersModule,
    AccessModule,
  ],

  exports: [
    AuthModule,
    AuthorizationModule,
    UsersModule,
    AccessModule,
  ],
})
export class IdentityModule {}