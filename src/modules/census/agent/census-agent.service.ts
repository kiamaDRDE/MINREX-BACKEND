import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssignmentStatus,
  CensusReviewDecision,
  CensusStatus,
} from '../../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import {
  AssignCensusRecordDto,
} from './dto/assign-census-record.dto.js';

import {
  ListCensusRecordsQueryDto,
} from './dto/list-census-records-query.dto.js';

import {
  RejectCensusDto,
} from './dto/reject-census.dto.js';

import {
  RequestCorrectionDto,
} from './dto/request-correction.dto.js';

import {
  VerifyCensusDto,
} from './dto/verify-census.dto.js';

import {
  assignConsularIdentifierIfMissing,
} from '../../../common/utils/consular-id.util.js';

import {
  MailService,
} from '../../../infrastructure/mail/mail.service.js';

import {
  NotificationEventBusService,
} from '../../notifications/services/notification-event-bus.service.js';

@Injectable()
export class CensusAgentService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly notifications:
      NotificationEventBusService,
    private readonly mailService:
      MailService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | List records assigned to a diplomatic post
  |--------------------------------------------------------------------------
  */

  async findRecords(
    postId: string,
    query:
      ListCensusRecordsQueryDto,
  ) {
    await this.ensurePostExists(
      postId,
    );

    const skip =
      (query.page - 1) *
      query.limit;

    const where = {
      assignedPostId:
        postId,

      ...(query.status
        ? {
            status:
              query.status,
          }
        : {}),
    };

    const [
      total,
      items,
    ] =
      await this.prisma.$transaction([
        this.prisma.censusRecord.count({
          where,
        }),

        this.prisma.censusRecord.findMany({
          where,

          skip,

          take:
            query.limit,

          orderBy: {
            submittedAt:
              'desc',
          },

          select: {
            id:
              true,

            reference:
              true,

            status:
              true,

            firstName:
              true,

            lastName:
              true,

            email:
              true,

            primaryPhone:
              true,

            residenceCity:
              true,

            submittedAt:
              true,

            verifiedAt:
              true,

            rejectedAt:
              true,

            assignedToUserId:
              true,

            assignedAt:
              true,

            createdAt:
              true,

            assignedToUser: {
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

            residenceCountry: {
              select: {
                id:
                  true,

                iso2Code:
                  true,

                name:
                  true,
              },
            },

            user: {
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

  /*
  |--------------------------------------------------------------------------
  | Record details
  |--------------------------------------------------------------------------
  */

  async findRecord(
    postId: string,
    recordId: string,
  ) {
    await this.ensurePostExists(
      postId,
    );

    const record =
      await this.prisma.censusRecord.findFirst({
        where: {
          id:
            recordId,

          assignedPostId:
            postId,
        },

        include: {
          nationalityCountry:
            true,

          residenceCountry:
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
            },
          },

          assignedToUser: {
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

          user: {
            select: {
              id:
                true,

              email:
                true,

              profile:
                true,
            },
          },

          documents: {
            orderBy: {
              createdAt:
                'desc',
            },
          },

          reviews: {
            orderBy: {
              createdAt:
                'desc',
            },

            include: {
              reviewer: {
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

          statusHistory: {
            orderBy: {
              createdAt:
                'asc',
            },

            include: {
              changedBy: {
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
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!record) {
      throw new NotFoundException(
        'Census record not found for this diplomatic post.',
      );
    }

    return {
      record,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Start review
  |--------------------------------------------------------------------------
  */

  async startReview(
    reviewerId: string,
    postId: string,
    recordId: string,
  ) {
    const record =
      await this.findScopedRecord(
        postId,
        recordId,
      );

    if (
      record.status !==
      CensusStatus.SUBMITTED
    ) {
      throw new ConflictException(
        'Only a submitted census record can enter review.',
      );
    }

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const result =
            await tx.censusRecord.update({
              where: {
                id:
                  recordId,
              },

              data: {
                status:
                  CensusStatus.UNDER_REVIEW,
              },
            });

          await tx.censusStatusHistory.create({
            data: {
              censusRecordId:
                recordId,

              fromStatus:
                CensusStatus.SUBMITTED,

              toStatus:
                CensusStatus.UNDER_REVIEW,

              changedById:
                reviewerId,

              reason:
                'Census review started.',
            },
          });

          return result;
        },
      );

    return {
      record:
        updated,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Request correction
  |--------------------------------------------------------------------------
  */

  async requestCorrection(
    reviewerId: string,
    postId: string,
    recordId: string,
    dto:
      RequestCorrectionDto,
  ) {
    const record =
      await this.findScopedRecord(
        postId,
        recordId,
      );

    this.ensureUnderReview(
      record.status,
    );

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          await tx.censusReview.create({
            data: {
              censusRecordId:
                recordId,

              reviewerId,

              decision:
                CensusReviewDecision.CORRECTION_REQUIRED,

              comment:
                dto.comment,

              correctionFields:
                dto.correctionFields,
            },
          });

          const result =
            await tx.censusRecord.update({
              where: {
                id:
                  recordId,
              },

              data: {
                status:
                  CensusStatus.CORRECTION_REQUIRED,
              },
            });

          await tx.censusStatusHistory.create({
            data: {
              censusRecordId:
                recordId,

              fromStatus:
                CensusStatus.UNDER_REVIEW,

              toStatus:
                CensusStatus.CORRECTION_REQUIRED,

              changedById:
                reviewerId,

              reason:
                dto.comment,
            },
          });

          await this.notifications.emitToUser(
            record.userId,
            {
              type: 'CENSUS_STATUS',
              title: 'Correction demandée sur votre recensement',
              message:
                'Des corrections sont requises sur votre dossier de recensement. Veuillez consulter les motifs.',
              priority: 'HIGH',
              actionUrl: '/espace/recensement',
            },
            tx,
          );

          return result;
        },
      );

    return {
      record:
        updated,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Verify
  |--------------------------------------------------------------------------
  */

  async verify(
    reviewerId: string,
    postId: string,
    recordId: string,
    dto:
      VerifyCensusDto,
  ) {
    const record =
      await this.findScopedRecord(
        postId,
        recordId,
      );

    this.ensureUnderReview(
      record.status,
    );

    const now =
      new Date();

    const verifyOutcome =
      await this.prisma.$transaction(
        async (tx) => {
          await tx.censusReview.create({
            data: {
              censusRecordId:
                recordId,

              reviewerId,

              decision:
                CensusReviewDecision.VERIFIED,

              comment:
                dto.comment ??
                null,

              correctionFields:
                [],
            },
          });

          const result =
            await tx.censusRecord.update({
              where: {
                id:
                  recordId,
              },

              data: {
                status:
                  CensusStatus.VERIFIED,

                verifiedAt:
                  now,

                rejectedAt:
                  null,
              },
            });

          await tx.censusStatusHistory.create({
            data: {
              censusRecordId:
                recordId,

              fromStatus:
                CensusStatus.UNDER_REVIEW,

              toStatus:
                CensusStatus.VERIFIED,

              changedById:
                reviewerId,

              reason:
                dto.comment ??
                'Census record verified.',
            },
          });

          const [citizen, post] = await Promise.all([
            tx.user.findUnique({
              where: { id: record.userId },
              select: {
                id: true,
                email: true,
                emailVerifiedAt: true,
                consularIdentifier: true,
                profile: {
                  select: { firstName: true },
                },
              },
            }),
            tx.diplomaticPost.findUnique({
              where: { id: postId },
              select: { code: true, name: true },
            }),
          ]);

          let assignedConsularId = citizen?.consularIdentifier ?? null;
          let newlyIssuedConsularId: string | null = null;

          if (citizen && !assignedConsularId) {
            const assigned = await assignConsularIdentifierIfMissing(
              tx,
              citizen.id,
              post?.code,
              now,
            );
            assignedConsularId = assigned.consularIdentifier;
            if (assigned.newlyAssigned) {
              newlyIssuedConsularId = assigned.consularIdentifier;
            }
          }

          await this.notifications.emitToUser(
            record.userId,
            {
              type: 'CENSUS_STATUS',
              title: 'Recensement validé',
              message: assignedConsularId
                ? `Votre inscription consulaire a été validée avec succès. Identifiant consulaire : ${assignedConsularId}.`
                : 'Votre inscription consulaire a été validée avec succès.',
              priority: 'HIGH',
              actionUrl: '/espace/recensement',
            },
            tx,
          );

          return {
            record: result,
            newlyIssuedConsularId,
            citizenEmail: citizen?.emailVerifiedAt ? citizen.email : null,
            citizenFirstName: citizen?.profile?.firstName ?? null,
            postName: post?.name ?? null,
          };
        },
      );

    if (verifyOutcome.newlyIssuedConsularId && verifyOutcome.citizenEmail) {
      this.mailService.enqueueConsularIdentityEmail({
        to: verifyOutcome.citizenEmail,
        firstName: verifyOutcome.citizenFirstName,
        consularIdentifier: verifyOutcome.newlyIssuedConsularId,
        postName: verifyOutcome.postName,
      });
    }

    return {
      record:
        verifyOutcome.record,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Reject
  |--------------------------------------------------------------------------
  */

  async reject(
    reviewerId: string,
    postId: string,
    recordId: string,
    dto:
      RejectCensusDto,
  ) {
    const record =
      await this.findScopedRecord(
        postId,
        recordId,
      );

    this.ensureUnderReview(
      record.status,
    );

    const now =
      new Date();

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          await tx.censusReview.create({
            data: {
              censusRecordId:
                recordId,

              reviewerId,

              decision:
                CensusReviewDecision.REJECTED,

              comment:
                dto.reason,

              correctionFields:
                [],
            },
          });

          const result =
            await tx.censusRecord.update({
              where: {
                id:
                  recordId,
              },

              data: {
                status:
                  CensusStatus.REJECTED,

                rejectedAt:
                  now,

                verifiedAt:
                  null,
              },
            });

          await tx.censusStatusHistory.create({
            data: {
              censusRecordId:
                recordId,

              fromStatus:
                CensusStatus.UNDER_REVIEW,

              toStatus:
                CensusStatus.REJECTED,

              changedById:
                reviewerId,

              reason:
                dto.reason,
            },
          });

          await this.notifications.emitToUser(
            record.userId,
            {
              type: 'CENSUS_STATUS',
              title: 'Dossier de recensement rejeté',
              message:
                'Votre dossier de recensement n’a pas pu être validé. Consultez le motif dans votre espace.',
              priority: 'HIGH',
              actionUrl: '/espace/recensement',
            },
            tx,
          );

          return result;
        },
      );

    return {
      record:
        updated,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Assign census record to an active post consular agent (Option A)
  |--------------------------------------------------------------------------
  */

  async assignRecord(
    actorId: string,
    postId: string,
    recordId: string,
    dto: AssignCensusRecordDto,
  ) {
    const record = await this.findScopedRecord(postId, recordId);

    const assignment = await this.prisma.userPostAssignment.findFirst({
      where: {
        userId: dto.agentUserId,
        postId,
        status: AssignmentStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new BadRequestException(
        'The selected agent is not actively assigned to this diplomatic post.',
      );
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.censusRecord.update({
        where: { id: record.id },
        data: {
          assignedToUserId: dto.agentUserId,
          assignedAt: now,
        },
        include: {
          residenceCountry: true,
          assignedPost: {
            select: { id: true, code: true, name: true, city: true },
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
        },
      });

      await tx.censusStatusHistory.create({
        data: {
          censusRecordId: record.id,
          fromStatus: record.status,
          toStatus: record.status,
          changedById: actorId,
          reason:
            dto.comment?.trim() ||
            `Dossier affecté à l'agent consulaire (${dto.agentUserId}).`,
        },
      });

      await this.notifications.emitToUser(
        dto.agentUserId,
        {
          type: 'CENSUS_STATUS',
          title: 'Nouveau dossier de recensement affecté',
          message: `Un dossier de recensement vous a été affecté pour instruction.`,
          priority: 'HIGH',
          actionUrl: '/agent-consulaire',
        },
        tx,
      );

      return res;
    });

    return { record: updated };
  }

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

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

  private async findScopedRecord(
    postId: string,
    recordId: string,
  ) {
    const record =
      await this.prisma.censusRecord.findFirst({
        where: {
          id:
            recordId,

          assignedPostId:
            postId,
        },

        select: {
          id:
            true,

          userId:
            true,

          status:
            true,

          assignedPostId:
            true,
        },
      });

    if (!record) {
      throw new NotFoundException(
        'Census record not found for this diplomatic post.',
      );
    }

    return record;
  }

  private ensureUnderReview(
    status:
      CensusStatus,
  ) {
    if (
      status !==
      CensusStatus.UNDER_REVIEW
    ) {
      throw new ConflictException(
        'This operation is only allowed while the census record is under review.',
      );
    }
  }
}