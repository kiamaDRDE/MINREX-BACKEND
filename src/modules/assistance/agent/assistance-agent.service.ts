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
  AssistanceUrgency,
} from '../../../generated/prisma/enums.js';

import type { Prisma } from '../../../generated/prisma/client.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import {
  AdvanceStepDto,
} from './dto/advance-step.dto.js';

import {
  AssignAssistanceCaseDto,
} from './dto/assign-assistance-case.dto.js';

import {
  CaseCommentDto,
} from './dto/case-comment.dto.js';

import {
  EscalateAssistanceCaseDto,
} from './dto/escalate-assistance-case.dto.js';

import {
  ListAdminAssistanceCasesQueryDto,
} from './dto/list-admin-assistance-cases-query.dto.js';

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

import {
  NotificationEventBusService,
} from '../../notifications/services/notification-event-bus.service.js';

import {
  PROTOCOL_CATEGORY_INCLUDE,
} from '../protocols/assistance-protocols.service.js';

@Injectable()
export class AssistanceAgentService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly notifications:
      NotificationEventBusService,
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
            categoryId: true,
            urgency: true,
            status: true,
            subject: true,
            description: true,
            city: true,
            address: true,
            contactEmail: true,
            contactPhone: true,
            assignedPostId: true,
            assignedToUserId: true,
            currentStepNumber: true,
            escalatedToCentralAt: true,
            escalatedByUserId: true,
            escalationReason: true,
            resolutionSummary: true,
            createdAt: true,
            updatedAt: true,
            assignedAt: true,
            resolvedAt: true,
            closedAt: true,

            category: {
              include: PROTOCOL_CATEGORY_INCLUDE,
            },

            assignedPost: {
              select: {
                id: true,
                code: true,
                name: true,
                city: true,
              },
            },

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

            history: {
              orderBy: { createdAt: 'asc' },
              include: {
                actor: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        firstName: true,
                        lastName: true,
                        displayName: true,
                      },
                    },
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
          category: {
            include: PROTOCOL_CATEGORY_INCLUDE,
          },

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

          await this.notifications.emitToUser(
            assistanceCase.requesterId,
            {
              type: 'ASSISTANCE_STATUS',
          
              title: 'Demande qualifiée',
          
              message:
                'Votre demande d’assistance a été qualifiée.',
          
              priority: 'NORMAL',
          
              actionUrl: '/espace/assistance',
            },
            tx,
          );

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

      await this.notifications.emitToUser(
        dto.agentUserId,
        {
          type: 'ASSISTANCE_STATUS',
      
          title: 'Nouveau dossier affecté',
      
          message:
            'Un dossier d’assistance vous a été affecté.',
      
          priority: 'HIGH',
      
          actionUrl: '/agent-consulaire',
        },
        tx,
      );
      
      await this.notifications.emitToUser(
        assistanceCase.requesterId,
        {
          type: 'ASSISTANCE_STATUS',
      
          title: 'Agent affecté',
      
          message:
            'Un agent consulaire a été affecté à votre demande.',
      
          priority: 'NORMAL',
      
          actionUrl: '/espace/assistance',
        },
        tx,
      );

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
      assistanceCase.requesterId,
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

          await this.notifications.emitToUser(
            assistanceCase.requesterId,
            {
              type: 'ASSISTANCE_STATUS',
          
              title: 'Demande résolue',
          
              message:
                'Votre demande d’assistance a été résolue.',
          
              priority: 'HIGH',
          
              actionUrl: '/espace/assistance',
            },
            tx,
          );

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


          await this.notifications.emitToUser(
            assistanceCase.requesterId,
            {
              type: 'ASSISTANCE_STATUS',
          
              title: 'Demande clôturée',
          
              message:
                'Votre dossier d’assistance a été clôturé.',
          
              priority: 'NORMAL',
          
              actionUrl: '/espace/assistance',
            },
            tx,
          );

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

          await this.notifications.emitToUser(
            assistanceCase.requesterId,
            {
              type: 'ASSISTANCE_STATUS',
          
              title: 'Demande rejetée',
          
              message:
                'Votre demande d’assistance a été rejetée. Consultez le motif dans votre espace.',
          
              priority: 'HIGH',
          
              actionUrl: '/espace/assistance',
            },
            tx,
          );

          return result;
        },
      );

    return {
      case:
        updated,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | GLOBAL ADMIN / CENTRAL SUPERVISION & PERSISTENT CASE ACTIONS (OPTION A)
  |--------------------------------------------------------------------------
  */

  async findAllCases(query: ListAdminAssistanceCasesQueryDto) {
    const where: Prisma.AssistanceCaseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.urgency ? { urgency: query.urgency } : {}),
      ...(query.postId ? { assignedPostId: query.postId } : {}),
      ...(query.escalatedOnly ? { escalatedToCentralAt: { not: null } } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { subject: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
              {
                country: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                assignedPost: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                requester: {
                  OR: [
                    { email: { contains: query.search, mode: 'insensitive' } },
                    {
                      profile: {
                        displayName: {
                          contains: query.search,
                          mode: 'insensitive',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.assistanceCase.count({ where }),
      this.prisma.assistanceCase.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ escalatedToCentralAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          category: { include: PROTOCOL_CATEGORY_INCLUDE },
          country: {
            select: { id: true, iso2Code: true, iso3Code: true, name: true },
          },
          assignedPost: {
            select: { id: true, code: true, name: true, city: true, address: true },
          },
          requester: {
            select: {
              id: true,
              email: true,
              phone: true,
              profile: {
                select: { firstName: true, lastName: true, displayName: true },
              },
            },
          },
          assignedToUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: { firstName: true, lastName: true, displayName: true },
              },
            },
          },
          escalatedByUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: { firstName: true, lastName: true, displayName: true },
              },
            },
          },
          history: {
            orderBy: { createdAt: 'asc' },
            include: {
              actor: {
                select: {
                  id: true,
                  email: true,
                  profile: {
                    select: { firstName: true, lastName: true, displayName: true },
                  },
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
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findCaseById(caseId: string) {
    const assistanceCase = await this.prisma.assistanceCase.findUnique({
      where: { id: caseId },
      include: {
        category: { include: PROTOCOL_CATEGORY_INCLUDE },
        country: true,
        assignedPost: {
          select: { id: true, code: true, name: true, city: true, address: true },
        },
        requester: {
          select: { id: true, email: true, phone: true, profile: true },
        },
        assignedToUser: {
          select: { id: true, email: true, profile: true },
        },
        escalatedByUser: {
          select: { id: true, email: true, profile: true },
        },
        history: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: { firstName: true, lastName: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!assistanceCase) {
      throw new NotFoundException('Assistance case not found.');
    }

    return { case: assistanceCase };
  }

  async addNote(
    actorId: string,
    caseId: string,
    dto: CaseCommentDto,
    scopedPostId?: string,
  ) {
    const comment = dto.comment?.trim();
    if (!comment) {
      throw new BadRequestException('A consular note cannot be empty.');
    }

    const existing = await this.prisma.assistanceCase.findFirst({
      where: {
        id: caseId,
        ...(scopedPostId ? { assignedPostId: scopedPostId } : {}),
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('Assistance case not found.');
    }

    await this.prisma.assistanceCaseHistory.create({
      data: {
        caseId: existing.id,
        actorId,
        action: AssistanceHistoryAction.NOTE_ADDED,
        fromStatus: existing.status,
        toStatus: existing.status,
        comment,
      },
    });

    return this.findCaseById(existing.id);
  }

  async advanceStep(
    actorId: string,
    caseId: string,
    dto: AdvanceStepDto,
    scopedPostId?: string,
  ) {
    const existing = await this.prisma.assistanceCase.findFirst({
      where: {
        id: caseId,
        ...(scopedPostId ? { assignedPostId: scopedPostId } : {}),
      },
      include: {
        category: { include: PROTOCOL_CATEGORY_INCLUDE },
      },
    });

    if (!existing) {
      throw new NotFoundException('Assistance case not found.');
    }

    if (
      existing.status === AssistanceCaseStatus.CLOSED ||
      existing.status === AssistanceCaseStatus.REJECTED
    ) {
      throw new ConflictException(
        'Cannot advance protocol steps on a closed or rejected case.',
      );
    }

    const totalSteps = existing.category?.steps.length ?? 4;
    const validatedStep = dto.stepNumber ?? existing.currentStepNumber;
    const isFinalStep = validatedStep >= totalSteps;
    const nextStepNumber = isFinalStep
      ? totalSteps
      : Math.min(validatedStep + 1, totalSteps);
    const stepObj = existing.category?.steps.find(
      (s) => s.stepNumber === validatedStep,
    );

    const nextStatus = isFinalStep
      ? AssistanceCaseStatus.RESOLVED
      : existing.status === AssistanceCaseStatus.SUBMITTED ||
          existing.status === AssistanceCaseStatus.QUALIFIED ||
          existing.status === AssistanceCaseStatus.ASSIGNED
        ? AssistanceCaseStatus.IN_PROGRESS
        : existing.status;

    const noteText =
      dto.comment?.trim() ||
      `Étape ${validatedStep} validée${stepObj ? ` : ${stepObj.title}` : ''}.`;

    await this.prisma.$transaction(async (tx) => {
      await tx.assistanceCase.update({
        where: { id: existing.id },
        data: {
          currentStepNumber: nextStepNumber,
          status: nextStatus,
          ...(isFinalStep
            ? {
                resolvedAt: new Date(),
                resolutionSummary:
                  existing.resolutionSummary ??
                  `Protocole complété (étape ${validatedStep}/${totalSteps}).`,
              }
            : {}),
        },
      });

      await tx.assistanceCaseHistory.create({
        data: {
          caseId: existing.id,
          actorId,
          action: isFinalStep
            ? AssistanceHistoryAction.RESOLVED
            : AssistanceHistoryAction.UPDATED,
          fromStatus: existing.status,
          toStatus: nextStatus,
          comment: noteText,
        },
      });

      await this.notifications.emitToUser(
        existing.requesterId,
        {
          type: 'ASSISTANCE_STATUS',
          title: isFinalStep
            ? 'Demande d’assistance résolue'
            : 'Progression de votre dossier d’assistance',
          message: noteText,
          priority: isFinalStep ? 'HIGH' : 'NORMAL',
          actionUrl: '/espace/assistance',
        },
        tx,
      );
    });

    return this.findCaseById(existing.id);
  }

  async escalateCase(
    actorId: string,
    caseId: string,
    dto: EscalateAssistanceCaseDto,
    scopedPostId?: string,
  ) {
    const existing = await this.prisma.assistanceCase.findFirst({
      where: {
        id: caseId,
        ...(scopedPostId ? { assignedPostId: scopedPostId } : {}),
      },
      select: {
        id: true,
        reference: true,
        subject: true,
        status: true,
        requesterId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Assistance case not found.');
    }

    if (
      existing.status === AssistanceCaseStatus.CLOSED ||
      existing.status === AssistanceCaseStatus.REJECTED
    ) {
      throw new ConflictException(
        'Cannot escalate a closed or rejected assistance case.',
      );
    }

    const now = new Date();
    const targetUrgency = dto.urgency ?? AssistanceUrgency.CRITICAL;
    const reason = dto.reason.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.assistanceCase.update({
        where: { id: existing.id },
        data: {
          urgency: targetUrgency,
          escalatedToCentralAt: now,
          escalatedByUserId: actorId,
          escalationReason: reason,
        },
      });

      await tx.assistanceCaseHistory.create({
        data: {
          caseId: existing.id,
          actorId,
          action: AssistanceHistoryAction.ESCALATED,
          fromStatus: existing.status,
          toStatus: existing.status,
          comment: `Escalade au niveau central MINREX : ${reason}`,
        },
      });

      await this.notifications.emitToGlobalRole(
        ['MINREX_CENTRAL_AGENT', 'PLATFORM_ADMIN'],
        {
          type: 'ASSISTANCE_STATUS',
          title: `Escalade critique : ${existing.reference}`,
          message: `${existing.subject} — Motif : ${reason}`,
          priority: 'URGENT',
          actionUrl: '/assistance',
        },
        tx,
      );
    });

    return this.findCaseById(existing.id);
  }

  async resolveCaseAdmin(
    actorId: string,
    caseId: string,
    dto: ResolveAssistanceCaseDto,
  ) {
    const existing = await this.prisma.assistanceCase.findUnique({
      where: { id: caseId },
      include: { category: { include: PROTOCOL_CATEGORY_INCLUDE } },
    });

    if (!existing) {
      throw new NotFoundException('Assistance case not found.');
    }

    if (
      existing.status === AssistanceCaseStatus.CLOSED ||
      existing.status === AssistanceCaseStatus.REJECTED
    ) {
      throw new ConflictException(
        'Closed or rejected assistance cases cannot be resolved.',
      );
    }

    const now = new Date();
    const totalSteps = existing.category?.steps.length ?? existing.currentStepNumber;

    await this.prisma.$transaction(async (tx) => {
      await tx.assistanceCase.update({
        where: { id: existing.id },
        data: {
          status: AssistanceCaseStatus.RESOLVED,
          resolutionSummary: dto.resolutionSummary.trim(),
          resolvedAt: now,
          currentStepNumber: totalSteps,
        },
      });

      await tx.assistanceCaseHistory.create({
        data: {
          caseId: existing.id,
          actorId,
          action: AssistanceHistoryAction.RESOLVED,
          fromStatus: existing.status,
          toStatus: AssistanceCaseStatus.RESOLVED,
          comment: dto.resolutionSummary.trim(),
        },
      });

      await this.notifications.emitToUser(
        existing.requesterId,
        {
          type: 'ASSISTANCE_STATUS',
          title: 'Demande résolue',
          message: 'Votre demande d’assistance a été résolue par les services du MINREX.',
          priority: 'HIGH',
          actionUrl: '/espace/assistance',
        },
        tx,
      );
    });

    return this.findCaseById(existing.id);
  }

  async closeCaseAdmin(
    actorId: string,
    caseId: string,
    dto: CaseCommentDto,
  ) {
    const existing = await this.prisma.assistanceCase.findUnique({
      where: { id: caseId },
      select: { id: true, status: true, requesterId: true },
    });

    if (!existing) {
      throw new NotFoundException('Assistance case not found.');
    }

    if (existing.status === AssistanceCaseStatus.CLOSED) {
      throw new ConflictException('Assistance case is already closed.');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.assistanceCase.update({
        where: { id: existing.id },
        data: {
          status: AssistanceCaseStatus.CLOSED,
          closedAt: now,
        },
      });

      await tx.assistanceCaseHistory.create({
        data: {
          caseId: existing.id,
          actorId,
          action: AssistanceHistoryAction.CLOSED,
          fromStatus: existing.status,
          toStatus: AssistanceCaseStatus.CLOSED,
          comment: dto.comment?.trim() || 'Dossier clôturé par supervision MINREX.',
        },
      });

      await this.notifications.emitToUser(
        existing.requesterId,
        {
          type: 'ASSISTANCE_STATUS',
          title: 'Dossier clôturé',
          message: 'Votre dossier d’assistance consulaire a été clôturé.',
          priority: 'NORMAL',
          actionUrl: '/espace/assistance',
        },
        tx,
      );
    });

    return this.findCaseById(existing.id);
  }

  private async changeStatus(
    actorId: string,
    caseId: string,
    requesterId: string,
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

          await this.notifications.emitToUser(
            requesterId,
            {
              type: 'ASSISTANCE_STATUS',
          
              title: 'Demande en cours de traitement',
          
              message:
                'Votre demande est maintenant en cours de traitement.',
          
              priority: 'NORMAL',
          
              actionUrl: '/espace/assistance',
            },
            tx,
          );

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
          requesterId: true,
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