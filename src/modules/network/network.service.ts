import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../infrastructure/database/prisma.service.js';

import {
  CreateCountryDto,
} from './dto/create-country.dto.js';

import {
  CreateDiplomaticPostDto,
} from './dto/create-diplomatic-post.dto.js';

import {
  CreatePostCoverageDto,
} from './dto/create-post-coverage.dto.js';

import {
  CreatePostTypeDto,
} from './dto/create-post-type.dto.js';

import {
  CreateServiceDto,
} from './dto/create-service.dto.js';

import {
  UpdateDiplomaticPostDto,
} from './dto/update-diplomatic-post.dto.js';

import {
  UpdatePostCoverageDto,
} from './dto/update-post-coverage.dto.js';

import {
  UpdateServiceDto,
} from './dto/update-service.dto.js';

@Injectable()
export class NetworkService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | COUNTRIES
  |--------------------------------------------------------------------------
  */

  async findCountries() {
    const items =
      await this.prisma.country.findMany({
        where: {
          isActive: true,
        },

        orderBy: {
          name: 'asc',
        },

        select: {
          id: true,
          iso2Code: true,
          iso3Code: true,
          name: true,
        },
      });

    return {
      items,
    };
  }

  async createCountry(
    dto: CreateCountryDto,
  ) {
    const duplicate =
      await this.prisma.country.findFirst({
        where: {
          OR: [
            {
              iso2Code:
                dto.iso2Code,
            },

            {
              iso3Code:
                dto.iso3Code,
            },

            {
              name: {
                equals:
                  dto.name,

                mode:
                  'insensitive',
              },
            },
          ],
        },

        select: {
          id: true,
        },
      });

    if (duplicate) {
      throw new ConflictException(
        'Country already exists.',
      );
    }

    const country =
      await this.prisma.country.create({
        data: {
          iso2Code:
            dto.iso2Code,

          iso3Code:
            dto.iso3Code,

          name:
            dto.name,
        },
      });

    return {
      country,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | POST TYPES
  |--------------------------------------------------------------------------
  */

  async findPostTypes() {
    const items =
      await this.prisma.postType.findMany({
        where: {
          isActive: true,
        },

        orderBy: {
          name: 'asc',
        },
      });

    return {
      items,
    };
  }

  async createPostType(
    dto: CreatePostTypeDto,
  ) {
    const duplicate =
      await this.prisma.postType.findFirst({
        where: {
          OR: [
            {
              code:
                dto.code,
            },

            {
              name: {
                equals:
                  dto.name,

                mode:
                  'insensitive',
              },
            },
          ],
        },

        select: {
          id: true,
        },
      });

    if (duplicate) {
      throw new ConflictException(
        'Diplomatic post type already exists.',
      );
    }

    const postType =
      await this.prisma.postType.create({
        data: {
          code:
            dto.code,

          name:
            dto.name,

          description:
            dto.description ??
            null,
        },
      });

    return {
      postType,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | DIPLOMATIC POSTS
  |--------------------------------------------------------------------------
  */

  async findPosts() {
    const items =
      await this.prisma.diplomaticPost.findMany({
        orderBy: {
          name: 'asc',
        },

        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          city: true,
          address: true,

          type: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          hostCountry: {
            select: {
              id: true,
              iso2Code: true,
              iso3Code: true,
              name: true,
            },
          },

          parentPost: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

    return {
      items,
    };
  }

  async findPost(
    postId: string,
  ) {
    const post =
      await this.prisma.diplomaticPost.findUnique({
        where: {
          id:
            postId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          city: true,
          address: true,
          createdAt: true,
          updatedAt: true,

          type: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          hostCountry: {
            select: {
              id: true,
              iso2Code: true,
              iso3Code: true,
              name: true,
            },
          },

          parentPost: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          services: {
            select: {
              id: true,
              code: true,
              name: true,
              serviceType: true,
              status: true,
            },
          },

          coverages: {
            select: {
              id: true,
              competenceNature: true,
              startDate: true,
              endDate: true,

              country: {
                select: {
                  id: true,
                  iso2Code: true,
                  iso3Code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

    if (!post) {
      throw new NotFoundException(
        'Diplomatic post not found.',
      );
    }

    return {
      post,
    };
  }

  async createPost(
    dto:
      CreateDiplomaticPostDto,
  ) {
    await this.validatePostReferences(
      dto.typeId,
      dto.hostCountryId,
      dto.parentPostId,
    );

    const existing =
      await this.prisma.diplomaticPost.findUnique({
        where: {
          code:
            dto.code,
        },

        select: {
          id:
            true,
        },
      });

    if (existing) {
      throw new ConflictException(
        'Diplomatic post code already exists.',
      );
    }

    const post =
      await this.prisma.diplomaticPost.create({
        data: {
          code:
            dto.code,

          name:
            dto.name,

          typeId:
            dto.typeId,

          hostCountryId:
            dto.hostCountryId ??
            null,

          city:
            dto.city ??
            null,

          address:
            dto.address ??
            null,

          parentPostId:
            dto.parentPostId ??
            null,
        },
      });

    return {
      post,
    };
  }

  async updatePost(
    postId: string,
    dto:
      UpdateDiplomaticPostDto,
  ) {
    const existing =
      await this.prisma.diplomaticPost.findUnique({
        where: {
          id:
            postId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Diplomatic post not found.',
      );
    }

    if (
      dto.parentPostId ===
      postId
    ) {
      throw new BadRequestException(
        'A diplomatic post cannot be its own parent.',
      );
    }

    await this.validatePostReferences(
      dto.typeId ??
        existing.typeId,

      dto.hostCountryId ??
        existing.hostCountryId ??
        undefined,

      dto.parentPostId ??
        existing.parentPostId ??
        undefined,
    );

    if (
      dto.code !==
      undefined
    ) {
      const duplicate =
        await this.prisma.diplomaticPost.findFirst({
          where: {
            code:
              dto.code,

            id: {
              not:
                postId,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        throw new ConflictException(
          'Another diplomatic post already uses this code.',
        );
      }
    }

    const post =
      await this.prisma.diplomaticPost.update({
        where: {
          id:
            postId,
        },

        data: {
          ...(dto.code !== undefined
            ? {
                code:
                  dto.code,
              }
            : {}),

          ...(dto.name !== undefined
            ? {
                name:
                  dto.name,
              }
            : {}),

          ...(dto.typeId !== undefined
            ? {
                typeId:
                  dto.typeId,
              }
            : {}),

          ...(dto.hostCountryId !== undefined
            ? {
                hostCountryId:
                  dto.hostCountryId,
              }
            : {}),

          ...(dto.city !== undefined
            ? {
                city:
                  dto.city,
              }
            : {}),

          ...(dto.address !== undefined
            ? {
                address:
                  dto.address,
              }
            : {}),

          ...(dto.parentPostId !== undefined
            ? {
                parentPostId:
                  dto.parentPostId,
              }
            : {}),

          ...(dto.status !== undefined
            ? {
                status:
                  dto.status,
              }
            : {}),
        },
      });

    return {
      post,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | SERVICES
  |--------------------------------------------------------------------------
  */

  async findServices(
    postId: string,
  ) {
    await this.ensurePostExists(
      postId,
    );

    const items =
      await this.prisma.service.findMany({
        where: {
          postId,
        },

        orderBy: {
          name:
            'asc',
        },

        select: {
          id: true,
          postId: true,
          code: true,
          name: true,
          serviceType: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return {
      items,
    };
  }

  async createService(
    postId: string,
    dto: CreateServiceDto,
  ) {
    await this.ensurePostExists(
      postId,
    );

    const duplicate =
      await this.prisma.service.findFirst({
        where: {
          postId,

          code:
            dto.code,
        },

        select: {
          id: true,
        },
      });

    if (duplicate) {
      throw new ConflictException(
        'A service with this code already exists in this diplomatic post.',
      );
    }

    const service =
      await this.prisma.service.create({
        data: {
          postId,

          code:
            dto.code,

          name:
            dto.name,

          serviceType:
            dto.serviceType ??
            null,

          description:
            dto.description ??
            null,
        },
      });

    return {
      service,
    };
  }

  async updateService(
    serviceId: string,
    dto: UpdateServiceDto,
  ) {
    const existing =
      await this.prisma.service.findUnique({
        where: {
          id:
            serviceId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Diplomatic service not found.',
      );
    }

    if (
      dto.code !==
      undefined
    ) {
      const duplicate =
        await this.prisma.service.findFirst({
          where: {
            postId:
              existing.postId,

            code:
              dto.code,

            id: {
              not:
                serviceId,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        throw new ConflictException(
          'Another service in this diplomatic post already uses this code.',
        );
      }
    }

    const service =
      await this.prisma.service.update({
        where: {
          id:
            serviceId,
        },

        data: {
          ...(dto.code !== undefined
            ? {
                code:
                  dto.code,
              }
            : {}),

          ...(dto.name !== undefined
            ? {
                name:
                  dto.name,
              }
            : {}),

          ...(dto.serviceType !== undefined
            ? {
                serviceType:
                  dto.serviceType,
              }
            : {}),

          ...(dto.description !== undefined
            ? {
                description:
                  dto.description,
              }
            : {}),

          ...(dto.status !== undefined
            ? {
                status:
                  dto.status,
              }
            : {}),
        },
      });

    return {
      service,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | GEOGRAPHIC COVERAGE
  |--------------------------------------------------------------------------
  */

  async findCoverages(
    postId: string,
  ) {
    await this.ensurePostExists(
      postId,
    );

    const items =
      await this.prisma.postCoverage.findMany({
        where: {
          postId,
        },

        orderBy: {
          startDate:
            'desc',
        },

        select: {
          id: true,
          postId: true,
          countryId: true,
          competenceNature: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,

          country: {
            select: {
              id: true,
              iso2Code: true,
              iso3Code: true,
              name: true,
            },
          },
        },
      });

    return {
      items,
    };
  }

  async createCoverage(
    postId: string,
    dto:
      CreatePostCoverageDto,
  ) {
    await this.ensurePostExists(
      postId,
    );

    const country =
      await this.prisma.country.findUnique({
        where: {
          id:
            dto.countryId,
        },

        select: {
          id: true,
          isActive: true,
        },
      });

    if (
      !country ||
      !country.isActive
    ) {
      throw new BadRequestException(
        'Coverage country is invalid or inactive.',
      );
    }

    const startDate =
      dto.startDate
        ? new Date(dto.startDate)
        : new Date();

    const endDate =
      dto.endDate
        ? new Date(dto.endDate)
        : null;

    if (
      endDate &&
      endDate <
        startDate
    ) {
      throw new BadRequestException(
        'Coverage end date cannot be before the start date.',
      );
    }

    const existingActiveCoverage =
      await this.prisma.postCoverage.findFirst({
        where: {
          postId,

          countryId:
            dto.countryId,

          endDate:
            null,
        },

        select: {
          id: true,
        },
      });

    if (
      existingActiveCoverage
    ) {
      throw new ConflictException(
        'This diplomatic post already has an active coverage for this country.',
      );
    }

    const coverage =
      await this.prisma.postCoverage.create({
        data: {
          postId,

          countryId:
            dto.countryId,

          competenceNature:
            dto.competenceNature ??
            null,

          startDate,

          endDate,
        },

        include: {
          country: true,
        },
      });

    return {
      coverage,
    };
  }

  async updateCoverage(
    coverageId: string,
    dto:
      UpdatePostCoverageDto,
  ) {
    const existing =
      await this.prisma.postCoverage.findUnique({
        where: {
          id:
            coverageId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Diplomatic post coverage not found.',
      );
    }

    const endDate =
      dto.endDate !==
      undefined
        ? new Date(
            dto.endDate,
          )
        : undefined;

    if (
      endDate &&
      endDate <
        existing.startDate
    ) {
      throw new BadRequestException(
        'Coverage end date cannot be before the start date.',
      );
    }

    const coverage =
      await this.prisma.postCoverage.update({
        where: {
          id:
            coverageId,
        },

        data: {
          ...(dto.competenceNature !==
          undefined
            ? {
                competenceNature:
                  dto.competenceNature,
              }
            : {}),

          ...(endDate !==
          undefined
            ? {
                endDate,
              }
            : {}),
        },

        include: {
          country: true,
        },
      });

    return {
      coverage,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATION
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
          id: true,
        },
      });

    if (!post) {
      throw new NotFoundException(
        'Diplomatic post not found.',
      );
    }

    return post;
  }

  private async validatePostReferences(
    typeId: string,
    hostCountryId?: string,
    parentPostId?: string,
  ) {
    const postType =
      await this.prisma.postType.findUnique({
        where: {
          id:
            typeId,
        },

        select: {
          id: true,
          isActive: true,
        },
      });

    if (
      !postType ||
      !postType.isActive
    ) {
      throw new BadRequestException(
        'Diplomatic post type is invalid or inactive.',
      );
    }

    if (hostCountryId) {
      const country =
        await this.prisma.country.findUnique({
          where: {
            id:
              hostCountryId,
          },

          select: {
            id: true,
            isActive: true,
          },
        });

      if (
        !country ||
        !country.isActive
      ) {
        throw new BadRequestException(
          'Host country is invalid or inactive.',
        );
      }
    }

    if (parentPostId) {
      const parent =
        await this.prisma.diplomaticPost.findUnique({
          where: {
            id:
              parentPostId,
          },

          select: {
            id: true,
          },
        });

      if (!parent) {
        throw new BadRequestException(
          'Parent diplomatic post does not exist.',
        );
      }
    }
  }
}