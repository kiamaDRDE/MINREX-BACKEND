import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { envValidationSchema } from './config/env.validation.js';
import { RedisModule } from './infrastructure/cache/redis.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { HealthModule } from './infrastructure/health/health.module.js';
import { LoggingModule } from './infrastructure/logging/logging.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { MailModule } from './infrastructure/mail/mail.module.js';
import { NetworkModule } from './modules/network/network.module.js';
import { CensusModule } from './modules/census/census.module.js';
import { AssistanceModule } from './modules/assistance/assistance.module.js';
import { TalentModule } from './modules/talent/talent.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    LoggingModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    IdentityModule,
    MailModule,
    NetworkModule,
    CensusModule,
    AssistanceModule,
    TalentModule,
  ],

  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
