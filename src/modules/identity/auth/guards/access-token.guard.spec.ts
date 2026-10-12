import {
  UnauthorizedException,
} from '@nestjs/common';

import type {
  ExecutionContext,
} from '@nestjs/common';

import type {
  JwtService,
} from '@nestjs/jwt';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  UserStatus,
} from '../../../../generated/prisma/enums.js';

import type {
  PrismaService,
} from '../../../../infrastructure/database/prisma.service.js';

import {
  AccessTokenGuard,
} from './access-token.guard.js';

describe(
  'AccessTokenGuard',
  () => {
    const jwtServiceMock = {
      verifyAsync:
        jest.fn(),
    };

    const prismaMock = {
      authSession: {
        findUnique:
          jest.fn(),
      },
    };

    let guard:
      AccessTokenGuard;

    const createContext = (
      request:
        Record<string, unknown>,
    ) =>
      ({
        switchToHttp: () => ({
          getRequest: () =>
            request,
        }),
      }) as unknown as ExecutionContext;

    beforeEach(() => {
      jest.clearAllMocks();

      guard =
        new AccessTokenGuard(
          jwtServiceMock as unknown as JwtService,

          prismaMock as unknown as PrismaService,
        );
    });

    it(
      'should return 401 when the access token is missing',
      async () => {
        const context =
          createContext({
            headers: {},
          });

        await expect(
          guard.canActivate(
            context,
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it(
      'should allow a valid active authentication session',
      async () => {
        jwtServiceMock.verifyAsync.mockResolvedValue({
          sub:
            'user-id',

          sid:
            'session-id',
        });

        prismaMock.authSession.findUnique.mockResolvedValue({
          id:
            'session-id',

          userId:
            'user-id',

          revokedAt:
            null,

          expiresAt:
            new Date(
              Date.now() +
                60_000,
            ),

          user: {
            status:
              UserStatus.ACTIVE,

            emailVerifiedAt:
              new Date(),
          },
        });

        const request = {
          headers: {
            authorization:
              'Bearer valid-token',
          },
        };

        const context =
          createContext(
            request,
          );

        const result =
          await guard.canActivate(
            context,
          );

        expect(
          result,
        ).toBe(true);

        expect(
          request,
        ).toEqual({
          headers: {
            authorization:
              'Bearer valid-token',
          },

          auth: {
            userId:
              'user-id',

            sessionId:
              'session-id',
          },
        });
      },
    );

    it(
      'should return 401 when the authentication session has been revoked',
      async () => {
        jwtServiceMock.verifyAsync.mockResolvedValue({
          sub:
            'user-id',

          sid:
            'session-id',
        });

        prismaMock.authSession.findUnique.mockResolvedValue({
          id:
            'session-id',

          userId:
            'user-id',

          revokedAt:
            new Date(),

          expiresAt:
            new Date(
              Date.now() +
                60_000,
            ),

          user: {
            status:
              UserStatus.ACTIVE,

            emailVerifiedAt:
              new Date(),
          },
        });

        const context =
          createContext({
            headers: {
              authorization:
                'Bearer valid-token',
            },
          });

        await expect(
          guard.canActivate(
            context,
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it(
      'should return 401 when the authentication session has expired',
      async () => {
        jwtServiceMock.verifyAsync.mockResolvedValue({
          sub:
            'user-id',

          sid:
            'session-id',
        });

        prismaMock.authSession.findUnique.mockResolvedValue({
          id:
            'session-id',

          userId:
            'user-id',

          revokedAt:
            null,

          expiresAt:
            new Date(
              Date.now() -
                60_000,
            ),

          user: {
            status:
              UserStatus.ACTIVE,

            emailVerifiedAt:
              new Date(),
          },
        });

        const context =
          createContext({
            headers: {
              authorization:
                'Bearer valid-token',
            },
          });

        await expect(
          guard.canActivate(
            context,
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it(
      'should return 401 when the user account is not active',
      async () => {
        jwtServiceMock.verifyAsync.mockResolvedValue({
          sub:
            'user-id',

          sid:
            'session-id',
        });

        prismaMock.authSession.findUnique.mockResolvedValue({
          id:
            'session-id',

          userId:
            'user-id',

          revokedAt:
            null,

          expiresAt:
            new Date(
              Date.now() +
                60_000,
            ),

          user: {
            status:
              UserStatus.SUSPENDED,

            emailVerifiedAt:
              new Date(),
          },
        });

        const context =
          createContext({
            headers: {
              authorization:
                'Bearer valid-token',
            },
          });

        await expect(
          guard.canActivate(
            context,
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );
  },
);