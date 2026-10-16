import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CensusReviewDecision,
  CensusStatus,
} from '../../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

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

@Injectable()
export class CensusAgentService {
  constructor(
    private readonly prisma:
      PrismaService,
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

            createdAt:
              true,

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

    const updated =
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