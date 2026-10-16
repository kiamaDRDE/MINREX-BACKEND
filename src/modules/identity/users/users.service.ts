import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  Prisma,
} from '../../../generated/prisma/client.js';

import {
  UserStatus,
} from '../../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import {
  ListUsersQueryDto,
} from './dto/list-users-query.dto.js';

import {
  UpdateUserDto,
} from './dto/update-user.dto.js';

import {
  UpdateUserStatusDto,
} from './dto/update-user-status.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | LIST USERS
  |--------------------------------------------------------------------------
  */

  async findAll(
    query:
      ListUsersQueryDto,
  ) {
    const page =
      query.page ?? 1;

    const limit =
      query.limit ?? 20;

    const skip =
      (page - 1) *
      limit;

    const search =
      query.search
        ?.trim();

    const where:
      Prisma.UserWhereInput = {
        ...(query.status
          ? {
              status:
                query.status,
            }
          : {}),

        ...(search
          ? {
              OR: [
                {
                  email: {
                    contains:
                      search,

                    mode:
                      'insensitive',
                  },
                },

                {
                  username: {
                    contains:
                      search,

                    mode:
                      'insensitive',
                  },
                },

                {
                  phone: {
                    contains:
                      search,
                  },
                },

                {
                  profile: {
                    is: {
                      OR: [
                        {
                          firstName: {
                            contains:
                              search,

                            mode:
                              'insensitive',
                          },
                        },

                        {
                          lastName: {
                            contains:
                              search,

                            mode:
                              'insensitive',
                          },
                        },

                        {
                          displayName: {
                            contains:
                              search,

                            mode:
                              'insensitive',
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      };

    const now =
      new Date();

    const activeRoleAssignmentWhere:
      Prisma.UserRoleAssignmentWhereInput =
      {
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
      };

    const userSelect = {
      id:
        true,

      email:
        true,

      username:
        true,

      phone:
        true,

      status:
        true,

      emailVerifiedAt:
        true,

      phoneVerifiedAt:
        true,

      lastLoginAt:
        true,

      createdAt:
        true,

      updatedAt:
        true,

      profile: {
        select: {
          firstName:
            true,

          lastName:
            true,

          displayName:
            true,

          photoUrl:
            true,

          preferredLanguage:
            true,
        },
      },

      roleAssignments: {
        where:
          activeRoleAssignmentWhere,

        select: {
          id:
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
      },
    } satisfies Prisma.UserSelect;

    const [
      total,
      users,
    ] =
      await this.prisma.$transaction([
        this.prisma.user.count({
          where,
        }),

        this.prisma.user.findMany({
          where,

          select:
            userSelect,

          orderBy: {
            createdAt:
              'desc',
          },

          skip,

          take:
            limit,
        }),
      ]);

    return {
      items:
        users,

      pagination: {
        page,

        limit,

        total,

        totalPages:
          total === 0
            ? 0
            : Math.ceil(
                total /
                  limit,
              ),
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | GET ONE USER
  |--------------------------------------------------------------------------
  */

  async findOne(
    userId: string,
  ) {
    const now =
      new Date();

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

          phone:
            true,

          status:
            true,

          emailVerifiedAt:
            true,

          phoneVerifiedAt:
            true,

          lastLoginAt:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          profile: {
            select: {
              firstName:
                true,

              lastName:
                true,

              displayName:
                true,

              photoUrl:
                true,

              preferredLanguage:
                true,

              createdAt:
                true,

              updatedAt:
                true,
            },
          },

          roleAssignments: {
            where: {
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
          },
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    return {
      user,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE USER
  |--------------------------------------------------------------------------
  */

  async update(
    userId: string,
    dto: UpdateUserDto,
  ) {
    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          id:
            true,

          username:
            true,

          profile: {
            select: {
              id:
                true,

              firstName:
                true,

              lastName:
                true,
            },
          },
        },
      });

    if (!existingUser) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    /*
     * Username is unique and can also be
     * used for authentication.
     */
    if (
      dto.username &&
      dto.username !==
        existingUser.username
    ) {
      const userWithUsername =
        await this.prisma.user.findUnique({
          where: {
            username:
              dto.username,
          },

          select: {
            id:
              true,
          },
        });

      if (
        userWithUsername &&
        userWithUsername.id !==
          userId
      ) {
        throw new ConflictException(
          'This username is already taken.',
        );
      }
    }

    const userData:
      Prisma.UserUpdateInput = {};

    if (
      dto.username !==
      undefined
    ) {
      userData.username =
        dto.username;
    }

    if (
      dto.phone !==
      undefined
    ) {
      userData.phone =
        dto.phone === ''
          ? null
          : dto.phone;
    }

    const hasProfileUpdate =
      dto.firstName !==
        undefined ||
      dto.lastName !==
        undefined ||
      dto.displayName !==
        undefined ||
      dto.photoUrl !==
        undefined ||
      dto.preferredLanguage !==
        undefined;

    await this.prisma.$transaction(
      async (transaction) => {
        if (
          Object.keys(
            userData,
          ).length > 0
        ) {
          await transaction.user.update({
            where: {
              id:
                userId,
            },

            data:
              userData,
          });
        }

        if (
          hasProfileUpdate
        ) {
          if (
            existingUser.profile
          ) {
            const profileData:
              Prisma.UserProfileUpdateInput =
              {};

            if (
              dto.firstName !==
              undefined
            ) {
              profileData.firstName =
                dto.firstName;
            }

            if (
              dto.lastName !==
              undefined
            ) {
              profileData.lastName =
                dto.lastName;
            }

            if (
              dto.displayName !==
              undefined
            ) {
              profileData.displayName =
                dto.displayName === ''
                  ? null
                  : dto.displayName;
            }

            if (
              dto.photoUrl !==
              undefined
            ) {
              profileData.photoUrl =
                dto.photoUrl === ''
                  ? null
                  : dto.photoUrl;
            }

            if (
              dto.preferredLanguage !==
              undefined
            ) {
              profileData.preferredLanguage =
                dto.preferredLanguage;
            }

            await transaction.userProfile.update({
              where: {
                userId,
              },

              data:
                profileData,
            });
          } else {
            /*
             * Defensive handling:
             *
             * Every registered MINREX user should
             * normally have a profile.
             */
            if (
              !dto.firstName ||
              !dto.lastName
            ) {
              throw new BadRequestException(
                'First name and last name are required to create the missing user profile.',
              );
            }

            await transaction.userProfile.create({
              data: {
                userId,

                firstName:
                  dto.firstName,

                lastName:
                  dto.lastName,

                displayName:
                  dto.displayName ??
                  null,

                photoUrl:
                  dto.photoUrl ??
                  null,

                ...(dto.preferredLanguage
                  ? {
                      preferredLanguage:
                        dto.preferredLanguage,
                    }
                  : {}),
              },
            });
          }
        }
      },
    );

    return this.findOne(
      userId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE USER STATUS
  |--------------------------------------------------------------------------
  */

  async updateStatus(
    userId: string,
    actorUserId: string,
    dto:
      UpdateUserStatusDto,
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

          status:
            true,

          emailVerifiedAt:
            true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    /*
     * Prevent an administrator from
     * accidentally locking themselves out.
     */
    if (
      userId ===
        actorUserId &&
      dto.status !==
        UserStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'You cannot suspend or disable your own account.',
      );
    }

    /*
     * An account without a verified email
     * must not be activated manually.
     */
    if (
      dto.status ===
        UserStatus.ACTIVE &&
      !user.emailVerifiedAt
    ) {
      throw new BadRequestException(
        'A user cannot be activated before email verification.',
      );
    }

    /*
     * Nothing to change.
     */
    if (
      user.status ===
      dto.status
    ) {
      return this.findOne(
        userId,
      );
    }

    const now =
      new Date();

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.user.update({
          where: {
            id:
              userId,
          },

          data: {
            status:
              dto.status,
          },
        });

        /*
         * Suspending or disabling an account
         * immediately revokes all active sessions.
         *
         * Therefore existing JWT sessions cannot
         * continue accessing protected endpoints.
         */
        if (
          dto.status ===
            UserStatus.SUSPENDED ||
          dto.status ===
            UserStatus.DISABLED
        ) {
          await transaction.authSession.updateMany({
            where: {
              userId,

              revokedAt:
                null,
            },

            data: {
              revokedAt:
                now,

              lastUsedAt:
                now,
            },
          });
        }
      },
    );

    return this.findOne(
      userId,
    );
  }
}