import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AuthCookieGuard } from './auth-cookie.guard.js';

function createConfig(values: Record<string, string>): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T) =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

function createContext(headers: Record<string, string | undefined>): ExecutionContext {
  const normalized: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) {
    normalized[k.toLowerCase()] = v;
  }

  return {
    switchToHttp: () => ({
      getRequest: () => ({
        get: (name: string) => normalized[name.toLowerCase()],
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthCookieGuard', () => {
  it('rejects requests without the x-minrex-client: web header', () => {
    const guard = new AuthCookieGuard(
      createConfig({ NODE_ENV: 'development', CORS_ORIGINS: '' }),
    );
    expect(() => guard.canActivate(createContext({ origin: 'http://localhost:8080' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows localhost origins in development', () => {
    const guard = new AuthCookieGuard(
      createConfig({ NODE_ENV: 'development', CORS_ORIGINS: '' }),
    );
    expect(
      guard.canActivate(
        createContext({
          'x-minrex-client': 'web',
          origin: 'http://localhost:8080',
        }),
      ),
    ).toBe(true);
  });

  it('rejects arbitrary localhost origins in production unless listed in CORS_ORIGINS', () => {
    const guard = new AuthCookieGuard(
      createConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://diaspora.minrex.cm',
      }),
    );

    expect(() =>
      guard.canActivate(
        createContext({
          'x-minrex-client': 'web',
          origin: 'http://localhost:8080',
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        createContext({
          'x-minrex-client': 'web',
          origin: 'https://diaspora.minrex.cm',
        }),
      ),
    ).toBe(true);
  });
});
