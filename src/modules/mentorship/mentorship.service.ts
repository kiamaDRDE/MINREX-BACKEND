import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  MentorshipHistoryAction,
  MentorshipRequestStatus,
} from '../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../infrastructure/database/prisma.service.js';

import {
  CreateMentorshipRequestDto,
} from './dto/create-mentorship-request.dto.js';

import {
  ListMentorshipRequestsQueryDto,
} from './dto/list-mentorship-requests-query.dto.js';

import {
  MatchMentorshipRequestDto,
} from './dto/match-mentorship-request.dto.js';

@Injectable()
export class MentorshipService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | CITIZEN - CREATE REQUEST
  |--------------------------------------------------------------------------
  */

  async createMyRequest(
    userId: string,
    dto: CreateMentorshipRequestDto,
  ) {
    const reference =
      `MNT-${randomUUID()
        .replaceAll('-', '')
        .slice(0, 20)
        .toUpperCase()}`;

    return this.prisma.$transaction(
      async (tx) => {
        const mentorshipRequest =
          await tx.mentorshipRequest.create({
            data: {
              reference,

              requesterId:
                userId,

              topic:
                dto.topic.trim(),

              objectives:
                dto.objectives.trim(),

              status:
                MentorshipRequestStatus.SUBMITTED,
            },
          });

        await tx.mentorshipRequestHistory.create({
          data: {
            requestId:
              mentorshipRequest.id,

            actorId:
              userId,

            action:
              MentorshipHistoryAction.CREATED,

            fromStatus:
              null,

            toStatus:
              MentorshipRequestStatus.SUBMITTED,

            comment:
              'Mentorship request created.',
          },
        });

        return mentorshipRequest;
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CITIZEN - LIST OWN REQUESTS
  |--------------------------------------------------------------------------
  */

  async findMyRequests(
    userId: string,
  ) {
    return this.prisma.mentorshipRequest.findMany({
      where: {
        requesterId:
          userId,
      },

      orderBy: {
        createdAt:
          'desc',
      },

      select: {
        id:
          true,

        reference:
          true,

        topic:
          true,

        objectives:
          true,

        status:
          true,

        mentorId:
          true,

        matchedAt:
          true,

        startedAt:
          true,

        completedAt:
          true,

        cancelledAt:
          true,

        createdAt:
          true,

        updatedAt:
          true,

        mentor: {
          select: {
            id:
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
              },
            },
          },
        },
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | CITIZEN - GET OWN REQUEST
  |--------------------------------------------------------------------------
  */

  async findMyRequest(
    userId: string,
    requestId: string,
  ) {
    const mentorshipRequest =
      await this.prisma.mentorshipRequest.findFirst({
        where: {
          id:
            requestId,

          requesterId:
            userId,
        },

        select: {
          id:
            true,

          reference:
            true,

          topic:
            true,

          objectives:
            true,

          status:
            true,

          mentorId:
            true,

          matchedAt:
            true,

          startedAt:
            true,

          completedAt:
            true,

          cancelledAt:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          mentor: {
            select: {
              id:
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
                },
              },
            },
          },

          history: {
            orderBy: {
              createdAt:
                'asc',
            },

            select: {
              id:
                true,

              action:
                true,

              fromStatus:
                true,

              toStatus:
                true,

              comment:
                true,

              createdAt:
                true,
            },
          },
        },
      });

    if (!mentorshipRequest) {
      throw new NotFoundException(
        'Mentorship request not found.',
      );
    }

    return mentorshipRequest;
  }

  /*
  |--------------------------------------------------------------------------
  | ADMIN - LIST REQUESTS
  |--------------------------------------------------------------------------
  */

  async findAdminRequests(
    actorId: string,
    query: ListMentorshipRequestsQueryDto,
  ) {
    await this.assertCanManageMentorship(
      actorId,
    );

    return this.prisma.mentorshipRequest.findMany({
      where: {
        ...(query.status
          ? {
              status:
                query.status,
            }
          : {}),
      },

      orderBy: {
        createdAt:
          'desc',
      },

      select: {
        id:
          true,

        reference:
          true,

        topic:
          true,

        objectives:
          true,

        status:
          true,

        requesterId:
          true,

        mentorId:
          true,

        matchedAt:
          true,

        startedAt:
          true,

        completedAt:
          true,

        cancelledAt:
          true,

        createdAt:
          true,

        updatedAt:
          true,

        requester: {
          select: {
            id:
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
              },
            },
          },
        },

        mentor: {
          select: {
            id:
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
              },
            },
          },
        },
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | ADMIN - MATCH REQUEST WITH MENTOR
  |--------------------------------------------------------------------------
  */

  async matchRequest(
    actorId: string,
    requestId: string,
    dto: MatchMentorshipRequestDto,
  ) {
    await this.assertCanManageMentorship(
      actorId,
    );

    const request =
      await this.prisma.mentorshipRequest.findUnique({
        where: {
          id:
            requestId,
        },

        select: {
          id:
            true,

          requesterId:
            true,

          status:
            true,
        },
      });

    if (!request) {
      throw new NotFoundException(
        'Mentorship request not found.',
      );
    }

    if (
      request.status !==
      MentorshipRequestStatus.SUBMITTED
    ) {
      throw new ConflictException(
        'Only submitted mentorship requests can be matched.',
      );
    }

    if (
      request.requesterId ===
      dto.mentorId
    ) {
      throw new ConflictException(
        'The requester cannot be assigned as their own mentor.',
      );
    }

    await this.assertEligibleMentor(
      dto.mentorId,
    );

    const now =
      new Date();

    return this.prisma.$transaction(
      async (tx) => {
        const updateResult =
          await tx.mentorshipRequest.updateMany({
            where: {
              id:
                requestId,

              status:
                MentorshipRequestStatus.SUBMITTED,
            },

            data: {
              mentorId:
                dto.mentorId,

              status:
                MentorshipRequestStatus.MATCHED,

              matchedAt:
                now,
            },
          });

        if (
          updateResult.count !== 1
        ) {
          throw new ConflictException(
            'The mentorship request has already been processed.',
          );
        }

        await tx.mentorshipRequestHistory.create({
          data: {
            requestId,

            actorId,

            action:
              MentorshipHistoryAction.MATCHED,

            fromStatus:
              MentorshipRequestStatus.SUBMITTED,

            toStatus:
              MentorshipRequestStatus.MATCHED,

            comment:
              'Mentor assigned to mentorship request.',
          },
        });

        return tx.mentorshipRequest.findUnique({
          where: {
            id:
              requestId,
          },

          include: {
            requester: {
              select: {
                id:
                  true,

                profile:
                  true,
              },
            },

            mentor: {
              select: {
                id:
                  true,

                profile:
                  true,
              },
            },

            history: {
              orderBy: {
                createdAt:
                  'asc',
              },
            },
          },
        });
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PRIVATE - CHECK ADMIN ACCESS
  |--------------------------------------------------------------------------
  */

  private async assertCanManageMentorship(
    userId: string,
  ): Promise<void> {
    const now =
      new Date();

    const assignment =
      await this.prisma.userRoleAssignment.findFirst({
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

            code: {
              in: [
                'PLATFORM_ADMIN',
                'MINREX_CENTRAL_AGENT',
              ],
            },
          },
        },

        select: {
          id:
            true,
        },
      });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not authorized to manage mentorship requests.',
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PRIVATE - CHECK MENTOR ELIGIBILITY
  |--------------------------------------------------------------------------
  */

  private async assertEligibleMentor(
    mentorId: string,
  ): Promise<void> {
    const now =
      new Date();

    const assignment =
      await this.prisma.userRoleAssignment.findFirst({
        where: {
          userId:
            mentorId,

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

            code:
              'MENTOR_EXPERT',
          },
        },

        select: {
          id:
            true,
        },
      });

    if (!assignment) {
      throw new ConflictException(
        'The selected user is not an active mentor expert.',
      );
    }
  }
}