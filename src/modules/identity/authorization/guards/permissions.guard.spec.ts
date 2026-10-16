import {
  ForbiddenException,
} from '@nestjs/common';

import type {
  ExecutionContext,
} from '@nestjs/common';

import type {
  Reflector,
} from '@nestjs/core';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type {
  AuthorizationService,
} from '../authorization.service.js';

import {
  AUTHORIZATION_SCOPE_KEY,
} from '../decorators/authorization-scope.decorator.js';

import {
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator.js';

import {
  PERMISSIONS,
} from '../constants/permissions.constants.js';

import {
  PermissionsGuard,
} from './permissions.guard.js';

describe(
  'PermissionsGuard',
  () => {
    const reflectorMock = {
      getAllAndOverride:
        jest.fn(),
    };

    const authorizationServiceMock = {
      hasAllPermissions:
        jest.fn(),
    };

    let guard:
      PermissionsGuard;

    const createContext = (
      request:
        Record<string, unknown>,
    ) =>
      ({
        getHandler: () =>
          function handler() {},

        getClass: () =>
          class TestController {},

        switchToHttp: () => ({
          getRequest: () =>
            request,
        }),
      }) as unknown as ExecutionContext;

    beforeEach(() => {
      jest.clearAllMocks();

      guard =
        new PermissionsGuard(
          reflectorMock as unknown as Reflector,

          authorizationServiceMock as unknown as AuthorizationService,
        );
    });

    it(
      'should allow a route without permission metadata',
      async () => {
        reflectorMock.getAllAndOverride.mockReturnValue(
          undefined,
        );

        const context =
          createContext({});

        const result =
          await guard.canActivate(
            context,
          );

        expect(
          result,
        ).toBe(true);

        expect(
          authorizationServiceMock.hasAllPermissions,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'should pass the authenticated user and POST scope to AuthorizationService',
      async () => {
        reflectorMock.getAllAndOverride.mockImplementation(
          (
            key:
              string,
          ) => {
            if (
              key ===
              REQUIRED_PERMISSIONS_KEY
            ) {
              return [
                PERMISSIONS.ASSISTANCE.CASES_READ,
              ];
            }

            if (
              key ===
              AUTHORIZATION_SCOPE_KEY
            ) {
              return {
                postParam:
                  'postId',
              };
            }

            return undefined;
          },
        );

        authorizationServiceMock.hasAllPermissions.mockResolvedValue(
          true,
        );

        const context =
          createContext({
            auth: {
              userId:
                'user-id',

              sessionId:
                'session-id',
            },

            params: {
              postId:
                'post-paris',
            },
          });

        const result =
          await guard.canActivate(
            context,
          );

        expect(
          result,
        ).toBe(true);

        expect(
          authorizationServiceMock.hasAllPermissions,
        ).toHaveBeenCalledWith(
          'user-id',

          [
            PERMISSIONS.ASSISTANCE.CASES_READ,
          ],

          {
            postId:
              'post-paris',
          },
        );
      },
    );

    it(
      'should throw ForbiddenException when permission is denied',
      async () => {
        reflectorMock.getAllAndOverride.mockImplementation(
          (
            key:
              string,
          ) => {
            if (
              key ===
              REQUIRED_PERMISSIONS_KEY
            ) {
              return [
                PERMISSIONS.IDENTITY.USERS_MANAGE,
              ];
            }

            return undefined;
          },
        );

        authorizationServiceMock.hasAllPermissions.mockResolvedValue(
          false,
        );

        const context =
          createContext({
            auth: {
              userId:
                'user-id',

              sessionId:
                'session-id',
            },

            params: {},
          });

        await expect(
          guard.canActivate(
            context,
          ),
        ).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it(
      'should reject a request without authentication context',
      async () => {
        reflectorMock.getAllAndOverride.mockImplementation(
          (
            key:
              string,
          ) => {
            if (
              key ===
              REQUIRED_PERMISSIONS_KEY
            ) {
              return [
                PERMISSIONS.IDENTITY.USERS_READ,
              ];
            }

            return undefined;
          },
        );

        const context =
          createContext({
            params: {},
          });

        await expect(
          guard.canActivate(
            context,
          ),
        ).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );
  },
);