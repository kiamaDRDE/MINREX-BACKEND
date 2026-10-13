import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  AssistanceCaseStatus,
  AssistanceHistoryAction,
  AssistanceUrgency,
  DiplomaticPostStatus,
} from '../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../infrastructure/database/prisma.service.js';

import {
  CreateAssistanceCaseDto,
} from './dto/create-assistance-case.dto.js';

@Injectable()
export class AssistanceService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Create assistance request
  |--------------------------------------------------------------------------
  */

  async createMyCase(
    userId: string,
    dto:
      CreateAssistanceCaseDto,
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

          phone:
            true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Validate country
    |--------------------------------------------------------------------------
    */

    const country =
      await this.prisma.country.findUnique({
        where: {
          id:
            dto.countryId,
        },

        select: {
          id:
            true,

          name:
            true,

          isActive:
            true,
        },
      });

    if (
      !country ||
      !country.isActive
    ) {
      throw new BadRequestException(
        'The selected country is invalid or inactive.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Find diplomatic coverage
    |--------------------------------------------------------------------------
    */

    const now =
      new Date();

    const coverages =
      await this.prisma.postCoverage.findMany({
        where: {
          countryId:
            dto.countryId,

          startDate: {
            lte:
              now,
          },

          OR: [
            {
              endDate:
                null,
            },

            {
              endDate: {
                gte:
                  now,
              },
            },
          ],

          post: {
            status:
              DiplomaticPostStatus.ACTIVE,
          },
        },

        select: {
          postId:
            true,

          startDate:
            true,

          post: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,

              city:
                true,
            },
          },
        },

        orderBy: {
          startDate:
            'desc',
        },
      });

    if (
      coverages.length ===
      0
    ) {
      throw new BadRequestException(
        'No active diplomatic post currently covers this country.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Do not guess between several competent posts
    |--------------------------------------------------------------------------
    */

    const uniquePostIds = [
      ...new Set(
        coverages.map(
          (coverage) =>
            coverage.postId,
        ),
      ),
    ];

    if (
      uniquePostIds.length >
      1
    ) {
      throw new ConflictException(
        'Several diplomatic posts currently cover this country. The diplomatic network configuration must be reviewed.',
      );
    }

    const assignedPostId =
      uniquePostIds[0];

    if (!assignedPostId) {
      throw new BadRequestException(
        'Unable to determine the competent diplomatic post.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Create case + history atomically
    |--------------------------------------------------------------------------
    */

    const reference =
      this.generateReference();

    const assistanceCase =
      await this.prisma.$transaction(
        async (tx) => {
          const created =
            await tx.assistanceCase.create({
              data: {
                reference,

                requesterId:
                  userId,

                type:
                  dto.type,

                urgency:
                  dto.urgency ??
                  AssistanceUrgency.NORMAL,

                status:
                  AssistanceCaseStatus.SUBMITTED,

                subject:
                  dto.subject,

                description:
                  dto.description,

                countryId:
                  dto.countryId,

                city:
                  dto.city ??
                  null,

                address:
                  dto.address ??
                  null,

                contactEmail:
                  dto.contactEmail ??
                  user.email ??
                  null,

                contactPhone:
                  dto.contactPhone ??
                  user.phone ??
                  null,

                assignedPostId,

                routedAt:
                  now,
              },

              include: {
                country: {
                  select: {
                    id:
                      true,

                    iso2Code:
                      true,

                    iso3Code:
                      true,

                    name:
                      true,
                  },
                },

                assignedPost: {
                  select: {
                    id:
                      true,

                    code:
                      true,

                    name:
                      true,

                    city:
                      true,
                  },
                },
              },
            });

          await tx.assistanceCaseHistory.create({
            data: {
              caseId:
                created.id,

              actorId:
                userId,

              action:
                AssistanceHistoryAction.CREATED,

              fromStatus:
                null,

              toStatus:
                AssistanceCaseStatus.SUBMITTED,

              comment:
                'Assistance request created and routed to the competent diplomatic post.',
            },
          });

          return created;
        },
      );

    return {
      case:
        assistanceCase,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | My cases
  |--------------------------------------------------------------------------
  */

  async findMyCases(
    userId: string,
  ) {
    const items =
      await this.prisma.assistanceCase.findMany({
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

          type:
            true,

          urgency:
            true,

          status:
            true,

          subject:
            true,

          city:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          resolvedAt:
            true,

          closedAt:
            true,

          country: {
            select: {
              id:
                true,

              iso2Code:
                true,

              name:
                true,
            },
          },

          assignedPost: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,

              city:
                true,
            },
          },
        },
      });

    return {
      items,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | One of my cases
  |--------------------------------------------------------------------------
  */

  async findMyCase(
    userId: string,
    caseId: string,
  ) {
    const assistanceCase =
      await this.prisma.assistanceCase.findFirst({
        where: {
          id:
            caseId,

          requesterId:
            userId,
        },

        include: {
          country:
            true,

          assignedPost: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,

              city:
                true,

              address:
                true,
            },
          },

          assignedToUser: {
            select: {
              id:
                true,

              profile: {
                select: {
                  displayName:
                    true,

                  firstName:
                    true,

                  lastName:
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

    if (!assistanceCase) {
      throw new NotFoundException(
        'Assistance case not found.',
      );
    }

    return {
      case:
        assistanceCase,
    };
  }

  private generateReference() {
    return `AST-${randomUUID()
      .replaceAll('-', '')
      .toUpperCase()}`;
  }
}