import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Respect X-Forwarded-For / X-Forwarded-Proto behind reverse proxies (Nginx/Cloudflare/Traefik)
  app.set('trust proxy', 1);

  // Gracefully close Prisma, Redis, and SMTP connection pools on SIGTERM/SIGINT
  app.enableShutdownHooks();

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

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Autoriser les requêtes sans origine (SSR, outils CLI, curl)
      if (!origin) return callback(null, true);
      // Autoriser les origines explicitement définies dans CORS_ORIGINS
      if (corsOrigins.includes(origin)) return callback(null, true);
      // Autoriser automatiquement localhost/127.0.0.1 uniquement hors production
      if (
        !isProduction &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      // Autoriser l'accès depuis le VPS de pré-production si utilisé
      if (/^https?:\/\/185\.98\.136\.192(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },

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
      'x-minrex-client',
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
  | SWAGGER / OPENAPI (DISABLED BY DEFAULT IN PRODUCTION)
  |--------------------------------------------------------------------------
  */

  const swaggerEnabled = configService.get<boolean>(
    'SWAGGER_ENABLED',
    !isProduction,
  );

  if (swaggerEnabled) {
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
  }

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
    swaggerEnabled
      ? `Swagger documentation: /${apiPrefix}/docs`
      : 'Swagger documentation disabled in production',
  );
}

void bootstrap();
