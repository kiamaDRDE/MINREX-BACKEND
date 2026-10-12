import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';

import { AuthorizationModule } from './authorization/authorization.module.js';

import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    UsersModule,
  ],

  exports: [
    AuthModule,
    AuthorizationModule,
    UsersModule,
  ],
})
export class IdentityModule {}