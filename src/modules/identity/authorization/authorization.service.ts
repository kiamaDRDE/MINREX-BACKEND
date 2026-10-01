import { Injectable } from '@nestjs/common';

import { RoleScope } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import type { AuthorizationContext } from './interfaces/authorization-context.interface.js';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async hasAllPermissions(
    userId: string,
    requiredPermissions: string[],
    context: AuthorizationContext = {},
  ): Promise<boolean> {
    /*
     * A route without permission requirements
     * does not need RBAC authorization.
     */
    if (requiredPermissions.length === 0) {
      return true;
    }

    const now = new Date();

    /*
     * Retrieve all currently valid role assignments.
     *
     * We intentionally do NOT store permissions
     * directly in the JWT because:
     *
     * - roles can change
     * - permissions can change
     * - assignments can expire
     * - scopes can change
     *
     * Authorization therefore reflects current
     * database state.
     */
    const assignments =
      await this.prisma.userRoleAssignment.findMany({
        where: {
          userId,

          isActive: true,

          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],

          role: {
            isActive: true,
          },
        },

        select: {
          postId: true,
          serviceId: true,

          role: {
            select: {
              scope: true,

              permissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
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

    for (const assignment of assignments) {
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

    /*
     * All permissions declared by the route
     * must be granted.
     */
    return requiredPermissions.every(
      (permission) =>
        grantedPermissions.has(permission),
    );
  }

  private assignmentMatchesContext(
    roleScope: RoleScope,
    assignmentPostId: string | null,
    assignmentServiceId: string | null,
    context: AuthorizationContext,
  ): boolean {
    /*
     * GLOBAL roles can operate independently
     * of a diplomatic post or service.
     */
    if (roleScope === RoleScope.GLOBAL) {
      return true;
    }

    /*
     * POST-scoped role:
     *
     * the request must explicitly target
     * the same diplomatic post.
     */
    if (roleScope === RoleScope.POST) {
      return (
        Boolean(context.postId) &&
        assignmentPostId === context.postId
      );
    }

    /*
     * SERVICE-scoped role:
     *
     * the request must target the same service.
     *
     * If the route also supplies postId,
     * the post must match as well.
     */
    if (roleScope === RoleScope.SERVICE) {
      if (
        !context.serviceId ||
        assignmentServiceId !==
          context.serviceId
      ) {
        return false;
      }

      if (
        context.postId &&
        assignmentPostId !== context.postId
      ) {
        return false;
      }

      return true;
    }

    return false;
  }
}
