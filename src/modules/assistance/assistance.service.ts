import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import {
  AssistanceCaseStatus,
  AssistanceHistoryAction,
  AssistanceType,
  AssistanceUrgency,
  DiplomaticPostStatus,
} from '../../generated/prisma/enums.js';

import { PrismaService } from '../../infrastructure/database/prisma.service.js';

import { NotificationEventBusService } from '../notifications/services/notification-event-bus.service.js';

import { CreateAssistanceCaseDto } from './dto/create-assistance-case.dto.js';
import { PROTOCOL_CATEGORY_INCLUDE } from './protocols/assistance-protocols.service.js';

const CATEGORY_CODE_TO_ASSISTANCE_TYPE: Record<string, AssistanceType> = {
  ARRESTATION: AssistanceType.ARREST_DETENTION,
  ARREST_DETENTION: AssistanceType.ARREST_DETENTION,
  ACCIDENT_MALADIE: AssistanceType.MEDICAL_EMERGENCY,
  ACCIDENT: AssistanceType.ACCIDENT,
  MEDICAL_EMERGENCY: AssistanceType.MEDICAL_EMERGENCY,
  DECES: AssistanceType.DEATH,
  DEATH: AssistanceType.DEATH,
  CRISE_MAJEURE: AssistanceType.REPATRIATION,
  REPATRIATION: AssistanceType.REPATRIATION,
  DISPARITION: AssistanceType.LEGAL_ASSISTANCE,
  LEGAL_ASSISTANCE: AssistanceType.LEGAL_ASSISTANCE,
  PERTE_DOCUMENTS: AssistanceType.DOCUMENT_LOSS,
  DOCUMENT_LOSS: AssistanceType.DOCUMENT_LOSS,
  VIOLENCE_ABUSE: AssistanceType.VIOLENCE_ABUSE,
  SECOURS_URGENCE: AssistanceType.OTHER,
};

