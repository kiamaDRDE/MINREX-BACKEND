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
  CreatePostTypeDto,
} from './dto/create-post-type.dto.js';

import {
  UpdateDiplomaticPostDto,
} from './dto/update-diplomatic-post.dto.js';

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
          isActive:
            true,
        },

        orderBy: {
          name:
            'asc',
        },

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
      });

    return {
      items,
    };
  }

  async createCountry(
    dto:
      CreateCountryDto,
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
          id:
            true,
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
          isActive:
            true,
        },

        orderBy: {
          name:
            'asc',
        },
      });

    return {
      items,
    };
  }

  async createPostType(
    dto:
      CreatePostTypeDto,
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
          id:
            true,
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
          name:
            'asc',
        },

        select: {
          id:
            true,

          code:
            true,

          name:
            true,

          status:
            true,

          city:
            true,

          address:
            true,

          type: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,
            },
          },

          hostCountry: {
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

          parentPost: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,
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
          id:
            true,

          code:
            true,

          name:
            true,

          status:
            true,

          city:
            true,

          address:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          type: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,
            },
          },

          hostCountry: {
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

          parentPost: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,
            },
          },

          services: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,

              status:
                true,
            },
          },

          coverages: {
            select: {
              id:
                true,

              competenceNature:
                true,

              startDate:
                true,

              endDate:
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

        select: {
          id:
            true,

          code:
            true,

          name:
            true,

          status:
            true,

          city:
            true,

          address:
            true,

          type:
            true,

          hostCountry:
            true,

          parentPost:
            true,
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

        select: {
          id:
            true,

          typeId:
            true,

          hostCountryId:
            true,

          parentPostId:
            true,
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
            id:
              true,
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
          ...(dto.code !==
          undefined
            ? {
                code:
                  dto.code,
              }
            : {}),

          ...(dto.name !==
          undefined
            ? {
                name:
                  dto.name,
              }
            : {}),

          ...(dto.typeId !==
          undefined
            ? {
                typeId:
                  dto.typeId,
              }
            : {}),

          ...(dto.hostCountryId !==
          undefined
            ? {
                hostCountryId:
                  dto.hostCountryId,
              }
            : {}),

          ...(dto.city !==
          undefined
            ? {
                city:
                  dto.city,
              }
            : {}),

          ...(dto.address !==
          undefined
            ? {
                address:
                  dto.address,
              }
            : {}),

          ...(dto.parentPostId !==
          undefined
            ? {
                parentPostId:
                  dto.parentPostId,
              }
            : {}),

          ...(dto.status !==
          undefined
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
  | VALIDATION
  |--------------------------------------------------------------------------
  */

  private async validatePostReferences(
    typeId:
      string,

    hostCountryId?:
      string,

    parentPostId?:
      string,
  ) {
    const postType =
      await this.prisma.postType.findUnique({
        where: {
          id:
            typeId,
        },

        select: {
          id:
            true,

          isActive:
            true,
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
            id:
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
            id:
              true,
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