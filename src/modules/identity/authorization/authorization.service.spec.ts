import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  RoleScope,
} from '../../../generated/prisma/enums.js';

import type {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import {
  AuthorizationService,
} from './authorization.service.js';

import {
  PERMISSIONS,
} from './constants/permissions.constants.js';

describe(
  'AuthorizationService',
  () => {
    let service:
      AuthorizationService;

    const prismaMock = {
      userRoleAssignment: {
        findMany:
          jest.fn(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();

      service =
        new AuthorizationService(
          prismaMock as unknown as PrismaService,
        );
    });

    it(
      'should allow a route without required permissions',
      async () => {
        const result =
          await service.hasAllPermissions(
            'user-id',
            [],
          );

        expect(
          result,
        ).toBe(true);

        expect(
          prismaMock.userRoleAssignment.findMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'should grant a GLOBAL permission',
      async () => {
        prismaMock.userRoleAssignment.findMany.mockResolvedValue([
          {
            postId:
              null,

            serviceId:
              null,

            role: {
              scope:
                RoleScope.GLOBAL,

              permissions: [
                {
                  permission: {
                    code:
                      PERMISSIONS.IDENTITY.USERS_READ,
                  },
                },
              ],
            },
          },
        ]);

        const result =
          await service.hasAllPermissions(
            'user-id',

            [
              PERMISSIONS.IDENTITY.USERS_READ,
            ],

            {
              postId:
                'any-post-id',
            },
          );

        expect(
          result,
        ).toBe(true);
      },
    );

    it(
      'should grant a POST permission for the matching diplomatic post',
      async () => {
        prismaMock.userRoleAssignment.findMany.mockResolvedValue([
          {
            postId:
              'post-paris',

            serviceId:
              null,

            role: {
              scope:
                RoleScope.POST,

              permissions: [
                {
                  permission: {
                    code:
                      PERMISSIONS.ASSISTANCE.CASES_READ,
                  },
                },
              ],
            },
          },
        ]);

        const result =
          await service.hasAllPermissions(
            'user-id',

            [
              PERMISSIONS.ASSISTANCE.CASES_READ,
            ],

            {
              postId:
                'post-paris',
            },
          );

        expect(
          result,
        ).toBe(true);
      },
    );

    it(
      'should deny a POST permission for another diplomatic post',
      async () => {
        prismaMock.userRoleAssignment.findMany.mockResolvedValue([
          {
            postId:
              'post-paris',

            serviceId:
              null,

            role: {
              scope:
                RoleScope.POST,

              permissions: [
                {
                  permission: {
                    code:
                      PERMISSIONS.ASSISTANCE.CASES_READ,
                  },
                },
              ],
            },
          },
        ]);

        const result =
          await service.hasAllPermissions(
            'user-id',

            [
              PERMISSIONS.ASSISTANCE.CASES_READ,
            ],

            {
              postId:
                'post-berlin',
            },
          );

        expect(
          result,
        ).toBe(false);
      },
    );

    it(
      'should deny access when the required permission is missing',
      async () => {
        prismaMock.userRoleAssignment.findMany.mockResolvedValue([
          {
            postId:
              null,

            serviceId:
              null,

            role: {
              scope:
                RoleScope.GLOBAL,

              permissions: [
                {
                  permission: {
                    code:
                      PERMISSIONS.IDENTITY.USERS_READ,
                  },
                },
              ],
            },
          },
        ]);

        const result =
          await service.hasAllPermissions(
            'user-id',

            [
              PERMISSIONS.IDENTITY.USERS_MANAGE,
            ],
          );

        expect(
          result,
        ).toBe(false);
      },
    );

    it(
      'should require every permission declared by the route',
      async () => {
        prismaMock.userRoleAssignment.findMany.mockResolvedValue([
          {
            postId:
              null,

            serviceId:
              null,

            role: {
              scope:
                RoleScope.GLOBAL,

              permissions: [
                {
                  permission: {
                    code:
                      PERMISSIONS.IDENTITY.USERS_READ,
                  },
                },
              ],
            },
          },
        ]);

        const result =
          await service.hasAllPermissions(
            'user-id',

            [
              PERMISSIONS.IDENTITY.USERS_READ,

              PERMISSIONS.IDENTITY.USERS_MANAGE,
            ],
          );

        expect(
          result,
        ).toBe(false);
      },
    );
  },
);