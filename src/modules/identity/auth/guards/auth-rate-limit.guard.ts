import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import { createHash } from 'node:crypto';

import {
  RedisService,
} from '../../../../infrastructure/cache/redis.service.js';

interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

interface RoutePolicy {
  ip: RateLimitRule;
  identity?: RateLimitRule & {
    field: 'identifier' | 'email';
  };
}

const POLICIES: Record<string, RoutePolicy> = {
  login: {
    ip: {
      limit: 30,
      windowSeconds: 60,
    },
    identity: {
      field: 'identifier',
      limit: 10,
      windowSeconds: 15 * 60,
    },
  },

  register: {
    ip: {
      limit: 5,
      windowSeconds: 15 * 60,
    },
  },

  verifyEmail: {
    ip: {
      limit: 20,
      windowSeconds: 15 * 60,
    },
  },

  resendVerification: {
    ip: {
      limit: 10,
      windowSeconds: 15 * 60,
    },
    identity: {
      field: 'email',
      limit: 1,
      windowSeconds: 60,
    },
  },

  logout: {
    ip: {
      limit: 30,
      windowSeconds: 60,
    },
  },
};

/*
 * Fixed window starting with the first request.
 *
 * Blocked requests do not extend the window.
 * Counting and expiration are handled atomically.
 */
const RATE_LIMIT_SCRIPT = `
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])

  if current >= limit then
    local ttl = redis.call('TTL', KEYS[1])

    if ttl < 0 then
      redis.call('EXPIRE', KEYS[1], window)
      ttl = window
    end

    return ttl
  end

  local count = redis.call('INCR', KEYS[1])

  if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
    redis.call('EXPIRE', KEYS[1], window)
  end

  return 0
`;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const handlerName = context.getHandler().name;
    const policy = POLICIES[handlerName];

    // Routes without a policy, such as "me", are unaffected.
    if (!policy) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const ipAddress =
      request.ip ?? request.socket.remoteAddress;

    if (!ipAddress) {
      throw new ServiceUnavailableException(
        'Authentication protection is temporarily unavailable.',
      );
    }

    await this.enforce(
      handlerName,
      'ip',
      ipAddress,
      policy.ip,
      response,
    );

    if (policy.identity) {
      /*
       * Guards execute before DTO validation.
       * Treat the body as untrusted input.
       */
      const body: unknown = request.body;

      if (
        typeof body === 'object' &&
        body !== null &&
        !Array.isArray(body)
      ) {
        const value: unknown =
          (body as Record<string, unknown>)[
            policy.identity.field
          ];

        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();

          if (normalized.length > 0) {
            await this.enforce(
              handlerName,
              'identity',
              normalized,
              policy.identity,
              response,
            );
          }
        }
      }
    }

    return true;
  }

  private async enforce(
    route: string,
    scope: 'ip' | 'identity',
    value: string,
    rule: RateLimitRule,
    response: Response,
  ): Promise<void> {
    /*
     * Avoid placing raw emails or IP addresses in Redis keys.
     * Hashing does not make these identifiers anonymous.
     */
    const digest = createHash('sha256')
      .update(value)
      .digest('hex');

    const key =
      `minrex:auth:rate-limit:${route}:${scope}:${digest}`;

    const client = this.redisService.getClient();

    if (client.status !== 'ready') {
      throw new ServiceUnavailableException(
        'Authentication protection is temporarily unavailable.',
      );
    }

    let retryAfter: number;

    try {
      const result: unknown = await client.eval(
        RATE_LIMIT_SCRIPT,
        1,
        key,
        rule.limit,
        rule.windowSeconds,
      );

      if (
        typeof result !== 'number' ||
        !Number.isInteger(result) ||
        result < 0
      ) {
        throw new Error('Invalid rate limit result.');
      }

      retryAfter = result;
    } catch {
      /*
       * Do not silently allow unlimited authentication
       * requests when Redis is unavailable.
       */
      throw new ServiceUnavailableException(
        'Authentication protection is temporarily unavailable.',
      );
    }

    if (retryAfter > 0) {
      response.setHeader(
        'Retry-After',
        String(retryAfter),
      );

      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}