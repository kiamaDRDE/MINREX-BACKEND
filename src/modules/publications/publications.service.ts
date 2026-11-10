import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { NotificationEventBusService } from '../notifications/services/notification-event-bus.service.js';
import { CreatePublicationDto } from './dto/create-publication.dto.js';
import { QueryPublicationsDto } from './dto/query-publications.dto.js';
import { ReviewPublicationDto } from './dto/review-publication.dto.js';
import { UpdatePublicationDto } from './dto/update-publication.dto.js';
import {
  AssociationStatus,
  PublicationReviewDecision,
  PublicationReviewLevel,
  PublicationStatus,
  PublicationTargetScope,
} from '../../generated/prisma/enums.js';

import {
  AuthorizationService,
} from '../identity/authorization/authorization.service.js';

import {
  PERMISSIONS,
} from '../identity/authorization/constants/permissions.constants.js';

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationEventBusService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * Génère un slug unique SEO-friendly
   */
  private generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 160);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${baseSlug}-${randomSuffix}`;
  }

  /**
   * 1. Créer une nouvelle publication / article / communiqué (Brouillon)
   */
  async createPublication(authorId: string, dto: CreatePublicationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Auteur introuvable.');
    }

    if (dto.diplomaticPostId) {
      const post = await this.prisma.diplomaticPost.findUnique({
        where: { id: dto.diplomaticPostId },
        select: { id: true },
      });
      if (!post) {
        throw new BadRequestException('Le poste diplomatique spécifié est introuvable.');
      }
    }

    let associationPostId: string | null = null;
    
    if (dto.associationId) {
      const association =
        await this.prisma.association.findUnique({
          where: {
            id: dto.associationId,
          },
    
          select: {
            id: true,
            status: true,
            diplomaticPostId: true,
          },
        });
    
      if (!association) {
        throw new BadRequestException(
          'L’association spécifiée est introuvable.',
        );
      }
    
      if (
        association.status !== AssociationStatus.APPROVED
      ) {
        throw new ForbiddenException(
          'Seule une association approuvée peut être associée à une publication.',
        );
      }
    
      const membership =
        await this.prisma.associationMembership.findFirst({
          where: {
            associationId: association.id,
            userId: authorId,
            isActive: true,
            isLegalRepresentative: true,
          },
    
          select: {
            id: true,
          },
        });
    
      if (!membership) {
        throw new ForbiddenException(
          'Seul un représentant légal actif peut publier au nom de cette association.',
        );
      }
    
      if (
        dto.diplomaticPostId &&
        dto.diplomaticPostId !== association.diplomaticPostId
      ) {
        throw new BadRequestException(
          'Le poste diplomatique doit correspondre à celui de l’association.',
        );
      }
    
      associationPostId = association.diplomaticPostId;
    }

    const slug = this.generateSlug(dto.title);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return this.prisma.publication.create({
      data: {
        slug,
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        content: dto.content,
        type: dto.type,
        scope: dto.scope ?? PublicationTargetScope.GLOBAL_PUBLIC,
        diplomaticPostId:
          associationPostId ??
          dto.diplomaticPostId ??
          null,
        associationId: dto.associationId ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
        attachments: dto.attachments ?? [],
        tags: dto.tags ?? [],
        expiresAt,
        authorId,
        status: PublicationStatus.DRAFT,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, photoUrl: true } },
          },
        },
        diplomaticPost: { select: { id: true, name: true, city: true } },
        association: { select: { id: true, name: true, acronym: true } },
      },
    });
  }

  /**
   * 2. Lister les publications de l'auteur connecté
   */
  async getMyPublications(authorId: string) {
    return this.prisma.publication.findMany({
      where: { authorId },
      include: {
        diplomaticPost: { select: { id: true, name: true, city: true } },
        association: { select: { id: true, name: true, acronym: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 3. Fil d'actualité public et citoyen (Publications PUBLISHED non expirées)
   */
  async getPublicFeed(query: QueryPublicationsDto) {
    const { q, type, scope, diplomaticPostId, associationId, tag, isFeatured, page, limit } =
      query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Record<string, unknown> = {
      status: PublicationStatus.PUBLISHED,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    if (type) where.type = type;
    if (scope) where.scope = scope;
    if (diplomaticPostId) where.diplomaticPostId = diplomaticPostId;
    if (associationId) where.associationId = associationId;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (tag) where.tags = { has: tag };

    if (q) {
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.publication.count({ where }),
      this.prisma.publication.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          type: true,
          scope: true,
          coverImageUrl: true,
          tags: true,
          isFeatured: true,
          viewCount: true,
          publishedAt: true,
          author: {
            select: {
              profile: { select: { firstName: true, lastName: true, photoUrl: true } },
            },
          },
          diplomaticPost: { select: { id: true, name: true, city: true } },
          association: { select: { id: true, name: true, acronym: true, logoUrl: true } },
        },
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 4. Consultation unitaire d'une publication par ID ou SLUG
   */
  async getPublicationBySlugOrId(
    identifier: string,
    userId?: string,
  ) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );
  
    const publication =
      await this.prisma.publication.findFirst({
        where: isUuid
          ? { id: identifier }
          : { slug: identifier },
  
        include: {
          author: {
            select: {
              id: true,
              email: true,
  
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  photoUrl: true,
                },
              },
            },
          },
  
          diplomaticPost: {
            select: {
              id: true,
              name: true,
              city: true,
              code: true,
            },
          },
  
          association: {
            select: {
              id: true,
              name: true,
              acronym: true,
              logoUrl: true,
            },
          },
        },
      });
  
    if (!publication) {
      throw new NotFoundException(
        'Publication introuvable.',
      );
    }
  
    const isAuthor =
      publication.authorId === userId;
  
    const isStaff = userId
      ? await this.authorizationService.hasAllPermissions(
          userId,
          [PERMISSIONS.PUBLICATIONS.READ],
          {
            postId:
              publication.diplomaticPostId ?? undefined,
          },
        )
      : false;
  
    if (
      publication.status !== PublicationStatus.PUBLISHED &&
      !isAuthor &&
      !isStaff
    ) {
      throw new ForbiddenException(
        'Cette publication est en cours de modération et n’est pas encore publique.',
      );
    }
  
    const reviews =
      isAuthor || isStaff
        ? await this.prisma.publicationReviewHistory.findMany({
            where: {
              publicationId: publication.id,
            },
  
            orderBy: {
              createdAt: 'desc',
            },
  
            include: {
              reviewer: {
                select: {
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          })
        : [];
  
    if (
      publication.status === PublicationStatus.PUBLISHED
    ) {
      await this.prisma.publication.update({
        where: {
          id: publication.id,
        },
  
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });
    }
  
    return {
      ...publication,
      reviews,
    };
  }

  /**
   * 5. Mettre à jour une publication (Brouillon ou Correction demandée)
   */
  async updatePublication(id: string, authorId: string, dto: UpdatePublicationDto) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    if (publication.authorId !== authorId) {
      throw new ForbiddenException('Seul l’auteur peut modifier cette publication.');
    }

    if (
      publication.status !== PublicationStatus.DRAFT &&
      publication.status !== PublicationStatus.CORRECTION_REQUIRED
    ) {
      throw new BadRequestException(
        'Une publication déjà soumise ou publiée ne peut être modifiée directement.',
      );
    }

    const data = Object.assign({}, dto) as Record<string, unknown>;
    if (dto.title && dto.title !== publication.title) {
      data.slug = this.generateSlug(dto.title);
    }
    if (dto.expiresAt) {
      data.expiresAt = new Date(dto.expiresAt);
    }

    return this.prisma.publication.update({
      where: { id },
      data,
    });
  }

  /**
   * 6. Soumettre officiellement une publication pour modération
   */
  async submitPublication(id: string, authorId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
      include: { diplomaticPost: { select: { name: true } } },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    if (publication.authorId !== authorId) {
      throw new ForbiddenException('Non autorisé à soumettre cette publication.');
    }

    if (
      publication.status !== PublicationStatus.DRAFT &&
      publication.status !== PublicationStatus.CORRECTION_REQUIRED
    ) {
      throw new BadRequestException('Cette publication a déjà été soumise.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publication.update({
        where: { id },
        data: { status: PublicationStatus.PENDING_LEVEL1_REVIEW },
      });

      await this.notifications.emitToUser(
        authorId,
        {
          type: 'PUBLICATION_ALERT',
          title: 'Publication soumise',
          message: 'Votre publication a été soumise à la modération.',
          priority: 'NORMAL',
          actionUrl: `/espace/publications/${id}`,
        },
        tx,
      );

      if (publication.diplomaticPostId) {
        await this.notifications.emitToPostRole(
          publication.diplomaticPostId,
          ['CONSULAR_AGENT', 'POST_MANAGER'],
          {
            type: 'PUBLICATION_ALERT',
            title: 'Nouvelle publication à modérer',
            message: `La publication "${publication.title}" a été soumise pour modération.`,
            priority: 'NORMAL',
            actionUrl: `/agent-consulaire`,
          },
          tx,
        );
      } else {
        await this.notifications.emitToGlobalRole(
          ['MINREX_CENTRAL_AGENT', 'PLATFORM_ADMIN'],
          {
            type: 'PUBLICATION_ALERT',
            title: 'Nouvelle publication à modérer',
            message: `La publication "${publication.title}" a été soumise pour modération.`,
            priority: 'NORMAL',
            actionUrl: `/agent-central`,
          },
          tx,
        );
      }

      return res;
    });

    return updated;
  }

  /**
   * 7. File d'attente Niveau 1 (Modération territoriale / consulaire)
   */
  async getLevel1Queue(
    userId: string,
    query: QueryPublicationsDto,
  ) {
    const scope =
      await this.authorizationService.getPostScopeForPermission(
        userId,
        PERMISSIONS.PUBLICATIONS.REVIEW_LEVEL1,
      );
  
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
  
    const where: Record<string, unknown> = {
      status: PublicationStatus.PENDING_LEVEL1_REVIEW,
    };
  
    if (!scope.isGlobal) {
      if (query.diplomaticPostId) {
        if (
          !scope.postIds.includes(
            query.diplomaticPostId,
          )
        ) {
          throw new ForbiddenException(
            'Vous ne pouvez pas consulter les publications d’un autre poste.',
          );
        }
  
        where.diplomaticPostId =
          query.diplomaticPostId;
      } else {
        where.diplomaticPostId = {
          in: scope.postIds,
        };
      }
    } else if (query.diplomaticPostId) {
      where.diplomaticPostId =
        query.diplomaticPostId;
    }
  
    if (query.type) {
      where.type = query.type;
    }
  
    const [total, items] = await Promise.all([
      this.prisma.publication.count({
        where,
      }),
  
      this.prisma.publication.findMany({
        where,
  
        include: {
          author: {
            select: {
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
  
          diplomaticPost: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
  
          association: {
            select: {
              id: true,
              name: true,
            },
          },
        },
  
        orderBy: {
          createdAt: 'asc',
        },
  
        skip,
        take: limit,
      }),
    ]);
  
    return {
      items,
  
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 8. Instruction Niveau 1 (Modérateur territorial)
   */
  async reviewLevel1(id: string, reviewerId: string, dto: ReviewPublicationDto) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    if (publication.status !== PublicationStatus.PENDING_LEVEL1_REVIEW) {
      throw new BadRequestException('Cette publication n’est pas en attente d’instruction Niveau 1.');
    }

    await this.assertPostPermission(
      reviewerId,
      PERMISSIONS.PUBLICATIONS.REVIEW_LEVEL1,
      publication.diplomaticPostId,
    );

    let nextStatus: PublicationStatus;
    let notifTitle = '';
    let notifContent = '';

    if (dto.decision === PublicationReviewDecision.VALIDATED_TO_LEVEL2) {
      nextStatus = PublicationStatus.PENDING_LEVEL2_APPROVAL;
      notifTitle = 'Publication validée au Niveau 1';
      notifContent = `Votre publication "${publication.title}" a passé l’instruction Niveau 1 avec succès et est transmise pour validation finale.`;
    } else if (dto.decision === PublicationReviewDecision.CORRECTION_REQUESTED) {
      if (!dto.comment) {
        throw new BadRequestException('Un commentaire motivant la correction demandée est obligatoire.');
      }
      nextStatus = PublicationStatus.CORRECTION_REQUIRED;
      notifTitle = 'Complément requis pour votre publication';
      notifContent = `Une modification est demandée pour "${publication.title}". Motif : ${dto.comment}`;
    } else if (dto.decision === PublicationReviewDecision.REJECTED) {
      if (!dto.comment) {
        throw new BadRequestException('Un motif de rejet est obligatoire.');
      }
      nextStatus = PublicationStatus.REJECTED;
      notifTitle = 'Publication non retenue';
      notifContent = `Votre publication "${publication.title}" a été refusée au Niveau 1. Motif : ${dto.comment}`;
    } else {
      throw new BadRequestException('Décision de modération Niveau 1 non reconnue.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publication.update({
        where: { id },
        data: { status: nextStatus },
      });

      await tx.publicationReviewHistory.create({
        data: {
          publicationId: id,
          reviewerId,
          level: PublicationReviewLevel.LEVEL1_MODERATION,
          decision: dto.decision,
          comment: dto.comment ?? null,
        },
      });

      await this.notifications.emitToUser(
        publication.authorId,
        {
          type: 'PUBLICATION_ALERT',
          priority:
            dto.decision === PublicationReviewDecision.CORRECTION_REQUESTED
              ? 'HIGH'
              : 'NORMAL',
          title: notifTitle,
          message: notifContent,
          actionUrl: `/espace/publications/${id}`,
        },
        tx,
      );

      if (dto.decision === PublicationReviewDecision.VALIDATED_TO_LEVEL2) {
        if (publication.diplomaticPostId) {
          await this.notifications.emitToPostRole(
            publication.diplomaticPostId,
            ['POST_MANAGER'],
            {
              type: 'PUBLICATION_ALERT',
              title: 'Publication en attente d’approbation finale',
              message: `La publication "${publication.title}" a passé le niveau 1 et attend votre validation.`,
              priority: 'NORMAL',
              actionUrl: `/agent-consulaire`,
            },
            tx,
          );
        } else {
          await this.notifications.emitToGlobalRole(
            ['MINREX_CENTRAL_AGENT', 'PLATFORM_ADMIN'],
            {
              type: 'PUBLICATION_ALERT',
              title: 'Publication en attente d’approbation finale',
              message: `La publication "${publication.title}" a passé le niveau 1 et attend votre validation.`,
              priority: 'NORMAL',
              actionUrl: `/agent-central`,
            },
            tx,
          );
        }
      }

      return res;
    });

    return updated;
  }

  /**
   * 9. File d'attente Niveau 2 (Validation finale Chef de Poste / MINREX Central)
   */
  async getLevel2Queue(
    userId: string,
    query: QueryPublicationsDto,
  ) {
    const scope =
      await this.authorizationService.getPostScopeForPermission(
        userId,
        PERMISSIONS.PUBLICATIONS.APPROVE_LEVEL2,
      );
  
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
  
    const where: Record<string, unknown> = {
      status: PublicationStatus.PENDING_LEVEL2_APPROVAL,
    };
  
    if (!scope.isGlobal) {
      if (query.diplomaticPostId) {
        if (
          !scope.postIds.includes(
            query.diplomaticPostId,
          )
        ) {
          throw new ForbiddenException(
            'Vous ne pouvez pas consulter les publications d’un autre poste.',
          );
        }
  
        where.diplomaticPostId =
          query.diplomaticPostId;
      } else {
        where.diplomaticPostId = {
          in: scope.postIds,
        };
      }
    } else if (query.diplomaticPostId) {
      where.diplomaticPostId =
        query.diplomaticPostId;
    }
  
    if (query.type) {
      where.type = query.type;
    }
  
    const [total, items] = await Promise.all([
      this.prisma.publication.count({
        where,
      }),
  
      this.prisma.publication.findMany({
        where,
  
        include: {
          author: {
            select: {
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
  
          diplomaticPost: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
  
          association: {
            select: {
              id: true,
              name: true,
            },
          },
  
          reviews: {
            where: {
              level: PublicationReviewLevel.LEVEL1_MODERATION,
            },
  
            orderBy: {
              createdAt: 'desc',
            },
  
            take: 1,
          },
        },
  
        orderBy: {
          createdAt: 'asc',
        },
  
        skip,
        take: limit,
      }),
    ]);
  
    return {
      items,
  
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 10. Décision Niveau 2 : Approbation finale & Publication officielle
   */
  async reviewLevel2(id: string, approverId: string, dto: ReviewPublicationDto) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    if (publication.status !== PublicationStatus.PENDING_LEVEL2_APPROVAL) {
      throw new BadRequestException('Cette publication n’est pas en attente d’approbation Niveau 2.');
    }

    await this.assertPostPermission(
      approverId,
      PERMISSIONS.PUBLICATIONS.APPROVE_LEVEL2,
      publication.diplomaticPostId,
    );

    let nextStatus: PublicationStatus;
    let notifTitle = '';
    let notifContent = '';
    let isApproved = false;

    if (dto.decision === PublicationReviewDecision.APPROVED_AND_PUBLISHED) {
      nextStatus = PublicationStatus.PUBLISHED;
      isApproved = true;
      notifTitle = 'Votre publication est en ligne !';
      notifContent = `La publication "${publication.title}" a été formellement approuvée et diffusée sur le portail souverain MINREX.`;
    } else if (dto.decision === PublicationReviewDecision.CORRECTION_REQUESTED) {
      if (!dto.comment) {
        throw new BadRequestException('Un commentaire motivant la correction demandée est obligatoire.');
      }
      nextStatus = PublicationStatus.CORRECTION_REQUIRED;
      notifTitle = 'Complément requis par l’autorité supérieure';
      notifContent = `Des corrections complémentaires sont requises pour "${publication.title}". Motif : ${dto.comment}`;
    } else if (dto.decision === PublicationReviewDecision.REJECTED) {
      if (!dto.comment) {
        throw new BadRequestException('Un motif de rejet est obligatoire.');
      }
      nextStatus = PublicationStatus.REJECTED;
      notifTitle = 'Publication rejetée';
      notifContent = `Votre publication "${publication.title}" a été définitivement rejetée au Niveau 2. Motif : ${dto.comment}`;
    } else {
      throw new BadRequestException('Décision de validation Niveau 2 non reconnue.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publication.update({
        where: { id },
        data: {
          status: nextStatus,
          publishedAt: isApproved ? new Date() : undefined,
        },
      });

      await tx.publicationReviewHistory.create({
        data: {
          publicationId: id,
          reviewerId: approverId,
          level: PublicationReviewLevel.LEVEL2_FINAL_APPROVAL,
          decision: dto.decision,
          comment: dto.comment ?? null,
        },
      });

      await this.notifications.emitToUser(
        publication.authorId,
        {
          type: 'PUBLICATION_ALERT',
          priority: isApproved ? 'HIGH' : 'NORMAL',
          title: notifTitle,
          message: notifContent,
          actionUrl: `/publications/${publication.slug}`,
        },
        tx,
      );

      return res;
    });

    return updated;
  }

  /**
   * 11. Mettre à la une (Success Story / Alerte majeure)
   */
  async setFeatured(
    id: string,
    actorId: string,
    isFeatured: boolean,
  ) {
    const publication =
      await this.prisma.publication.findUnique({
        where: { id },
      });
  
    if (!publication) {
      throw new NotFoundException(
        'Publication introuvable.',
      );
    }
  
    await this.assertPostPermission(
      actorId,
      PERMISSIONS.PUBLICATIONS.FEATURE,
      publication.diplomaticPostId,
    );
  
    return this.prisma.publication.update({
      where: { id },
      data: { isFeatured },
    });
  }
  
  async archivePublication(
    id: string,
    actorId: string,
  ) {
    const publication =
      await this.prisma.publication.findUnique({
        where: { id },
      });
  
    if (!publication) {
      throw new NotFoundException(
        'Publication introuvable.',
      );
    }
  
    await this.assertPostPermission(
      actorId,
      PERMISSIONS.PUBLICATIONS.ARCHIVE,
      publication.diplomaticPostId,
    );
  
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publication.update({
        where: { id },
        data: {
          status: PublicationStatus.ARCHIVED,
        },
      });

      await this.notifications.emitToUser(
        publication.authorId,
        {
          type: 'PUBLICATION_ALERT',
          title: 'Publication retirée',
          message: `Votre publication "${publication.title}" a été retirée et archivée.`,
          priority: 'NORMAL',
          actionUrl: `/espace/publications`,
        },
        tx,
      );

      return res;
    });

    return updated;
  }

  /**
   * 13. Supprimer un brouillon de publication
   */
  async deletePublication(
    id: string,
    userId: string,
  ) {
    const publication =
      await this.prisma.publication.findUnique({
        where: { id },
      });
  
    if (!publication) {
      throw new NotFoundException(
        'Publication introuvable.',
      );
    }
  
    const isAuthor =
      publication.authorId === userId;
  
    const hasDeletePermission =
      await this.authorizationService.hasAllPermissions(
        userId,
        [PERMISSIONS.PUBLICATIONS.DELETE],
        {
          postId:
            publication.diplomaticPostId ?? undefined,
        },
      );
  
    if (!isAuthor && !hasDeletePermission) {
      throw new ForbiddenException(
        'Non autorisé à supprimer cette publication.',
      );
    }
  
    if (
      isAuthor &&
      !hasDeletePermission &&
      publication.status !== PublicationStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Seul un brouillon peut être supprimé par son auteur.',
      );
    }
  
    return this.prisma.publication.delete({
      where: { id },
    });
  }
  private async assertPostPermission(
    userId: string,
    permission: string,
    postId: string | null,
  ): Promise<void> {
    const authorized =
      await this.authorizationService.hasAllPermissions(
        userId,
        [permission],
        {
          postId: postId ?? undefined,
        },
      );
  
    if (!authorized) {
      throw new ForbiddenException(
        'Vous ne disposez pas de cette permission pour le poste diplomatique concerné.',
      );
    }
  }
}