function normalizeGeoText(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getPostRoutingPriority(typeCode?: string | null, isRoot?: boolean): number {
  const code = (typeCode ?? '').toUpperCase();
  if (code === 'AMBASSADE' || code === 'EMBASSY') return isRoot ? 100 : 90;
  if (code === 'HAUT_COMMISSARIAT' || code === 'HIGH_COMMISSION') {
    return isRoot ? 95 : 85;
  }
  if (code === 'CONSULAT_GENERAL') return isRoot ? 75 : 70;
  if (code === 'CONSULAT') return 60;
  if (code === 'MISSION_PERMANENTE' || code === 'PERMANENT_MISSION') return 40;
  if (code === 'CONSULAT_HONORAIRE') return 30;
  return isRoot ? 50 : 20;
}

@Injectable()
export class AssistanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationEventBusService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Create assistance request
  |--------------------------------------------------------------------------
  */

  async createMyCase(userId: string, dto: CreateAssistanceCaseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    /*
    |--------------------------------------------------------------------------
    | Resolve optional DB AssistanceCategory protocol
    |--------------------------------------------------------------------------
    */

    let resolvedCategory: {
      id: string;
      code: string;
      defaultUrgency: AssistanceUrgency;
    } | null = null;

    if (dto.categoryId || dto.categoryCode) {
      const category = await this.prisma.assistanceCategory.findFirst({
        where: dto.categoryId
          ? { id: dto.categoryId, isActive: true }
          : {
              code: {
                equals: dto.categoryCode!.trim().toUpperCase(),
                mode: 'insensitive',
              },
              isActive: true,
            },
        select: {
          id: true,
          code: true,
          defaultUrgency: true,
        },
      });

      if (!category) {
        throw new BadRequestException(
          'The selected assistance protocol category is invalid or inactive.',
        );
      }

      resolvedCategory = category;
    }

    const resolvedType: AssistanceType =
      dto.type ??
      (resolvedCategory
        ? (CATEGORY_CODE_TO_ASSISTANCE_TYPE[resolvedCategory.code.toUpperCase()] ??
          AssistanceType.OTHER)
        : AssistanceType.OTHER);

    const resolvedUrgency: AssistanceUrgency =
      dto.urgency ?? resolvedCategory?.defaultUrgency ?? AssistanceUrgency.NORMAL;

    /*
    |--------------------------------------------------------------------------
    | Validate country
    |--------------------------------------------------------------------------
    */

    const country = await this.prisma.country.findUnique({
      where: { id: dto.countryId },
      select: { id: true, name: true, isActive: true },
    });

    if (!country || !country.isActive) {
      throw new BadRequestException(
        'The selected country is invalid or inactive.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Find active diplomatic coverage and resolve competent post deterministically
    |--------------------------------------------------------------------------
    */

    const now = new Date();

    const coverages = await this.prisma.postCoverage.findMany({
      where: {
        countryId: dto.countryId,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        post: { status: DiplomaticPostStatus.ACTIVE },
      },
      select: {
        postId: true,
        startDate: true,
        post: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            parentPostId: true,
            type: {
              select: { code: true },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    if (coverages.length === 0) {
      throw new BadRequestException(
        'No active diplomatic post currently covers this country.',
      );
    }

    // Deduplicate covering posts
    const coveringPostsMap = new Map<string, (typeof coverages)[number]['post']>();
    for (const cov of coverages) {
      if (!coveringPostsMap.has(cov.postId)) {
        coveringPostsMap.set(cov.postId, cov.post);
      }
    }
    const coveringPosts = Array.from(coveringPostsMap.values());

    let assignedPostId: string | undefined;

    // 1. Honor preferredPostId if it actively covers this country
    if (dto.preferredPostId && coveringPostsMap.has(dto.preferredPostId)) {
      assignedPostId = dto.preferredPostId;
    }

    // 2. Match citizen city to a covering post's city (e.g., Marseille -> Consulat à Marseille)
    if (!assignedPostId && dto.city) {
      const normalizedCity = normalizeGeoText(dto.city);
      const cityMatch = coveringPosts.find(
        (p) => p.city && normalizeGeoText(p.city) === normalizedCity,
      );
      if (cityMatch) {
        assignedPostId = cityMatch.id;
      }
    }

    // 3. Fallback deterministically to the highest-ranking root diplomatic post (Ambassade / Haut-Commissariat)
    if (!assignedPostId) {
      const ranked = [...coveringPosts].sort((a, b) => {
        const scoreDiff =
          getPostRoutingPriority(b.type?.code, b.parentPostId === null) -
          getPostRoutingPriority(a.type?.code, a.parentPostId === null);
        if (scoreDiff !== 0) return scoreDiff;
        return a.name.localeCompare(b.name);
      });
      assignedPostId = ranked[0]?.id;
    }

    if (!assignedPostId) {
      throw new BadRequestException(
        'Unable to determine the competent diplomatic post.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Create case + history + notifications atomically
    |--------------------------------------------------------------------------
    */

    const reference = this.generateReference();

    const assistanceCase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assistanceCase.create({
        data: {
          reference,
          requesterId: userId,
          type: resolvedType,
          categoryId: resolvedCategory?.id ?? null,
          urgency: resolvedUrgency,
          status: AssistanceCaseStatus.SUBMITTED,
          subject: dto.subject,
          description: dto.description,
          countryId: dto.countryId,
          city: dto.city ?? null,
          address: dto.address ?? null,
          contactEmail: dto.contactEmail ?? user.email ?? null,
          contactPhone: dto.contactPhone ?? user.phone ?? null,
          assignedPostId,
          routedAt: now,
          currentStepNumber: 1,
        },
        include: {
          category: { include: PROTOCOL_CATEGORY_INCLUDE },
          country: {
            select: { id: true, iso2Code: true, iso3Code: true, name: true },
          },
          assignedPost: {
            select: { id: true, code: true, name: true, city: true, address: true },
          },
          history: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              action: true,
              fromStatus: true,
              toStatus: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      });

      await tx.assistanceCaseHistory.create({
        data: {
          caseId: created.id,
          actorId: userId,
          action: AssistanceHistoryAction.CREATED,
          fromStatus: null,
          toStatus: AssistanceCaseStatus.SUBMITTED,
          comment:
            'Assistance request created and routed to the competent diplomatic post.',
        },
      });

      await this.notifications.emitToUser(
        userId,
        {
          type: 'ASSISTANCE_STATUS',
          title: 'Demande d’assistance soumise',
          message:
            'Votre demande d’assistance a été enregistrée et transmise au poste consulaire.',
          priority:
            resolvedUrgency === AssistanceUrgency.CRITICAL ? 'URGENT' : 'NORMAL',
          actionUrl: '/espace/assistance',
        },
        tx,
      );

      await this.notifications.emitToPostRole(
        assignedPostId,
        ['CONSULAR_AGENT', 'POST_MANAGER'],
        {
          type: 'ASSISTANCE_STATUS',
          title: 'Nouvelle demande d’assistance',
          message: `Demande ${reference} (${dto.subject}) transmise à votre poste.`,
          priority:
            resolvedUrgency === AssistanceUrgency.CRITICAL ? 'URGENT' : 'HIGH',
          actionUrl: '/agent-consulaire',
        },
        tx,
      );

      return created;
    });

    return { case: assistanceCase };
  }

  /*
  |--------------------------------------------------------------------------
  | My cases
  |--------------------------------------------------------------------------
  */

  async findMyCases(userId: string) {
    const items = await this.prisma.assistanceCase.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
        currentStepNumber: true,
        escalatedToCentralAt: true,
        escalationReason: true,
        resolutionSummary: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        closedAt: true,
        category: { include: PROTOCOL_CATEGORY_INCLUDE },
        country: {
          select: { id: true, iso2Code: true, name: true },
        },
        assignedPost: {
          select: { id: true, code: true, name: true, city: true, address: true },
        },
        history: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            action: true,
            fromStatus: true,
            toStatus: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    return { items };
  }

  /*
  |--------------------------------------------------------------------------
  | One of my cases
  |--------------------------------------------------------------------------
  */

  async findMyCase(userId: string, caseId: string) {
    const assistanceCase = await this.prisma.assistanceCase.findFirst({
      where: { id: caseId, requesterId: userId },
      include: {
        category: { include: PROTOCOL_CATEGORY_INCLUDE },
        country: true,
        assignedPost: {
          select: { id: true, code: true, name: true, city: true, address: true },
        },
        assignedToUser: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, firstName: true, lastName: true },
            },
          },
        },
        history: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            action: true,
            fromStatus: true,
            toStatus: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    if (!assistanceCase) {
      throw new NotFoundException('Assistance case not found.');
    }

    return { case: assistanceCase };
  }

  private generateReference() {
    return `AST-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
  }
}
