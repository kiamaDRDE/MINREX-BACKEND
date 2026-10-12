import { Injectable } from '@nestjs/common';

import {
  RoleScope,
} from '../../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import type {
  AuthorizationContext,
} from './interfaces/authorization-context.interface.js';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | CHECK REQUIRED PERMISSIONS
  |--------------------------------------------------------------------------
  */

  async hasAllPermissions(
    userId: string,
    requiredPermissions: string[],
    context: AuthorizationContext = {},
  ): Promise<boolean> {
    if (
      requiredPermissions.length === 0
    ) {
      return true;
    }

    const now =
      new Date();

    const assignments =
      await this.prisma.userRoleAssignment.findMany({
        where: {
          userId,

          isActive:
            true,

          OR: [
            {
              expiresAt:
                null,
            },

            {
              expiresAt: {
                gt:
                  now,
              },
            },
          ],

          role: {
            isActive:
              true,
          },
        },

        select: {
          postId:
            true,

          serviceId:
            true,

          role: {
            select: {
              scope:
                true,

              permissions: {
                select: {
                  permission: {
                    select: {
                      code:
                        true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    const grantedPermissions =
      new Set<string>();

    for (
      const assignment
      of assignments
    ) {
      if (
        !this.assignmentMatchesContext(
          assignment.role.scope,
          assignment.postId,
          assignment.serviceId,
          context,
        )
      ) {
        continue;
      }

      for (
        const rolePermission
        of assignment.role.permissions
      ) {
        grantedPermissions.add(
          rolePermission.permission.code,
        );
      }
    }

    return requiredPermissions.every(
      (permission) =>
        grantedPermissions.has(
          permission,
        ),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CURRENT USER AUTHORIZATION CONTEXT
  |--------------------------------------------------------------------------
  |
  | Used primarily by:
  |
  | GET /api/v1/auth/me
  |
  | The frontend receives:
  |
  | - roles
  | - permissions
  | - role scopes
  | - diplomatic post context
  | - service context
  |
  | Authorization is still enforced by the backend.
  |
  */

  async getUserAuthorizationContext(
    userId: string,
  ) {
    const now =
      new Date();

    const assignments =
      await this.prisma.userRoleAssignment.findMany({
        where: {
          userId,

          isActive:
            true,

          OR: [
            {
              expiresAt:
                null,
            },

            {
              expiresAt: {
                gt:
                  now,
              },
            },
          ],

          role: {
            isActive:
              true,
          },
        },

        orderBy: {
          assignedAt:
            'asc',
        },

        select: {
          id:
            true,

          postId:
            true,

          serviceId:
            true,

          assignedAt:
            true,

          expiresAt:
            true,

          role: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,

              description:
                true,

              scope:
                true,

              isSystem:
                true,

              permissions: {
                orderBy: {
                  permission: {
                    code:
                      'asc',
                  },
                },

                select: {
                  permission: {
                    select: {
                      id:
                        true,

                      code:
                        true,

                      name:
                        true,

                      description:
                        true,
                    },
                  },
                },
              },
            },
          },

          post: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,
            },
          },

          service: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,
            },
          },
        },
      });

    /*
     * Flat permission collection.
     *
     * This is convenient for frontend UX:
     *
     * can("identity.users.read")
     *
     * However, the frontend MUST NOT interpret
     * this list as authorization for every post
     * or service.
     *
     * Backend guards remain responsible for
     * scope-aware security.
     */
    const permissionCodes =
      new Set<string>();

    for (
      const assignment
      of assignments
    ) {
      for (
        const rolePermission
        of assignment.role.permissions
      ) {
        permissionCodes.add(
          rolePermission.permission.code,
        );
      }
    }

    return {
      permissions:
        Array.from(
          permissionCodes,
        ).sort(),

      assignments:
        assignments.map(
          (assignment) => ({
            id:
              assignment.id,

            assignedAt:
              assignment.assignedAt,

            expiresAt:
              assignment.expiresAt,

            postId:
              assignment.postId,

            serviceId:
              assignment.serviceId,

            role: {
              id:
                assignment.role.id,

              code:
                assignment.role.code,

              name:
                assignment.role.name,

              description:
                assignment.role.description,

              scope:
                assignment.role.scope,

              isSystem:
                assignment.role.isSystem,
            },

            post:
              assignment.post,

            service:
              assignment.service,

            permissions:
              assignment.role.permissions.map(
                ({
                  permission,
                }) =>
                  permission,
              ),
          }),
        ),
    };
  }

  /*
  |--------------------------------------------------------------------------
  | SCOPE MATCHING
  |--------------------------------------------------------------------------
  */

  private assignmentMatchesContext(
    roleScope:
      RoleScope,

    assignmentPostId:
      string | null,

    assignmentServiceId:
      string | null,

    context:
      AuthorizationContext,
  ): boolean {
    /*
     * GLOBAL roles can operate independently
     * of a diplomatic post or service.
     */
    if (
      roleScope ===
      RoleScope.GLOBAL
    ) {
      return true;
    }

    /*
     * POST-scoped role.
     */
    if (
      roleScope ===
      RoleScope.POST
    ) {
      return (
        Boolean(
          context.postId,
        ) &&
        assignmentPostId ===
          context.postId
      );
    }

    /*
     * SERVICE-scoped role.
     */
    if (
      roleScope ===
      RoleScope.SERVICE
    ) {
      if (
        !context.serviceId ||
        assignmentServiceId !==
          context.serviceId
      ) {
        return false;
      }

      if (
        context.postId &&
        assignmentPostId !==
          context.postId
      ) {
        return false;
      }

      return true;
    }

    return false;
  }
}