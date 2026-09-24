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
