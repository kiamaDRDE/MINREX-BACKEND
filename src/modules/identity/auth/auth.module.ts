import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { MailModule } from '../../../infrastructure/mail/mail.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';

@Module({
  imports: [
    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (
        configService: ConfigService,
      ) => ({
        secret:
          configService.getOrThrow<string>(
            'JWT_ACCESS_SECRET',
          ),
      }),
    }),

    MailModule,
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    AccessTokenGuard,
  ],

  exports: [
    AuthService,
    JwtModule,
    AccessTokenGuard,
  ],
})
export class AuthModule {}
