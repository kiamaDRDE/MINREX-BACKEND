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

    if (origin !== undefined) {
      const isAllowed =
        this.allowedOrigins.has(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https?:\/\/185\.98\.136\.192(:\d+)?$/.test(origin);

      if (!isAllowed) {
        throw new ForbiddenException(
          'Request origin is not allowed.',
        );
      }
    }

    /*
     * Requests without Origin, such as command-line clients,
     * must still provide the custom header and valid cookie.
     */
    return true;
  }
}