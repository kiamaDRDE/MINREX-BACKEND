import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AssistanceUrgency } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  DEFAULT_ASSISTANCE_PROTOCOLS,
  DEFAULT_LEGAL_NOTICE,
} from '../constants/default-assistance-protocols.constants.js';
import {
  CreateAssistanceCategoryDto,
  UpdateAssistanceCategoryDto,
} from '../dto/assistance-protocol.dto.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PROTOCOL_CATEGORY_INCLUDE = {
  steps: {
    orderBy: {
      stepNumber: 'asc' as const,
    },
  },
} as const;

@Injectable()
export class AssistanceProtocolsService {
  private readonly changeListeners = new Set<() => void>();

  constructor(private readonly prisma: PrismaService) {}

  onProtocolsChanged(listener: () => void): void {
    this.changeListeners.add(listener);
  }

  private notifyProtocolsChanged(): void {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch {
        // Ignore listener errors so CRUD never fails
      }
    }
  }

  async listCategories(includeInactive = false) {
    const items = await this.prisma.assistanceCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      take: 100,
      include: PROTOCOL_CATEGORY_INCLUDE,
    });

    return { items };
  }

  async getCategory(idOrCode: string) {
    const trimmed = idOrCode.trim();
    const isUuid = UUID_REGEX.test(trimmed);

    const category = await this.prisma.assistanceCategory.findFirst({
      where: isUuid
        ? { id: trimmed }
        : { code: { equals: trimmed.toUpperCase(), mode: 'insensitive' } },
      include: PROTOCOL_CATEGORY_INCLUDE,
    });

    if (!category) {
      throw new NotFoundException(
        `Assistance protocol category "${trimmed}" not found.`,
      );
    }

    return { category };
  }

  async createCategory(dto: CreateAssistanceCategoryDto) {
    const normalizedCode = dto.code.trim().toUpperCase().replace(/\s+/g, '_');

    const duplicate = await this.prisma.assistanceCategory.findUnique({
      where: { code: normalizedCode },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        `A protocol category with code "${normalizedCode}" already exists.`,
      );
    }

    const totalCount = await this.prisma.assistanceCategory.count();

    const category = await this.prisma.$transaction(async (tx) => {
      return tx.assistanceCategory.create({
        data: {
          code: normalizedCode,
          name: dto.name.trim(),
          shortName: dto.shortName?.trim() || dto.name.trim().slice(0, 100),
          categoryGroup: dto.categoryGroup ?? 'Urgence & Détresse',
          description: dto.description?.trim() ?? null,
          legalNotice: dto.legalNotice?.trim() || DEFAULT_LEGAL_NOTICE,
          icon: dto.icon?.trim() || '🛡️',
          badgeColor: dto.badgeColor?.trim() || 'bg-emerald-600 text-white',
          defaultUrgency: dto.defaultUrgency ?? AssistanceUrgency.NORMAL,
          defaultSlaHours: dto.defaultSlaHours ?? 24,
          isActive: dto.isActive ?? true,
          isSystem: false,
          displayOrder: dto.displayOrder ?? totalCount + 1,
          steps: {
            create: dto.steps.map((step, index) => ({
              stepNumber: index + 1,
              title: step.title.trim(),
              description: step.description.trim(),
              recommendedDelay: step.recommendedDelay?.trim() || '< 24h',
              responsibleRole:
                step.responsibleRole?.trim() || 'Agent consulaire instructeur',
              requiredDocs: step.requiredDocs ?? [],
            })),
          },
        },
        include: PROTOCOL_CATEGORY_INCLUDE,
      });
    });

    this.notifyProtocolsChanged();
    return { category };
  }

  async updateCategory(id: string, dto: UpdateAssistanceCategoryDto) {
    const existing = await this.prisma.assistanceCategory.findUnique({
      where: { id },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      throw new NotFoundException('Assistance protocol category not found.');
    }

    const category = await this.prisma.$transaction(async (tx) => {
      await tx.assistanceCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.shortName !== undefined
            ? { shortName: dto.shortName.trim() }
            : {}),
          ...(dto.categoryGroup !== undefined
            ? { categoryGroup: dto.categoryGroup }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.legalNotice !== undefined
            ? { legalNotice: dto.legalNotice.trim() || null }
            : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon.trim() || '🛡️' } : {}),
          ...(dto.badgeColor !== undefined
            ? { badgeColor: dto.badgeColor.trim() }
            : {}),
          ...(dto.defaultUrgency !== undefined
            ? { defaultUrgency: dto.defaultUrgency }
            : {}),
          ...(dto.defaultSlaHours !== undefined
            ? { defaultSlaHours: dto.defaultSlaHours }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
        },
      });

      if (dto.steps && dto.steps.length > 0) {
        await tx.assistanceProtocolStep.deleteMany({
          where: { categoryId: id },
        });

        await tx.assistanceProtocolStep.createMany({
          data: dto.steps.map((step, index) => ({
            categoryId: id,
            stepNumber: index + 1,
            title: step.title.trim(),
            description: step.description.trim(),
            recommendedDelay: step.recommendedDelay?.trim() || '< 24h',
            responsibleRole:
              step.responsibleRole?.trim() || 'Agent consulaire instructeur',
            requiredDocs: step.requiredDocs ?? [],
          })),
        });
      }

      return tx.assistanceCategory.findUniqueOrThrow({
        where: { id },
        include: PROTOCOL_CATEGORY_INCLUDE,
      });
    });

    this.notifyProtocolsChanged();
    return { category };
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.assistanceCategory.findUnique({
      where: { id },
      select: { id: true, code: true, isSystem: true },
    });

    if (!existing) {
      throw new NotFoundException('Assistance protocol category not found.');
    }

    if (existing.isSystem) {
      throw new ConflictException(
        'Sovereign system protocols cannot be deleted. You may edit or deactivate them instead.',
      );
    }

    await this.prisma.assistanceCategory.delete({
      where: { id },
    });

    this.notifyProtocolsChanged();
    return { deleted: true, id };
  }

  async resetSystemDefaults() {
    for (const protocol of DEFAULT_ASSISTANCE_PROTOCOLS) {
      await this.prisma.$transaction(async (tx) => {
        const category = await tx.assistanceCategory.upsert({
          where: { code: protocol.code },
          update: {
            name: protocol.name,
            shortName: protocol.shortName,
            categoryGroup: protocol.categoryGroup,
            description: protocol.description,
            legalNotice: protocol.legalNotice,
            icon: protocol.icon,
            badgeColor: protocol.badgeColor,
            defaultUrgency: protocol.defaultUrgency,
            defaultSlaHours: protocol.defaultSlaHours,
            isSystem: true,
            isActive: true,
            displayOrder: protocol.displayOrder,
          },
          create: {
            code: protocol.code,
            name: protocol.name,
            shortName: protocol.shortName,
            categoryGroup: protocol.categoryGroup,
            description: protocol.description,
            legalNotice: protocol.legalNotice,
            icon: protocol.icon,
            badgeColor: protocol.badgeColor,
            defaultUrgency: protocol.defaultUrgency,
            defaultSlaHours: protocol.defaultSlaHours,
            isSystem: true,
            isActive: true,
            displayOrder: protocol.displayOrder,
          },
        });

        await tx.assistanceProtocolStep.deleteMany({
          where: { categoryId: category.id },
        });

        await tx.assistanceProtocolStep.createMany({
          data: protocol.steps.map((step) => ({
            categoryId: category.id,
            stepNumber: step.stepNumber,
            title: step.title,
            description: step.description,
            recommendedDelay: step.recommendedDelay,
            responsibleRole: step.responsibleRole,
            requiredDocs: step.requiredDocs,
          })),
        });
      });
    }

    this.notifyProtocolsChanged();
    return this.listCategories(true);
  }
}
