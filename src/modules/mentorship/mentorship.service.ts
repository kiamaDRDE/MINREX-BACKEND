import {
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

@Injectable()
export class MentorshipService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

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
}