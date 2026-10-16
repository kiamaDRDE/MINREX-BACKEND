import {
  ConflictException,
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

import {
  CancelMentorshipRequestDto,
} from './dto/cancel-mentorship-request.dto.js';

import {
  RejectMentorshipRequestDto,
} from './dto/reject-mentorship-request.dto.js';

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
    query: ListMentorshipRequestsQueryDto,
  ) {
    return this.prisma.mentorshipRequest.findMany({
      where: query.status
        ? {
            status:
              query.status,
          }
        : {},

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
| MENTOR - LIST ASSIGNED REQUESTS
|--------------------------------------------------------------------------
*/

async findMentorRequests(
  mentorId: string,
) {
  return this.prisma.mentorshipRequest.findMany({
    where: {
      mentorId,
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

      matchedAt:
        true,

      startedAt:
        true,

      completedAt:
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
    },
  });
}

/*
|--------------------------------------------------------------------------
| MENTOR - GET ONE ASSIGNED REQUEST
|--------------------------------------------------------------------------
*/

async findMentorRequest(
  mentorId: string,
  requestId: string,
) {
  const mentorshipRequest =
    await this.prisma.mentorshipRequest.findFirst({
      where: {
        id:
          requestId,

        mentorId,
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

        history: {
          orderBy: {
            createdAt:
              'asc',
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
| MENTOR - START MENTORSHIP
|--------------------------------------------------------------------------
*/

async startMentorship(
  mentorId: string,
  requestId: string,
) {
  const mentorshipRequest =
    await this.prisma.mentorshipRequest.findFirst({
      where: {
        id:
          requestId,

        mentorId,
      },

      select: {
        id:
          true,

        status:
          true,
      },
    });

  if (!mentorshipRequest) {
    throw new NotFoundException(
      'Mentorship request not found.',
    );
  }

  if (
    mentorshipRequest.status !==
    MentorshipRequestStatus.MATCHED
  ) {
    throw new ConflictException(
      'Only matched mentorship requests can be started.',
    );
  }

  const now =
    new Date();

  return this.prisma.$transaction(
    async (tx) => {
      const result =
        await tx.mentorshipRequest.updateMany({
          where: {
            id:
              requestId,

            mentorId,

            status:
              MentorshipRequestStatus.MATCHED,
          },

          data: {
            status:
              MentorshipRequestStatus.IN_PROGRESS,

            startedAt:
              now,
          },
        });

      if (
        result.count !== 1
      ) {
        throw new ConflictException(
          'The mentorship request can no longer be started.',
        );
      }

      await tx.mentorshipRequestHistory.create({
        data: {
          requestId,

          actorId:
            mentorId,

          action:
            MentorshipHistoryAction.STARTED,

          fromStatus:
            MentorshipRequestStatus.MATCHED,

          toStatus:
            MentorshipRequestStatus.IN_PROGRESS,

          comment:
            'Mentorship started by mentor.',
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
  | MENTOR - COMPLETE MENTORSHIP
  |--------------------------------------------------------------------------
  */
  
  async completeMentorship(
    mentorId: string,
    requestId: string,
  ) {
    const mentorshipRequest =
      await this.prisma.mentorshipRequest.findFirst({
        where: {
          id:
            requestId,
  
          mentorId,
        },
  
        select: {
          id:
            true,
  
          status:
            true,
        },
      });
  
    if (!mentorshipRequest) {
      throw new NotFoundException(
        'Mentorship request not found.',
      );
    }
  
    if (
      mentorshipRequest.status !==
      MentorshipRequestStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        'Only mentorship requests in progress can be completed.',
      );
    }
  
    const now =
      new Date();
  
    return this.prisma.$transaction(
      async (tx) => {
        const result =
          await tx.mentorshipRequest.updateMany({
            where: {
              id:
                requestId,
  
              mentorId,
  
              status:
                MentorshipRequestStatus.IN_PROGRESS,
            },
  
            data: {
              status:
                MentorshipRequestStatus.COMPLETED,
  
              completedAt:
                now,
            },
          });
  
        if (
          result.count !== 1
        ) {
          throw new ConflictException(
            'The mentorship request can no longer be completed.',
          );
        }
  
        await tx.mentorshipRequestHistory.create({
          data: {
            requestId,
  
            actorId:
              mentorId,
  
            action:
              MentorshipHistoryAction.COMPLETED,
  
            fromStatus:
              MentorshipRequestStatus.IN_PROGRESS,
  
            toStatus:
              MentorshipRequestStatus.COMPLETED,
  
            comment:
              'Mentorship completed by mentor.',
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
  | CITIZEN - CANCEL OWN REQUEST
  |--------------------------------------------------------------------------
  */
  
  async cancelMyRequest(
    userId: string,
    requestId: string,
    dto: CancelMentorshipRequestDto,
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
  
          status:
            true,
        },
      });
  
    if (!mentorshipRequest) {
      throw new NotFoundException(
        'Mentorship request not found.',
      );
    }
  
    const cancellableStatuses: MentorshipRequestStatus[] = [
      MentorshipRequestStatus.SUBMITTED,
      MentorshipRequestStatus.MATCHED,
    ];
    
    if (
      !cancellableStatuses.includes(
        mentorshipRequest.status,
      )
    ) {
      throw new ConflictException(
        'This mentorship request can no longer be cancelled.',
      );
    }
  
    const previousStatus =
      mentorshipRequest.status;
  
    const now =
      new Date();
  
    return this.prisma.$transaction(
      async (tx) => {
        const result =
          await tx.mentorshipRequest.updateMany({
            where: {
              id:
                requestId,
  
              requesterId:
                userId,
  
              status:
                previousStatus,
            },
  
            data: {
              status:
                MentorshipRequestStatus.CANCELLED,
  
              cancelledAt:
                now,
            },
          });
  
        if (
          result.count !== 1
        ) {
          throw new ConflictException(
            'The mentorship request has already been updated.',
          );
        }
  
        await tx.mentorshipRequestHistory.create({
          data: {
            requestId,
  
            actorId:
              userId,
  
            action:
              MentorshipHistoryAction.CANCELLED,
  
            fromStatus:
              previousStatus,
  
            toStatus:
              MentorshipRequestStatus.CANCELLED,
  
            comment:
              dto.reason?.trim() ||
              'Mentorship request cancelled by requester.',
          },
        });
  
        return tx.mentorshipRequest.findUnique({
          where: {
            id:
              requestId,
          },
  
          include: {
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
  | ADMIN - REJECT REQUEST
  |--------------------------------------------------------------------------
  */
  
  async rejectRequest(
    actorId: string,
    requestId: string,
    dto: RejectMentorshipRequestDto,
  ) {
    const mentorshipRequest =
      await this.prisma.mentorshipRequest.findUnique({
        where: {
          id:
            requestId,
        },
  
        select: {
          id:
            true,
  
          status:
            true,
        },
      });
  
    if (!mentorshipRequest) {
      throw new NotFoundException(
        'Mentorship request not found.',
      );
    }
  
    if (
      mentorshipRequest.status !==
      MentorshipRequestStatus.SUBMITTED
    ) {
      throw new ConflictException(
        'Only submitted mentorship requests can be rejected.',
      );
    }
  
    return this.prisma.$transaction(
      async (tx) => {
        const result =
          await tx.mentorshipRequest.updateMany({
            where: {
              id:
                requestId,
  
              status:
                MentorshipRequestStatus.SUBMITTED,
            },
  
            data: {
              status:
                MentorshipRequestStatus.REJECTED,
            },
          });
  
        if (
          result.count !== 1
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
              MentorshipHistoryAction.REJECTED,
  
            fromStatus:
              MentorshipRequestStatus.SUBMITTED,
  
            toStatus:
              MentorshipRequestStatus.REJECTED,
  
            comment:
              dto.reason.trim(),
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