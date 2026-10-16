import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssignmentStatus,
  AssistanceCaseStatus,
  AssistanceHistoryAction,
} from '../../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import {
  AssignAssistanceCaseDto,
} from './dto/assign-assistance-case.dto.js';

import {
  CaseCommentDto,
} from './dto/case-comment.dto.js';

import {
  ListAssistanceCasesQueryDto,
} from './dto/list-assistance-cases-query.dto.js';

import {
  QualifyAssistanceCaseDto,
} from './dto/qualify-assistance-case.dto.js';

import {
  RejectAssistanceCaseDto,
} from './dto/reject-assistance-case.dto.js';

import {
  ResolveAssistanceCaseDto,
} from './dto/resolve-assistance-case.dto.js';

@Injectable()
export class AssistanceAgentService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async findCases(
    postId: string,
    query:
      ListAssistanceCasesQueryDto,
  ) {
    await this.ensurePostExists(
      postId,
    );

    const where = {
      assignedPostId:
        postId,

      ...(query.status
        ? {
            status:
              query.status,
          }
        : {}),

      ...(query.urgency
        ? {
            urgency:
              query.urgency,
          }
        : {}),
    };

    const skip =
      (query.page - 1) *
      query.limit;

    const [
      total,
      items,
    ] =
      await this.prisma.$transaction([
        this.prisma.assistanceCase.count({
          where,
        }),

        this.prisma.assistanceCase.findMany({
          where,

          skip,

          take:
            query.limit,

          orderBy: {
            createdAt:
              'desc',
          },

          select: {
            id: true,
            reference: true,
            type: true,
            urgency: true,
            status: true,
            subject: true,
            city: true,
            contactEmail: true,
            contactPhone: true,
            createdAt: true,
            updatedAt: true,
            assignedAt: true,
            resolvedAt: true,
            closedAt: true,

            country: {
              select: {
                id: true,
                iso2Code: true,
                name: true,
              },
            },

            requester: {
              select: {
                id: true,
                email: true,
                phone: true,

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
            },

            assignedToUser: {
              select: {
                id: true,
                email: true,

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
            },
          },
        }),
      ]);

    return {
      items,

      pagination: {
        page:
          query.page,

        limit:
          query.limit,

        total,

        pages:
          Math.ceil(
            total /
              query.limit,
          ),
      },
    };
  }

  async findCase(
    postId: string,
    caseId: string,
  ) {
    const assistanceCase =
      await this.prisma.assistanceCase.findFirst({
        where: {
          id:
            caseId,

          assignedPostId:
            postId,
        },

        include: {
          country:
            true,

          assignedPost: {
            select: {
              id: true,
              code: true,
              name: true,
              city: true,
              address: true,
            },
          },

          requester: {
            select: {
              id: true,
              email: true,
              phone: true,
              profile: true,
            },
          },

          assignedToUser: {
            select: {
              id: true,
              email: true,
              profile: true,
            },
          },

          history: {
            orderBy: {
              createdAt:
                'asc',
            },

            include: {
              actor: {
                select: {
                  id:
                    true,

                  email:
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
              },
            },
          },
        },
      });

    if (!assistanceCase) {
      throw new NotFoundException(
        'Assistance case not found for this diplomatic post.',
      );
    }

    return {
      case:
        assistanceCase,
    };
  }

  async qualify(
    actorId: string,
    postId: string,
    caseId: string,
    dto:
      QualifyAssistanceCaseDto,
  ) {
    const assistanceCase =
      await this.findScopedCase(
        postId,
        caseId,
      );

    if (
      assistanceCase.status !==
      AssistanceCaseStatus.SUBMITTED
    ) {
      throw new ConflictException(
        'Only a submitted assistance case can be qualified.',
      );
    }

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const result =
            await tx.assistanceCase.update({
              where: {
                id:
                  caseId,
              },

              data: {
                status:
                  AssistanceCaseStatus.QUALIFIED,

                ...(dto.urgency
                  ? {
                      urgency:
                        dto.urgency,
                    }
                  : {}),
              },
            });

          await tx.assistanceCaseHistory.create({
            data: {
              caseId,

              actorId,

              action:
                AssistanceHistoryAction.QUALIFIED,

              fromStatus:
                AssistanceCaseStatus.SUBMITTED,

              toStatus:
                AssistanceCaseStatus.QUALIFIED,

              comment:
                dto.comment ??
                null,
            },
          });

          return result;
        },
      );

    return {
      case:
        updated,
    };
  }

  async assign(
    actorId: string,
    postId: string,
    caseId: string,
    dto:
      AssignAssistanceCaseDto,
  ) {
    const assistanceCase =
      await this.findScopedCase(
        postId,
        caseId,
      );

    if (
      assistanceCase.status !==
      AssistanceCaseStatus.QUALIFIED
    ) {
      throw new ConflictException(
        'Only a qualified assistance case can be assigned.',
      );
    }

    await this.ensureAgentBelongsToPost(
      dto.agentUserId,
      postId,
    );

    const now =
      new Date();

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const result =
            await tx.assistanceCase.update({
              where: {
                id:
                  caseId,
              },

              data: {
                status:
                  AssistanceCaseStatus.ASSIGNED,

                assignedToUserId:
                  dto.agentUserId,

                assignedAt:
                  now,
              },
            });

          await tx.assistanceCaseHistory.create({
            data: {
              caseId,

              actorId,

              action:
                AssistanceHistoryAction.ASSIGNED,

              fromStatus:
                AssistanceCaseStatus.QUALIFIED,

              toStatus:
                AssistanceCaseStatus.ASSIGNED,

              comment:
                dto.comment ??
                `Assigned to agent ${dto.agentUserId}.`,
            },
          });

          return result;
        },
      );

    return {
      case:
        updated,
    };
  }

  async startProgress(
    actorId: string,
    postId: string,
    caseId: string,
    dto:
      CaseCommentDto,
  ) {
    const assistanceCase =
      await this.findScopedCase(
        postId,
        caseId,
      );

    if (
      assistanceCase.status !==
      AssistanceCaseStatus.ASSIGNED
    ) {
      throw new ConflictException(
        'Only an assigned assistance case can be started.',
      );
    }

    if (
      !assistanceCase.assignedToUserId
    ) {
      throw new ConflictException(
        'The assistance case has no assigned agent.',
      );
    }

    return this.changeStatus(
      actorId,
      assistanceCase.id,
      AssistanceCaseStatus.ASSIGNED,
      AssistanceCaseStatus.IN_PROGRESS,
      AssistanceHistoryAction.STATUS_CHANGED,
      dto.comment ??
        'Assistance case processing started.',
    );
  }

  async resolve(
    actorId: string,
    postId: string,
    caseId: string,
    dto:
      ResolveAssistanceCaseDto,
  ) {
    const assistanceCase =
      await this.findScopedCase(
        postId,
        caseId,
      );

    if (
      assistanceCase.status !==
      AssistanceCaseStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        'Only an assistance case in progress can be resolved.',
      );
    }

    const now =
      new Date();

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const result =
            await tx.assistanceCase.update({
              where: {
                id:
                  caseId,
              },

              data: {
                status:
                  AssistanceCaseStatus.RESOLVED,

                resolutionSummary:
                  dto.resolutionSummary.trim(),

                resolvedAt:
                  now,
              },
            });

          await tx.assistanceCaseHistory.create({
            data: {
              caseId,

              actorId,

              action:
                AssistanceHistoryAction.RESOLVED,

              fromStatus:
                AssistanceCaseStatus.IN_PROGRESS,

              toStatus:
                AssistanceCaseStatus.RESOLVED,

              comment:
                dto.resolutionSummary.trim(),
            },
          });

          return result;
        },
      );

    return {
      case:
        updated,
    };
  }

  async close(
    actorId: string,
    postId: string,
    caseId: string,
    dto:
      CaseCommentDto,
  ) {
    const assistanceCase =
      await this.findScopedCase(
        postId,
        caseId,
      );

    if (
      assistanceCase.status !==
      AssistanceCaseStatus.RESOLVED
    ) {
      throw new ConflictException(
        'Only a resolved assistance case can be closed.',
      );
    }

    const now =
      new Date();

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const result =
            await tx.assistanceCase.update({
              where: {
                id:
                  caseId,
              },

              data: {
                status:
                  AssistanceCaseStatus.CLOSED,

                closedAt:
                  now,
              },
            });

          await tx.assistanceCaseHistory.create({
            data: {
              caseId,

              actorId,

              action:
                AssistanceHistoryAction.CLOSED,

              fromStatus:
                AssistanceCaseStatus.RESOLVED,

              toStatus:
                AssistanceCaseStatus.CLOSED,

              comment:
                dto.comment ??
                'Assistance case closed.',
            },
          });

          return result;
        },
      );

    return {
      case:
        updated,
    };
  }

  async reject(
    actorId: string,
    postId: string,
    caseId: string,
    dto:
      RejectAssistanceCaseDto,
  ) {
    const assistanceCase =
      await this.findScopedCase(
        postId,
        caseId,
      );

    if (
      assistanceCase.status !==
        AssistanceCaseStatus.SUBMITTED &&
      assistanceCase.status !==
        AssistanceCaseStatus.QUALIFIED
    ) {
      throw new ConflictException(
        'Only a submitted or qualified assistance case can be rejected.',
      );
    }

    const fromStatus =
      assistanceCase.status;

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const result =
            await tx.assistanceCase.update({
              where: {
                id:
                  caseId,
              },

              data: {
                status:
                  AssistanceCaseStatus.REJECTED,
              },
            });

          await tx.assistanceCaseHistory.create({
            data: {
              caseId,

              actorId,

              action:
                AssistanceHistoryAction.REJECTED,

              fromStatus,

              toStatus:
                AssistanceCaseStatus.REJECTED,

              comment:
                dto.reason.trim(),
            },
          });

          return result;
        },
      );

    return {
      case:
        updated,
    };
  }

  private async changeStatus(
    actorId: string,
    caseId: string,
    fromStatus:
      AssistanceCaseStatus,
    toStatus:
      AssistanceCaseStatus,
    action:
      AssistanceHistoryAction,
    comment:
      string,
  ) {
    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const result =
            await tx.assistanceCase.update({
              where: {
                id:
                  caseId,
              },

              data: {
                status:
                  toStatus,
              },
            });

          await tx.assistanceCaseHistory.create({
            data: {
              caseId,
              actorId,
              action,
              fromStatus,
              toStatus,
              comment,
            },
          });

          return result;
        },
      );

    return {
      case:
        updated,
    };
  }

  private async ensurePostExists(
    postId: string,
  ) {
    const post =
      await this.prisma.diplomaticPost.findUnique({
        where: {
          id:
            postId,
        },

        select: {
          id:
            true,
        },
      });

    if (!post) {
      throw new NotFoundException(
        'Diplomatic post not found.',
      );
    }
  }

  private async findScopedCase(
    postId: string,
    caseId: string,
  ) {
    const assistanceCase =
      await this.prisma.assistanceCase.findFirst({
        where: {
          id:
            caseId,

          assignedPostId:
            postId,
        },

        select: {
          id: true,
          status: true,
          assignedPostId: true,
          assignedToUserId: true,
        },
      });

    if (!assistanceCase) {
      throw new NotFoundException(
        'Assistance case not found for this diplomatic post.',
      );
    }

    return assistanceCase;
  }

  private async ensureAgentBelongsToPost(
    agentUserId: string,
    postId: string,
  ) {
    const assignment =
      await this.prisma.userPostAssignment.findFirst({
        where: {
          userId:
            agentUserId,

          postId,

          status:
            AssignmentStatus.ACTIVE,
        },

        select: {
          id:
            true,
        },
      });

    if (!assignment) {
      throw new BadRequestException(
        'The selected agent is not actively assigned to this diplomatic post.',
      );
    }
  }
}