import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssociationCategory,
  AssociationHistoryAction,
  AssociationMemberRole,
  AssociationStatus,
  DiplomaticPostStatus,
  NotificationPriority,
  NotificationType,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { NotificationEventBusService } from '../notifications/events/notification-event-bus.service.js';
import {
  AddAssociationMemberDto,
  UpdateAssociationMemberDto,
} from './dto/add-association-member.dto.js';
import { CreateAssociationDto } from './dto/create-association.dto.js';
import { QueryAssociationsDto } from './dto/query-associations.dto.js';
import {
  RejectAssociationDto,
  RequestCorrectionDto,
  SuspendAssociationDto,
} from './dto/review-association.dto.js';
import { UpdateAssociationDto } from './dto/update-association.dto.js';
import { UploadAssociationDocumentDto } from './dto/upload-association-doc.dto.js';
import {
  AuthorizationService,
} from '../identity/authorization/authorization.service.js';

import {
  PERMISSIONS,
} from '../identity/authorization/constants/permissions.constants.js';

@Injectable()
export class AssociationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: NotificationEventBusService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * 1. Création d'un brouillon d'association (Citoyen)
   */
  async createAssociation(userId: string, dto: CreateAssociationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const country = await this.prisma.country.findUnique({
      where: { id: dto.countryId },
      select: { id: true, iso2Code: true, name: true, isActive: true },
    });

    if (!country || !country.isActive) {
      throw new BadRequestException('Le pays sélectionné est invalide ou inactif.');
    }

    // Résolution du poste diplomatique compétent
    const now = new Date();
    const coverages = await this.prisma.postCoverage.findMany({
      where: {
        countryId: dto.countryId,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        post: { status: DiplomaticPostStatus.ACTIVE },
      },
      select: { postId: true, post: { select: { id: true, city: true, code: true } } },
      orderBy: { startDate: 'desc' },
    });

    if (coverages.length === 0) {
      throw new BadRequestException(
        'Aucun poste diplomatique ou consulaire camerounais n’est actuellement compétent pour ce pays.',
      );
    }

    // Si une ville correspond à un consulat de proximité (ex: Marseille pour le Sud de la France)
    let selectedPostId = coverages[0]!.postId;
    const cityClean = dto.city.trim().toLowerCase();
    const specificPost = coverages.find(
      (c) => c.post.city && cityClean.includes(c.post.city.toLowerCase()),
    );
    if (specificPost) {
      selectedPostId = specificPost.postId;
    }

    // Génération du code unique : ASSOC-CMR-[ISO2]-[ANNEE]-[RANDOM]
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `ASSOC-CMR-${country.iso2Code.toUpperCase()}-${year}-${randomSuffix}`;

    const creationDate = dto.creationDate ? new Date(dto.creationDate) : null;

    return this.prisma.$transaction(async (tx) => {
      const association = await tx.association.create({
        data: {
          code,
          name: dto.name,
          acronym: dto.acronym,
          category: dto.category ?? AssociationCategory.COMMUNITY,
          description: dto.description,
          objectives: dto.objectives,
          creationDate,
          countryId: dto.countryId,
          city: dto.city,
          address: dto.address,
          postalCode: dto.postalCode,
          email: dto.email,
          phone: dto.phone,
          websiteUrl: dto.websiteUrl,
          logoUrl: dto.logoUrl,
          diplomaticPostId: selectedPostId,
          creatorId: userId,
          status: AssociationStatus.DRAFT,
        },
      });

      // Rattachement du créateur comme Président / Responsable légal
      await tx.associationMembership.create({
        data: {
          associationId: association.id,
          userId,
          role: dto.myRoleInAssociation ?? AssociationMemberRole.PRESIDENT,
          isLegalRepresentative: true,
          title: dto.myTitleInAssociation ?? 'Président Fondateur',
        },
      });

      // Historique initial
      await tx.associationHistory.create({
        data: {
          associationId: association.id,
          actorId: userId,
          action: AssociationHistoryAction.CREATED,
          toStatus: AssociationStatus.DRAFT,
          comment: 'Création du dossier d’association (Brouillon).',
        },
      });

      return association;
    });
  }

  /**
   * 2. Liste des associations de l'utilisateur connecté
   */
  async getMyAssociations(userId: string) {
    return this.prisma.association.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { memberships: { some: { userId } } },
        ],
      },
      include: {
        country: { select: { id: true, name: true, iso2Code: true } },
        diplomaticPost: { select: { id: true, name: true, city: true, code: true } },
        memberships: {
          where: { userId },
          select: { role: true, isLegalRepresentative: true, title: true },
        },
        _count: { select: { documents: true, memberships: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 3. Détail complet d'une association
   */
  async getAssociationById(
    id: string,
    userId?: string,
  ) {
    const association =
      await this.prisma.association.findUnique({
        where: { id },
  
        include: {
          country: {
            select: {
              id: true,
              name: true,
              iso2Code: true,
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
  
          memberships: {
            include: {
              user: {
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
            },
  
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      });
  
    if (!association) {
      throw new NotFoundException(
        'Association introuvable.',
      );
    }
  
    const membership =
      association.memberships.find(
        (item) =>
          item.userId === userId &&
          item.isActive,
      );
  
    const isOwner =
      association.creatorId === userId;
  
    const isStaff = userId
      ? await this.authorizationService.hasAllPermissions(
          userId,
          [PERMISSIONS.ASSOCIATIONS.READ],
          {
            postId: association.diplomaticPostId,
          },
        )
      : false;
  
    const isMember = Boolean(membership);
  
    if (
      association.status !== AssociationStatus.APPROVED &&
      !isStaff &&
      !isMember &&
      !isOwner
    ) {
      throw new ForbiddenException(
        'Cette association est en cours d’instruction et n’est pas encore publique.',
      );
    }
  
    const canSeeMembers =
      isStaff || isMember || isOwner;
  
    const canSeeSensitiveDocuments =
      isStaff ||
      isOwner ||
      Boolean(membership?.isLegalRepresentative);
  
    const [documents, history] =
      canSeeSensitiveDocuments
        ? await Promise.all([
            this.prisma.associationDocument.findMany({
              where: {
                associationId: id,
              },
  
              select: {
                id: true,
                type: true,
                title: true,
                fileUrl: true,
                fileSize: true,
                mimeType: true,
                createdAt: true,
              },
            }),
  
            this.prisma.associationHistory.findMany({
              where: {
                associationId: id,
              },
  
              orderBy: {
                createdAt: 'desc',
              },
  
              include: {
                actor: {
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
            }),
          ])
        : [[], []];
  
    return {
      ...association,
  
      memberships: canSeeMembers
        ? association.memberships
        : [],
  
      documents,
      history,
    };
  }

  /**
   * 4. Mise à jour des informations de l'association
   */
  async updateAssociation(id: string, userId: string, dto: UpdateAssociationDto) {
    const association = await this.prisma.association.findUnique({
      where: { id },
      include: {
        memberships: { where: { userId, isActive: true } },
      },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const membership = association.memberships[0];
    const isOwner = association.creatorId === userId;
    const isRep = membership?.isLegalRepresentative || isOwner;

    if (!isRep) {
      throw new ForbiddenException(
        'Seul le représentant légal ou le créateur peut modifier ce dossier.',
      );
    }

    if (
      association.status !== AssociationStatus.DRAFT &&
      association.status !== AssociationStatus.CORRECTION_REQUIRED
    ) {
      throw new BadRequestException(
        'Une association en cours d’instruction ou déjà approuvée ne peut être modifiée directement.',
      );
    }

    const data = Object.assign({}, dto) as Record<string, unknown>;
    if (dto.creationDate) {
      data.creationDate = new Date(dto.creationDate);
    }

    return this.prisma.association.update({
      where: { id },
      data,
    });
  }

  /**
   * 5. Soumission officielle pour instruction consulaire
   */
  async submitAssociation(id: string, userId: string) {
    const association = await this.prisma.association.findUnique({
      where: { id },
      include: {
        documents: true,
        memberships: { where: { userId } },
        diplomaticPost: { select: { name: true } },
      },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const isMember = association.memberships.length > 0;
    if (association.creatorId !== userId && !isMember) {
      throw new ForbiddenException('Non autorisé à soumettre ce dossier.');
    }

    if (
      association.status !== AssociationStatus.DRAFT &&
      association.status !== AssociationStatus.CORRECTION_REQUIRED
    ) {
      throw new BadRequestException('Ce dossier a déjà été soumis pour validation.');
    }

    if (association.documents.length === 0) {
      throw new BadRequestException(
        'Vous devez téléverser au moins un document justificatif (statuts ou récépissé) avant de soumettre.',
      );
    }

    const isResubmission = association.status === AssociationStatus.CORRECTION_REQUIRED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.association.update({
        where: { id },
        data: {
          status: AssociationStatus.SUBMITTED,
          submissionDate: new Date(),
        },
      });

      await tx.associationHistory.create({
        data: {
          associationId: id,
          actorId: userId,
          action: isResubmission
            ? AssociationHistoryAction.RESUBMITTED
            : AssociationHistoryAction.SUBMITTED,
          fromStatus: association.status,
          toStatus: AssociationStatus.SUBMITTED,
          comment: isResubmission
            ? 'Dossier re-soumis après corrections demandées.'
            : 'Soumission officielle pour instruction consulaire.',
        },
      });

      return res;
    });

    // Émission de notification au déclarant
    this.eventBus.emit({
      recipientId: userId,
      type: NotificationType.ASSOCIATION_STATUS,
      priority: NotificationPriority.NORMAL,
      title: 'Dossier d’association soumis avec succès',
      content: `Votre dossier pour "${association.name}" a été transmis au poste : ${association.diplomaticPost.name}. L’instruction administrative est en cours.`,
      actionUrl: `/espace/associations/${id}`,
    });

    return updated;
  }

  /**
   * 6. Téléversement de pièces justificatives
   */
  async uploadDocument(associationId: string, userId: string, dto: UploadAssociationDocumentDto) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
      include: { memberships: { where: { userId } } },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const isMember = association.memberships.length > 0;
    if (association.creatorId !== userId && !isMember) {
      throw new ForbiddenException('Non autorisé à ajouter un document.');
    }

    return this.prisma.associationDocument.create({
      data: {
        associationId,
        type: dto.type,
        title: dto.title,
        fileUrl: dto.fileUrl,
        fileKey: dto.fileKey,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        uploadedById: userId,
      },
    });
  }

  /**
   * 7. Consultation exhaustive des membres d'une association (Demande Utilisateur)
   */
  async getMembers(
    associationId: string,
    userId: string,
  ) {
    const association =
      await this.prisma.association.findUnique({
        where: {
          id: associationId,
        },
  
        select: {
          id: true,
          creatorId: true,
          diplomaticPostId: true,
        },
      });
  
    if (!association) {
      throw new NotFoundException(
        'Association introuvable.',
      );
    }
  
    const [membership, isStaff] =
      await Promise.all([
        this.prisma.associationMembership.findFirst({
          where: {
            associationId,
            userId,
            isActive: true,
          },
  
          select: {
            id: true,
          },
        }),
  
        this.authorizationService.hasAllPermissions(
          userId,
          [PERMISSIONS.ASSOCIATIONS.READ],
          {
            postId: association.diplomaticPostId,
          },
        ),
      ]);
  
    const isOwner =
      association.creatorId === userId;
  
    if (!isOwner && !membership && !isStaff) {
      throw new ForbiddenException(
        'Vous n’êtes pas autorisé à consulter les membres de cette association.',
      );
    }
  
    return this.prisma.associationMembership.findMany({
      where: {
        associationId,
        isActive: true,
      },
  
      include: {
        user: {
          select: {
            id: true,
            email: true,
  
            profile: {
              select: {
                firstName: true,
                lastName: true,
                photoUrl: true,
                residenceCountry: true,
              },
            },
          },
        },
      },
  
      orderBy: [
        { isLegalRepresentative: 'desc' },
        { joinedAt: 'asc' },
      ],
    });
  }

  /**
   * 8. Ajout d'un membre / responsable
   */
  async addMember(associationId: string, authorId: string, dto: AddAssociationMemberDto) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
      include: { memberships: { where: { userId: authorId } } },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const membership = association.memberships[0];
    const isOwner = association.creatorId === authorId;
    if (!isOwner && !membership?.isLegalRepresentative) {
      throw new ForbiddenException('Seul le représentant légal peut ajouter un membre.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      throw new NotFoundException(
        `Aucun compte utilisateur MINREX trouvé pour l’email : ${dto.email}. Le membre doit d’abord créer un compte.`,
      );
    }

    const existingMembership = await this.prisma.associationMembership.findUnique({
      where: {
        associationId_userId: {
          associationId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new BadRequestException('Cet utilisateur est déjà membre de l’association.');
    }

    const newMembership = await this.prisma.associationMembership.create({
      data: {
        associationId,
        userId: targetUser.id,
        role: dto.role,
        isLegalRepresentative: dto.isLegalRepresentative,
        title: dto.title,
      },
    });

    this.eventBus.emit({
      recipientId: targetUser.id,
      type: NotificationType.ASSOCIATION_STATUS,
      priority: NotificationPriority.NORMAL,
      title: 'Ajout à une association',
      content: `Vous avez été ajouté au bureau de l’association "${association.name}" avec la fonction : ${dto.title ?? dto.role}.`,
      actionUrl: `/espace/associations/${associationId}`,
    });

    return newMembership;
  }

  /**
   * 9. Mise à jour d'un membre
   */
  async updateMember(
    associationId: string,
    membershipId: string,
    authorId: string,
    dto: UpdateAssociationMemberDto,
  ) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
      include: { memberships: { where: { userId: authorId } } },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const isOwner = association.creatorId === authorId;
    const authorMem = association.memberships[0];
    if (!isOwner && !authorMem?.isLegalRepresentative) {
      throw new ForbiddenException('Non autorisé à modifier ce membre.');
    }

    const targetMembership = await this.prisma.associationMembership.findUnique({
      where: { id: membershipId },
    });

    if (!targetMembership || targetMembership.associationId !== associationId) {
      throw new NotFoundException('Adhésion introuvable.');
    }

    return this.prisma.associationMembership.update({
      where: { id: membershipId },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.isLegalRepresentative !== undefined
          ? { isLegalRepresentative: dto.isLegalRepresentative }
          : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * 10. Révocation / Retrait d'un membre
   */
  async removeMember(associationId: string, membershipId: string, authorId: string) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
      include: { memberships: true },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const authorMem = association.memberships.find((m) => m.userId === authorId);
    const isOwner = association.creatorId === authorId;
    if (!isOwner && !authorMem?.isLegalRepresentative) {
      throw new ForbiddenException('Non autorisé à révoquer ce membre.');
    }

    const targetMem = association.memberships.find((m) => m.id === membershipId);
    if (!targetMem) {
      throw new NotFoundException('Membre introuvable.');
    }

    // Protection : on ne peut pas supprimer le créateur ou le dernier représentant légal
    if (targetMem.userId === association.creatorId) {
      throw new BadRequestException('Le créateur de l’association ne peut être révoqué.');
    }

    const legalReps = association.memberships.filter((m) => m.isLegalRepresentative);
    if (targetMem.isLegalRepresentative && legalReps.length <= 1) {
      throw new BadRequestException(
        'Impossible de révoquer le seul représentant légal restant de l’association.',
      );
    }

    return this.prisma.associationMembership.delete({
      where: { id: membershipId },
    });
  }

  /**
   * 11. Annuaire public : Recherche des associations APPROVED
   */
  async getDirectory(query: QueryAssociationsDto) {
    const { q, countryId, category, diplomaticPostId, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      status: AssociationStatus.APPROVED,
    };

    if (countryId) where.countryId = countryId;
    if (category) where.category = category;
    if (diplomaticPostId) where.diplomaticPostId = diplomaticPostId;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { acronym: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.association.count({ where }),
      this.prisma.association.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          acronym: true,
          category: true,
          description: true,
          city: true,
          email: true,
          phone: true,
          websiteUrl: true,
          logoUrl: true,
          creationDate: true,
          country: { select: { id: true, name: true, iso2Code: true } },
          diplomaticPost: { select: { id: true, name: true, city: true } },
          _count: { select: { memberships: true } },
        },
        orderBy: { name: 'asc' },
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
   * 12. File d'attente consulaire des associations à instruire
   */
  async getAgentQueue(
    userId: string,
    query?: QueryAssociationsDto,
  ) {
    const scope =
      await this.authorizationService.getPostScopeForPermission(
        userId,
        PERMISSIONS.ASSOCIATIONS.READ,
      );
  
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;
  
    const where: Record<string, unknown> = {};
  
    if (!scope.isGlobal) {
      if (query?.diplomaticPostId) {
        if (
          !scope.postIds.includes(
            query.diplomaticPostId,
          )
        ) {
          throw new ForbiddenException(
            'Vous ne pouvez pas consulter la file d’un autre poste diplomatique.',
          );
        }
  
        where.diplomaticPostId =
          query.diplomaticPostId;
      } else {
        where.diplomaticPostId = {
          in: scope.postIds,
        };
      }
    } else if (query?.diplomaticPostId) {
      where.diplomaticPostId =
        query.diplomaticPostId;
    }
  
    if (query?.status) {
      where.status = query.status;
    } else {
      where.status = {
        in: [
          AssociationStatus.SUBMITTED,
          AssociationStatus.UNDER_REVIEW,
          AssociationStatus.CORRECTION_REQUIRED,
        ],
      };
    }
  
    const [total, items] = await Promise.all([
      this.prisma.association.count({
        where,
      }),
  
      this.prisma.association.findMany({
        where,
  
        include: {
          country: {
            select: {
              name: true,
              iso2Code: true,
            },
          },
  
          creator: {
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
  
          _count: {
            select: {
              documents: true,
              memberships: true,
            },
          },
        },
  
        orderBy: {
          submissionDate: 'asc',
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
   * 13. Prise en charge de l'instruction par un agent consulaire (UNDER_REVIEW)
   */
  async startReview(associationId: string, agentId: string) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    if (association.status !== AssociationStatus.SUBMITTED) {
      throw new BadRequestException('Seul un dossier soumis peut passer en cours d’examen.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.association.update({
        where: { id: associationId },
        data: { status: AssociationStatus.UNDER_REVIEW },
      });

      await tx.associationHistory.create({
        data: {
          associationId,
          actorId: agentId,
          action: AssociationHistoryAction.REVIEW_STARTED,
          fromStatus: AssociationStatus.SUBMITTED,
          toStatus: AssociationStatus.UNDER_REVIEW,
          comment: 'Prise en charge de l’instruction par le service consulaire.',
        },
      });

      return updated;
    });
  }

  /**
   * 14. Demande de correction motivée (CORRECTION_REQUIRED)
   */
  async requestCorrection(associationId: string, agentId: string, dto: RequestCorrectionDto) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
      include: { creator: true },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.association.update({
        where: { id: associationId },
        data: {
          status: AssociationStatus.CORRECTION_REQUIRED,
        },
      });

      await tx.associationHistory.create({
        data: {
          associationId,
          actorId: agentId,
          action: AssociationHistoryAction.CORRECTION_REQUESTED,
          fromStatus: association.status,
          toStatus: AssociationStatus.CORRECTION_REQUIRED,
          comment: dto.motive,
        },
      });

      return res;
    });

    this.eventBus.emit({
      recipientId: association.creatorId,
      type: NotificationType.ASSOCIATION_STATUS,
      priority: NotificationPriority.HIGH,
      title: 'Compléments requis pour votre association',
      content: `Le service consulaire a examiné le dossier de "${association.name}". Motif : ${dto.motive}`,
      actionUrl: `/espace/associations/${associationId}`,
    });

    return updated;
  }

  /**
   * 15. Approbation formelle (APPROVED)
   */
  async approveAssociation(associationId: string, validatorId: string) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    if (
      association.status !== AssociationStatus.SUBMITTED &&
      association.status !== AssociationStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('Ce dossier n’est pas en état d’être approuvé.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.association.update({
        where: { id: associationId },
        data: {
          status: AssociationStatus.APPROVED,
          validatedAt: new Date(),
          validatedById: validatorId,
        },
      });

      await tx.associationHistory.create({
        data: {
          associationId,
          actorId: validatorId,
          action: AssociationHistoryAction.APPROVED,
          fromStatus: association.status,
          toStatus: AssociationStatus.APPROVED,
          comment: 'Approbation formelle et certification consulaire accordées.',
        },
      });

      return res;
    });

    this.eventBus.emit({
      recipientId: association.creatorId,
      type: NotificationType.ASSOCIATION_STATUS,
      priority: NotificationPriority.HIGH,
      title: 'Félicitations ! Votre association est certifiée',
      content: `L’association "${association.name}" a été officiellement enregistrée et certifiée par le MINREX (N° ${association.code}). Elle figure désormais dans l’annuaire officiel.`,
      actionUrl: `/espace/associations/${associationId}`,
    });

    return updated;
  }

  /**
   * 16. Rejet définitif motivé (REJECTED)
   */
  async rejectAssociation(associationId: string, validatorId: string, dto: RejectAssociationDto) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.association.update({
        where: { id: associationId },
        data: {
          status: AssociationStatus.REJECTED,
          rejectionReason: dto.motive,
        },
      });

      await tx.associationHistory.create({
        data: {
          associationId,
          actorId: validatorId,
          action: AssociationHistoryAction.REJECTED,
          fromStatus: association.status,
          toStatus: AssociationStatus.REJECTED,
          comment: dto.motive,
        },
      });

      return res;
    });

    this.eventBus.emit({
      recipientId: association.creatorId,
      type: NotificationType.ASSOCIATION_STATUS,
      priority: NotificationPriority.HIGH,
      title: 'Dossier d’association non retenu',
      content: `Votre demande d’enregistrement pour "${association.name}" a été rejetée. Motif : ${dto.motive}`,
      actionUrl: `/espace/associations/${associationId}`,
    });

    return updated;
  }

  /**
   * 17. Suspension administrative (SUSPENDED)
   */
  async suspendAssociation(associationId: string, validatorId: string, dto: SuspendAssociationDto) {
    const association = await this.prisma.association.findUnique({
      where: { id: associationId },
    });

    if (!association) {
      throw new NotFoundException('Association introuvable.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.association.update({
        where: { id: associationId },
        data: {
          status: AssociationStatus.SUSPENDED,
          suspensionReason: dto.motive,
        },
      });

      await tx.associationHistory.create({
        data: {
          associationId,
          actorId: validatorId,
          action: AssociationHistoryAction.SUSPENDED,
          fromStatus: association.status,
          toStatus: AssociationStatus.SUSPENDED,
          comment: dto.motive,
        },
      });

      return res;
    });

    this.eventBus.emit({
      recipientId: association.creatorId,
      type: NotificationType.ASSOCIATION_STATUS,
      priority: NotificationPriority.HIGH,
      title: 'Association suspendue administrativement',
      content: `L’enregistrement de "${association.name}" a été temporairement suspendu. Motif : ${dto.motive}`,
      actionUrl: `/espace/associations/${associationId}`,
    });

    return updated;
  }
  private async assertPostPermission(
    userId: string,
    permission: string,
    postId: string,
  ): Promise<void> {
    const authorized =
      await this.authorizationService.hasAllPermissions(
        userId,
        [permission],
        { postId },
      );
  
    if (!authorized) {
      throw new ForbiddenException(
        'Vous ne disposez pas de cette permission pour le poste diplomatique concerné.',
      );
    }
  }
}
