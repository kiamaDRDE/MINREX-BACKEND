import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type { Request } from 'express';

@Injectable()
export class AuthCookieGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(configService: ConfigService) {
    this.allowedOrigins = new Set(
      configService
        .get<string>('CORS_ORIGINS', '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request>();

    if (request.get('x-minrex-client') !== 'web') {
      throw new ForbiddenException(
        'Required authentication request header is missing.',
      );
    }

    const origin = request.get('origin');

    if (
      origin !== undefined &&
      !this.allowedOrigins.has(origin)
    ) {
      throw new ForbiddenException(
        'Request origin is not allowed.',
      );
    }

    /*
     * Requests without Origin, such as command-line clients,
     * must still provide the custom header and valid cookie.
     */
    return true;
  }
}