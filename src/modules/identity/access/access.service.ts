import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DiplomaticPostStatus,
  RoleScope,
  ServiceStatus,
} from '../../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import {
  SYSTEM_ROLE_CODES,
} from '../authorization/constants/system-roles.constants.js';

import {
  AssignRoleDto,
} from './dto/assign-role.dto.js';

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | ROLES
  |--------------------------------------------------------------------------
  */

  async findRoles() {
    const roles =
      await this.prisma.role.findMany({
        where: {
          isActive:
            true,
        },

        orderBy: {
          name:
            'asc',
        },

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

          isActive:
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
      });

    return {
      items:
        roles.map(
          (role) => ({
            id:
              role.id,

            code:
              role.code,

            name:
              role.name,

            description:
              role.description,

            scope:
              role.scope,

            isSystem:
              role.isSystem,

            isActive:
              role.isActive,

            permissions:
              role.permissions.map(
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
  | PERMISSIONS
  |--------------------------------------------------------------------------
  */

  async findPermissions() {
    const permissions =
      await this.prisma.permission.findMany({
        orderBy: {
          code:
            'asc',
        },

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
      });

    return {
      items:
        permissions,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | USER ROLE ASSIGNMENTS
  |--------------------------------------------------------------------------
  */

  async findUserAssignments(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          id:
            true,

          email:
            true,

          username:
            true,

          status:
            true,

          profile: {
            select: {
              firstName:
                true,

              lastName:
                true,

              displayName:
                true,
            },
          },
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    const assignments =
      await this.prisma.userRoleAssignment.findMany({
        where: {
          userId,
        },

        orderBy: {
          assignedAt:
            'desc',
        },

        select: {
          id:
            true,

          isActive:
            true,

          assignedAt:
            true,

          expiresAt:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          postId:
            true,

          serviceId:
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

              isActive:
                true,
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

              status:
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

              status:
                true,
            },
          },
        },
      });

    return {
      user,
      assignments,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | ASSIGN ROLE
  |--------------------------------------------------------------------------
  */

  async assignRole(
    userId: string,
    dto:
      AssignRoleDto,
  ) {
    /*
     * User validation.
     */
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          id:
            true,

          status:
            true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    /*
     * Role validation.
     */
    const role =
      await this.prisma.role.findUnique({
        where: {
          code:
            dto.roleCode,
        },

        select: {
          id:
            true,

          code:
            true,

          name:
            true,

          scope:
            true,

          isSystem:
            true,

          isActive:
            true,
        },
      });

    if (
      !role ||
      !role.isActive
    ) {
      throw new NotFoundException(
        'Role not found or inactive.',
      );
    }

    /*
     * Expiration date validation.
     */
    let expiresAt:
      Date | null = null;

    if (
      dto.expiresAt
    ) {
      expiresAt =
        new Date(
          dto.expiresAt,
        );

      if (
        expiresAt <=
        new Date()
      ) {
        throw new BadRequestException(
          'Role assignment expiration date must be in the future.',
        );
      }
    }

    let postId:
      string | null = null;

    let serviceId:
      string | null = null;

    /*
     * GLOBAL ROLE
     *
     * GLOBAL roles must not contain
     * diplomatic post or service context.
     */
    if (
      role.scope ===
      RoleScope.GLOBAL
    ) {
      if (
        dto.postId ||
        dto.serviceId
      ) {
        throw new BadRequestException(
          'GLOBAL roles cannot be assigned to a diplomatic post or service.',
        );
      }
    }

    /*
     * POST ROLE
     */
    if (
      role.scope ===
      RoleScope.POST
    ) {
      if (
        !dto.postId
      ) {
        throw new BadRequestException(
          'A diplomatic post is required for a POST scoped role.',
        );
      }

      if (
        dto.serviceId
      ) {
        throw new BadRequestException(
          'A POST scoped role cannot contain a service.',
        );
      }

      const post =
        await this.prisma.diplomaticPost.findUnique({
          where: {
            id:
              dto.postId,
          },

          select: {
            id:
              true,

            status:
              true,
          },
        });

      if (!post) {
        throw new NotFoundException(
          'Diplomatic post not found.',
        );
      }

      if (
        post.status !==
        DiplomaticPostStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'The diplomatic post is not active.',
        );
      }

      postId =
        post.id;
    }

    /*
     * SERVICE ROLE
     *
     * The diplomatic post is derived from
     * the service to guarantee consistency.
     */
    if (
      role.scope ===
      RoleScope.SERVICE
    ) {
      if (
        !dto.serviceId
      ) {
        throw new BadRequestException(
          'A service is required for a SERVICE scoped role.',
        );
      }

      const service =
        await this.prisma.service.findUnique({
          where: {
            id:
              dto.serviceId,
          },

          select: {
            id:
              true,

            postId:
              true,

            status:
              true,

            post: {
              select: {
                id:
                  true,

                status:
                  true,
              },
            },
          },
        });

      if (!service) {
        throw new NotFoundException(
          'Service not found.',
        );
      }

      if (
        service.status !==
        ServiceStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'The service is not active.',
        );
      }

      if (
        service.post.status !==
        DiplomaticPostStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'The diplomatic post associated with this service is not active.',
        );
      }

      /*
       * If the frontend also sends postId,
       * it must correspond to the service.
       */
      if (
        dto.postId &&
        dto.postId !==
          service.postId
      ) {
        throw new BadRequestException(
          'The selected service does not belong to the selected diplomatic post.',
        );
      }

      postId =
        service.postId;

      serviceId =
        service.id;
    }

    const now =
      new Date();

    /*
     * Avoid duplicate currently valid
     * role assignments.
     */
    const existingAssignment =
      await this.prisma.userRoleAssignment.findFirst({
        where: {
          userId,

          roleId:
            role.id,

          postId,

          serviceId,

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
        },

        select: {
          id:
            true,
        },
      });

    if (
      existingAssignment
    ) {
      throw new ConflictException(
        'This user already has an active assignment for this role and scope.',
      );
    }

    const assignment =
      await this.prisma.userRoleAssignment.create({
        data: {
          userId,

          roleId:
            role.id,

          postId,

          serviceId,

          expiresAt,

          isActive:
            true,
        },

        select: {
          id:
            true,

          userId:
            true,

          postId:
            true,

          serviceId:
            true,

          isActive:
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

              scope:
                true,
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

    return {
      assignment,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | DEACTIVATE ASSIGNMENT
  |--------------------------------------------------------------------------
  */

  async deactivateAssignment(
    assignmentId: string,
    actorUserId: string,
  ) {
    const assignment =
      await this.prisma.userRoleAssignment.findUnique({
        where: {
          id:
            assignmentId,
        },

        select: {
          id:
            true,

          userId:
            true,

          isActive:
            true,

          role: {
            select: {
              code:
                true,

              name:
                true,
            },
          },
        },
      });

    if (!assignment) {
      throw new NotFoundException(
        'Role assignment not found.',
      );
    }

    /*
     * Prevent the connected platform
     * administrator from removing their own
     * administrator access accidentally.
     */
    if (
      assignment.userId ===
        actorUserId &&
      assignment.role.code ===
        SYSTEM_ROLE_CODES.PLATFORM_ADMIN
    ) {
      throw new BadRequestException(
        'You cannot deactivate your own platform administrator assignment.',
      );
    }

    if (
      assignment.isActive
    ) {
      await this.prisma.userRoleAssignment.update({
        where: {
          id:
            assignmentId,
        },

        data: {
          isActive:
            false,
        },
      });
    }

    return {
      assignmentId,

      isActive:
        false,
    };
  }
}