import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Structured logging with Pino
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  const port = configService.get<number>('APP_PORT', 3000);

  const apiPrefix = configService.get<string>('API_PREFIX', 'api');

  const apiVersion = configService.get<string>('API_VERSION', 'v1');

  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsCredentials = configService.get<boolean>('CORS_CREDENTIALS', true);

  // HTTP security headers
  app.use(helmet());

  app.enableCors({
    origin: corsOrigins,
    credentials: corsCredentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  // Global API prefix
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  // Global DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MINREX API')
    .setDescription('API documentation for the MINREX platform')
    .setVersion('1.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(`${apiPrefix}/docs`, app, swaggerDocument);

  await app.listen(port);
}

void bootstrap();
