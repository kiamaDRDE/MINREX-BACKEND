import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';

async function bootstrap() {
  /*
  |--------------------------------------------------------------------------
  | CREATE APPLICATION
  |--------------------------------------------------------------------------
  */

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  /*
  |--------------------------------------------------------------------------
  | STRUCTURED LOGGING
  |--------------------------------------------------------------------------
  */

  app.useLogger(app.get(Logger));

  /*
  |--------------------------------------------------------------------------
  | CONFIGURATION
  |--------------------------------------------------------------------------
  */

  const configService = app.get(ConfigService);

  const port = configService.get<number>(
    'APP_PORT',
    3000,
  );

  const apiPrefix = configService.get<string>(
    'API_PREFIX',
    'api',
  );

  const apiVersion = configService.get<string>(
    'API_VERSION',
    'v1',
  );

  /*
  |--------------------------------------------------------------------------
  | COOKIE PARSER
  |--------------------------------------------------------------------------
  |
  | Required for reading HttpOnly cookies such as:
  |
  | minrex_refresh_token
  |
  | request.cookies will then be available inside controllers.
  |
  */

  app.use(cookieParser());

  /*
  |--------------------------------------------------------------------------
  | SECURITY HEADERS
  |--------------------------------------------------------------------------
  */

  app.use(helmet());

  /*
  |--------------------------------------------------------------------------
  | CORS
  |--------------------------------------------------------------------------
  */

  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsCredentials =
    configService.get<boolean>(
      'CORS_CREDENTIALS',
      true,
    );

  app.enableCors({
    origin: corsOrigins,

    /*
     * Required because authentication uses
     * HttpOnly cookies for refresh tokens.
     */
    credentials: corsCredentials,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
    ],
  });

  /*
  |--------------------------------------------------------------------------
  | GLOBAL API PREFIX
  |--------------------------------------------------------------------------
  |
  | Example:
  |
  | /api/v1/auth/login
  | /api/v1/auth/refresh
  | /api/v1/health
  |
  */

  app.setGlobalPrefix(
    `${apiPrefix}/${apiVersion}`,
  );

  /*
  |--------------------------------------------------------------------------
  | GLOBAL DTO VALIDATION
  |--------------------------------------------------------------------------
  */

  app.useGlobalPipes(
    new ValidationPipe({
      /*
       * Remove properties that do not exist
       * in the DTO.
       */
      whitelist: true,

      /*
       * Reject requests containing unknown
       * properties instead of silently
       * removing them.
       */
      forbidNonWhitelisted: true,

      /*
       * Automatically transform request data
       * according to DTO types.
       */
      transform: true,
    }),
  );

  /*
  |--------------------------------------------------------------------------
  | SWAGGER / OPENAPI
  |--------------------------------------------------------------------------
  */

  const swaggerConfig =
    new DocumentBuilder()
      .setTitle('MINREX API')
      .setDescription(
        'API documentation for the MINREX platform',
      )
      .setVersion('1.0')

      /*
       * This will become useful once we protect
       * endpoints using Bearer JWT authentication.
       */
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )

      .build();

  const swaggerDocument =
    SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );

  /*
   * Swagger remains:
   *
   * http://localhost:3000/api/docs
   *
   * It is intentionally outside /api/v1.
   */
  SwaggerModule.setup(
    `${apiPrefix}/docs`,
    app,
    swaggerDocument,
  );

  /*
  |--------------------------------------------------------------------------
  | START SERVER
  |--------------------------------------------------------------------------
  */

  await app.listen(port);

  /*
   * Do not use console.log here because the project
   * already uses the structured Pino logger.
   */
  const logger = app.get(Logger);

  logger.log(
    `MINREX API running on port ${port}`,
  );

  logger.log(
    `API base path: /${apiPrefix}/${apiVersion}`,
  );

  logger.log(
    `Swagger documentation: /${apiPrefix}/docs`,
  );
}

void bootstrap();
