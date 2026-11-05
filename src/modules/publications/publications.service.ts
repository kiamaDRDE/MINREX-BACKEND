import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationPriority,
  NotificationType,
  PublicationReviewDecision,
  PublicationReviewLevel,
  PublicationStatus,
  PublicationTargetScope,
  RoleScope,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { NotificationEventBusService } from '../notifications/events/notification-event-bus.service.js';
import { CreatePublicationDto } from './dto/create-publication.dto.js';
import { QueryPublicationsDto } from './dto/query-publications.dto.js';
import { ReviewPublicationDto } from './dto/review-publication.dto.js';
import { UpdatePublicationDto } from './dto/update-publication.dto.js';

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: NotificationEventBusService,
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

    if (dto.associationId) {
      const association = await this.prisma.association.findUnique({
        where: { id: dto.associationId },
        select: { id: true, status: true },
      });
      if (!association) {
        throw new BadRequestException('L’association spécifiée est introuvable.');
      }
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
        diplomaticPostId: dto.diplomaticPostId ?? null,
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
  async getPublicationBySlugOrId(identifier: string, userId?: string, isStaff: boolean = false) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const publication = await this.prisma.publication.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, photoUrl: true } },
          },
        },
        diplomaticPost: { select: { id: true, name: true, city: true, code: true } },
        association: { select: { id: true, name: true, acronym: true, logoUrl: true } },
        reviews: isStaff || Boolean(userId)
          ? {
              orderBy: { createdAt: 'desc' },
              include: {
                reviewer: {
                  select: {
                    profile: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            }
          : false,
      },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    // Protection : si non publiée, seuls l'auteur ou le personnel habilité peuvent la lire
    if (publication.status !== PublicationStatus.PUBLISHED && !isStaff) {
      if (publication.authorId !== userId) {
        throw new ForbiddenException(
          'Cette publication est en cours de modération et n’est pas encore publique.',
        );
      }
    }

    // Incrément du compteur de vues lors d'une lecture publique
    if (publication.status === PublicationStatus.PUBLISHED) {
      await this.prisma.publication.update({
        where: { id: publication.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return publication;
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

    const updated = await this.prisma.publication.update({
      where: { id },
      data: { status: PublicationStatus.PENDING_LEVEL1_REVIEW },
    });

    this.eventBus.emit({
      recipientId: authorId,
      type: NotificationType.PUBLICATION_ALERT,
      priority: NotificationPriority.NORMAL,
      title: 'Publication transmise pour modération',
      content: `Votre publication "${publication.title}" est en attente d’instruction par le service territorial (Niveau 1).`,
      actionUrl: `/espace/publications/${id}`,
    });

    return updated;
  }

  /**
   * 7. File d'attente Niveau 1 (Modération territoriale / consulaire)
   */
  async getLevel1Queue(userId: string, query: QueryPublicationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, isActive: true },
      include: { role: true },
    });
    const isGlobal = assignments.some((a) => a.role.scope === RoleScope.GLOBAL);
    const assignedPostId = assignments.find((a) => a.postId)?.postId;

    const where: Record<string, unknown> = {
      status: PublicationStatus.PENDING_LEVEL1_REVIEW,
    };

    if (!isGlobal && assignedPostId) {
      where.diplomaticPostId = assignedPostId;
    } else if (query.diplomaticPostId) {
      where.diplomaticPostId = query.diplomaticPostId;
    }

    if (query.type) where.type = query.type;

    const [total, items] = await Promise.all([
      this.prisma.publication.count({ where }),
      this.prisma.publication.findMany({
        where,
        include: {
          author: {
            select: {
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
          diplomaticPost: { select: { id: true, name: true, city: true } },
          association: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
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

      return res;
    });

    this.eventBus.emit({
      recipientId: publication.authorId,
      type: NotificationType.PUBLICATION_ALERT,
      priority:
        dto.decision === PublicationReviewDecision.CORRECTION_REQUESTED
          ? NotificationPriority.HIGH
          : NotificationPriority.NORMAL,
      title: notifTitle,
      content: notifContent,
      actionUrl: `/espace/publications/${id}`,
    });

    return updated;
  }

  /**
   * 9. File d'attente Niveau 2 (Validation finale Chef de Poste / MINREX Central)
   */
  async getLevel2Queue(userId: string, query: QueryPublicationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, isActive: true },
      include: { role: true },
    });
    const isGlobal = assignments.some((a) => a.role.scope === RoleScope.GLOBAL);
    const assignedPostId = assignments.find((a) => a.postId)?.postId;

    const where: Record<string, unknown> = {
      status: PublicationStatus.PENDING_LEVEL2_APPROVAL,
    };

    if (!isGlobal && assignedPostId) {
      where.diplomaticPostId = assignedPostId;
    } else if (query.diplomaticPostId) {
      where.diplomaticPostId = query.diplomaticPostId;
    }

    if (query.type) where.type = query.type;

    const [total, items] = await Promise.all([
      this.prisma.publication.count({ where }),
      this.prisma.publication.findMany({
        where,
        include: {
          author: {
            select: {
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
          diplomaticPost: { select: { id: true, name: true, city: true } },
          association: { select: { id: true, name: true } },
          reviews: {
            where: { level: PublicationReviewLevel.LEVEL1_MODERATION },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
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

      return res;
    });

    this.eventBus.emit({
      recipientId: publication.authorId,
      type: NotificationType.PUBLICATION_ALERT,
      priority: isApproved ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      title: notifTitle,
      content: notifContent,
      actionUrl: `/publications/${publication.slug}`,
    });

    return updated;
  }

  /**
   * 11. Mettre à la une (Success Story / Alerte majeure)
   */
  async setFeatured(id: string, isFeatured: boolean) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    return this.prisma.publication.update({
      where: { id },
      data: { isFeatured },
    });
  }

  /**
   * 12. Archiver une publication
   */
  async archivePublication(id: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    return this.prisma.publication.update({
      where: { id },
      data: { status: PublicationStatus.ARCHIVED },
    });
  }

  /**
   * 13. Supprimer un brouillon de publication
   */
  async deletePublication(id: string, authorId: string, isAdmin: boolean = false) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
    });

    if (!publication) {
      throw new NotFoundException('Publication introuvable.');
    }

    if (!isAdmin && publication.authorId !== authorId) {
      throw new ForbiddenException('Non autorisé à supprimer cette publication.');
    }

    if (!isAdmin && publication.status !== PublicationStatus.DRAFT) {
      throw new BadRequestException('Seul un brouillon peut être supprimé par son auteur.');
    }

    return this.prisma.publication.delete({
      where: { id },
    });
  }
}

