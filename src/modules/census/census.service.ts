import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  CensusStatus,
} from '../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../infrastructure/database/prisma.service.js';

import {
  UpdateCensusRecordDto,
} from './dto/update-census-record.dto.js';

@Injectable()
export class CensusService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Current user's census
  |--------------------------------------------------------------------------
  */

  async getMyCensus(
    userId: string,
  ) {
    const record =
      await this.prisma.censusRecord.findFirst({
        where: {
          userId,
        },

        orderBy: {
          createdAt:
            'desc',
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

          documents: true,

          reviews: {
            orderBy: {
              createdAt:
                'desc',
            },
          },

          statusHistory: {
            orderBy: {
              createdAt:
                'asc',
            },
          },
        },
      });

    return {
      record:
        record ?? null,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Create draft
  |--------------------------------------------------------------------------
  */

  async createDraft(
    userId: string,
  ) {
    const existing =
      await this.prisma.censusRecord.findFirst({
        where: {
          userId,

          status: {
            not:
              CensusStatus.REJECTED,
          },
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

          status:
            true,
        },
      });

    if (existing) {
      throw new ConflictException(
        'A census record already exists for this user.',
      );
    }

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

          profile: {
            select: {
              firstName:
                true,

              lastName:
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

    const reference =
      this.generateReference();

    const record =
      await this.prisma.$transaction(
        async (tx) => {
          const censusRecord =
            await tx.censusRecord.create({
              data: {
                reference,

                userId,

                firstName:
                  user.profile
                    ?.firstName ??
                  null,

                lastName:
                  user.profile
                    ?.lastName ??
                  null,

                email:
                  user.email ??
                  null,

                status:
                  CensusStatus.DRAFT,
              },
            });

          await tx.censusStatusHistory.create({
            data: {
              censusRecordId:
                censusRecord.id,

              fromStatus:
                null,

              toStatus:
                CensusStatus.DRAFT,

              changedById:
                userId,

              reason:
                'Census draft created.',
            },
          });

          return censusRecord;
        },
      );

    return {
      record,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Update own draft
  |--------------------------------------------------------------------------
  */

  async updateMyCensus(
    userId: string,
    recordId: string,
    dto:
      UpdateCensusRecordDto,
  ) {
    const record =
      await this.prisma.censusRecord.findUnique({
        where: {
          id:
            recordId,
        },

        select: {
          id:
            true,

          userId:
            true,

          status:
            true,
        },
      });

    if (!record) {
      throw new NotFoundException(
        'Census record not found.',
      );
    }

    if (
      record.userId !==
      userId
    ) {
      throw new ForbiddenException(
        'You cannot modify another user census record.',
      );
    }

    if (
      record.status !==
        CensusStatus.DRAFT &&
      record.status !==
        CensusStatus.CORRECTION_REQUIRED
    ) {
      throw new ConflictException(
        'This census record can no longer be edited.',
      );
    }

    await this.validateCountries(
      dto,
    );

    if (
      dto.birthDate &&
      new Date(dto.birthDate) >
        new Date()
    ) {
      throw new BadRequestException(
        'Birth date cannot be in the future.',
      );
    }

    const updated =
      await this.prisma.censusRecord.update({
        where: {
          id:
            recordId,
        },

        data: {
          ...(dto.firstName !==
          undefined
            ? {
                firstName:
                  dto.firstName.trim(),
              }
            : {}),

          ...(dto.lastName !==
          undefined
            ? {
                lastName:
                  dto.lastName.trim(),
              }
            : {}),

          ...(dto.birthDate !==
          undefined
            ? {
                birthDate:
                  new Date(
                    dto.birthDate,
                  ),
              }
            : {}),

          ...(dto.birthPlace !==
          undefined
            ? {
                birthPlace:
                  dto.birthPlace.trim(),
              }
            : {}),

          ...(dto.nationalityCountryId !==
          undefined
            ? {
                nationalityCountryId:
                  dto.nationalityCountryId,
              }
            : {}),

          ...(dto.email !==
          undefined
            ? {
                email:
                  dto.email
                    .trim()
                    .toLowerCase(),
              }
            : {}),

          ...(dto.primaryPhone !==
          undefined
            ? {
                primaryPhone:
                  dto.primaryPhone.trim(),
              }
            : {}),

          ...(dto.secondaryPhone !==
          undefined
            ? {
                secondaryPhone:
                  dto.secondaryPhone.trim(),
              }
            : {}),

          ...(dto.preferredContactChannel !==
          undefined
            ? {
                preferredContactChannel:
                  dto.preferredContactChannel,
              }
            : {}),

          ...(dto.residenceCountryId !==
          undefined
            ? {
                residenceCountryId:
                  dto.residenceCountryId,
              }
            : {}),

          ...(dto.residenceCity !==
          undefined
            ? {
                residenceCity:
                  dto.residenceCity.trim(),
              }
            : {}),

          ...(dto.residenceAddress !==
          undefined
            ? {
                residenceAddress:
                  dto.residenceAddress.trim(),
              }
            : {}),

          ...(dto.residencePostalCode !==
          undefined
            ? {
                residencePostalCode:
                  dto.residencePostalCode.trim(),
              }
            : {}),

          ...(dto.residenceSinceYear !==
          undefined
            ? {
                residenceSinceYear:
                  dto.residenceSinceYear,
              }
            : {}),

          ...(dto.residenceStatus !==
          undefined
            ? {
                residenceStatus:
                  dto.residenceStatus,
              }
            : {}),

          ...(dto.cameroonRegion !==
          undefined
            ? {
                cameroonRegion:
                  dto.cameroonRegion.trim(),
              }
            : {}),

          ...(dto.cameroonCity !==
          undefined
            ? {
                cameroonCity:
                  dto.cameroonCity.trim(),
              }
            : {}),

          ...(dto.lastCameroonAddress !==
          undefined
            ? {
                lastCameroonAddress:
                  dto.lastCameroonAddress.trim(),
              }
            : {}),

          ...(dto.departureYear !==
          undefined
            ? {
                departureYear:
                  dto.departureYear,
              }
            : {}),

          ...(dto.departureReason !==
          undefined
            ? {
                departureReason:
                  dto.departureReason,
              }
            : {}),

          ...(dto.maritalStatus !==
          undefined
            ? {
                maritalStatus:
                  dto.maritalStatus,
              }
            : {}),

          ...(dto.dependantsCount !==
          undefined
            ? {
                dependantsCount:
                  dto.dependantsCount,
              }
            : {}),

          ...(dto.employmentStatus !==
          undefined
            ? {
                employmentStatus:
                  dto.employmentStatus,
              }
            : {}),

          ...(dto.profession !==
          undefined
            ? {
                profession:
                  dto.profession.trim(),
              }
            : {}),

          ...(dto.jobTitle !==
          undefined
            ? {
                jobTitle:
                  dto.jobTitle.trim(),
              }
            : {}),

          ...(dto.sector !==
          undefined
            ? {
                sector:
                  dto.sector.trim(),
              }
            : {}),

          ...(dto.employer !==
          undefined
            ? {
                employer:
                  dto.employer.trim(),
              }
            : {}),

          ...(dto.yearsExperience !==
          undefined
            ? {
                yearsExperience:
                  dto.yearsExperience,
              }
            : {}),

          ...(dto.declaredAccurate !==
          undefined
            ? {
                declaredAccurate:
                  dto.declaredAccurate,
              }
            : {}),

          ...(dto.consentDataProcessing !==
          undefined
            ? {
                consentDataProcessing:
                  dto.consentDataProcessing,
              }
            : {}),

          ...(dto.privacyNoticeAccepted !==
          undefined
            ? {
                privacyNoticeAccepted:
                  dto.privacyNoticeAccepted,
              }
            : {}),
        },

        include: {
          nationalityCountry:
            true,

          residenceCountry:
            true,

          assignedPost:
            true,
        },
      });

    return {
      record:
        updated,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Validation
  |--------------------------------------------------------------------------
  */

  private async validateCountries(
    dto:
      UpdateCensusRecordDto,
  ) {
    const ids = [
      dto.nationalityCountryId,
      dto.residenceCountryId,
    ].filter(
      (
        value,
      ): value is string =>
        typeof value ===
        'string',
    );

    const uniqueIds = [
      ...new Set(ids),
    ];

    if (
      uniqueIds.length ===
      0
    ) {
      return;
    }

    const countries =
      await this.prisma.country.count({
        where: {
          id: {
            in:
              uniqueIds,
          },

          isActive:
            true,
        },
      });

    if (
      countries !==
      uniqueIds.length
    ) {
      throw new BadRequestException(
        'One or more countries are invalid or inactive.',
      );
    }
  }

  private generateReference() {
    return `CNS-${randomUUID()
      .replaceAll('-', '')
      .toUpperCase()}`;
  }
}