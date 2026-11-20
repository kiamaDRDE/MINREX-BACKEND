import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AssistanceUrgency } from '../../../generated/prisma/enums.js';
import type { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { AssistanceProtocolsService } from './assistance-protocols.service.js';

describe('AssistanceProtocolsService', () => {
  const prismaMock = {
    assistanceCategory: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUniqueOrThrow: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      count: jest.fn<(...args: unknown[]) => Promise<number>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    assistanceProtocolStep: {
      deleteMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      createMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    $transaction: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  };

  let service: AssistanceProtocolsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return arg;
    });
    service = new AssistanceProtocolsService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('creates a custom protocol with optional empty requiredDocs and notifies listeners', async () => {
    const listener = jest.fn();
    service.onProtocolsChanged(listener);

    prismaMock.assistanceCategory.findUnique.mockResolvedValue(null);
    prismaMock.assistanceCategory.count.mockResolvedValue(7);
    prismaMock.assistanceCategory.create.mockResolvedValue({
      id: 'cat-1',
      code: 'EVACUATION_SANITAIRE',
      name: 'Évacuation sanitaire',
      categoryGroup: 'Urgence & Détresse',
      steps: [{ stepNumber: 1, title: 'Alerte', requiredDocs: [] }],
    });

    const result = await service.createCategory({
      code: 'evacuation sanitaire',
      name: 'Évacuation sanitaire',
      defaultUrgency: AssistanceUrgency.CRITICAL,
      defaultSlaHours: 6,
      steps: [
        {
          title: 'Alerte',
          description: 'Signalement immédiat au poste consulaire.',
        },
      ],
    });

    expect(result.category.code).toBe('EVACUATION_SANITAIRE');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(prismaMock.assistanceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'EVACUATION_SANITAIRE',
          isSystem: false,
          steps: {
            create: [
              expect.objectContaining({
                stepNumber: 1,
                requiredDocs: [],
              }),
            ],
          },
        }),
      }),
    );
  });

  it('rejects duplicate protocol code with ConflictException', async () => {
    prismaMock.assistanceCategory.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createCategory({
        code: 'ARRESTATION',
        name: 'Duplicate',
        steps: [{ title: 'Step 1', description: 'Details' }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('blocks deletion of sovereign system protocols and deletes custom ones', async () => {
    prismaMock.assistanceCategory.findUnique.mockResolvedValueOnce({
      id: 'sys-1',
      code: 'ARRESTATION',
      isSystem: true,
    });

    await expect(service.deleteCategory('sys-1')).rejects.toThrow(
      ConflictException,
    );

    prismaMock.assistanceCategory.findUnique.mockResolvedValueOnce({
      id: 'custom-1',
      code: 'CUSTOM_PROTO',
      isSystem: false,
    });
    prismaMock.assistanceCategory.delete.mockResolvedValue({ id: 'custom-1' });

    const res = await service.deleteCategory('custom-1');
    expect(res).toEqual({ deleted: true, id: 'custom-1' });
  });

  it('throws NotFoundException when protocol does not exist', async () => {
    prismaMock.assistanceCategory.findFirst.mockResolvedValue(null);

    await expect(service.getCategory('UNKNOWN')).rejects.toThrow(
      NotFoundException,
    );
  });
});
