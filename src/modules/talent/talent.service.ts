import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CensusStatus,
} from '../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../infrastructure/database/prisma.service.js';

import {
  ListTalentsQueryDto,
} from './dto/list-talents-query.dto.js';

@Injectable()
export class TalentService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(
    query: ListTalentsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip =
      (page - 1) * limit;

    const insensitive =
      'insensitive' as const;

    const where = {
      status:
        CensusStatus.VERIFIED,

      optInTalentDirectory:
        true,

      ...(query.countryId
        ? {
            residenceCountryId:
              query.countryId,
          }
        : {}),

      ...(query.expertiseDomain
        ? {
            expertiseDomains: {
              has:
                query.expertiseDomain,
            },
          }
        : {}),

      ...(query.skill
        ? {
            skills: {
              has:
                query.skill,
            },
          }
        : {}),

      ...(query.q
        ? {
            OR: [
              {
                firstName: {
                  contains:
                    query.q,
                  mode:
                    insensitive,
                },
              },

              {
                lastName: {
                  contains:
                    query.q,
                  mode:
                    insensitive,
                },
              },

              {
                profession: {
                  contains:
                    query.q,
                  mode:
                    insensitive,
                },
              },

              {
                jobTitle: {
                  contains:
                    query.q,
                  mode:
                    insensitive,
                },
              },

              {
                sector: {
                  contains:
                    query.q,
                  mode:
                    insensitive,
                },
              },

              {
                qualifications: {
                  contains:
                    query.q,
                  mode:
                    insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [
      talents,
      total,
    ] =
      await this.prisma.$transaction([
        this.prisma.censusRecord.findMany({
          where,

          skip,
          take:
            limit,

          orderBy: [
            {
              verifiedAt:
                'desc',
            },
            {
              updatedAt:
                'desc',
            },
          ],

          select: {
            id:
              true,

            userId:
              true,

            firstName:
              true,

            lastName:
              true,

            profession:
              true,

            jobTitle:
              true,

            sector:
              true,

            employer:
              true,

            yearsExperience:
              true,

            expertiseDomains:
              true,

            skills:
              true,

            qualifications:
              true,

            verifiedAt:
              true,

            residenceCity:
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
                profile: {
                  select: {
                    displayName:
                      true,

                    photoUrl:
                      true,
                  },
                },
              },
            },
          },
        }),

        this.prisma.censusRecord.count({
          where,
        }),
      ]);

    return {
      items:
        talents,

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }

  async findOne(
    talentId: string,
  ) {
    const talent =
      await this.prisma.censusRecord.findFirst({
        where: {
          id:
            talentId,

          status:
            CensusStatus.VERIFIED,

          optInTalentDirectory:
            true,
        },

        select: {
          id:
            true,

          userId:
            true,

          firstName:
            true,

          lastName:
            true,

          profession:
            true,

          jobTitle:
            true,

          sector:
            true,

          employer:
            true,

          yearsExperience:
            true,

          expertiseDomains:
            true,

          skills:
            true,

          qualifications:
            true,

          verifiedAt:
            true,

          residenceCity:
            true,

          residenceCountry: {
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

          user: {
            select: {
              profile: {
                select: {
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

    if (!talent) {
      throw new NotFoundException(
        'Talent profile not found.',
      );
    }

    return talent;
  }
}