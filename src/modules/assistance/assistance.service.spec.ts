import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  AssistanceType,
  AssistanceUrgency,
} from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { NotificationEventBusService } from '../notifications/services/notification-event-bus.service.js';
import { AssistanceService } from './assistance.service.js';

describe('AssistanceService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    assistanceCategory: {
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    country: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    postCoverage: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    assistanceCase: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    assistanceCaseHistory: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    $transaction: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  };

  const notificationsMock = {
    emitToUser: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    emitToPostRole: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  };

  let service: AssistanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return arg;
    });
    notificationsMock.emitToUser.mockResolvedValue({ count: 1 });
    notificationsMock.emitToPostRole.mockResolvedValue({ count: 1 });
    service = new AssistanceService(
      prismaMock as unknown as PrismaService,
      notificationsMock as unknown as NotificationEventBusService,
    );
  });

  it('routes deterministically when multiple posts cover a country (city match -> root embassy)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'citoyen@example.com',
      phone: '+33600000000',
    });
    prismaMock.assistanceCategory.findFirst.mockResolvedValue({
      id: 'cat-perte',
      code: 'PERTE_DOCUMENTS',
      defaultUrgency: AssistanceUrgency.HIGH,
    });
    prismaMock.country.findUnique.mockResolvedValue({
      id: 'country-fr',
      name: 'France',
      isActive: true,
    });
    prismaMock.postCoverage.findMany.mockResolvedValue([
      {
        postId: 'post-marseille',
        startDate: new Date('2026-01-01'),
        post: {
          id: 'post-marseille',
          code: 'CSL-MARSEILLE',
          name: 'Consulat du Cameroun à Marseille',
          city: 'Marseille',
          parentPostId: 'post-paris',
          type: { code: 'CONSULAT' },
        },
      },
      {
        postId: 'post-paris',
        startDate: new Date('2026-01-01'),
        post: {
          id: 'post-paris',
          code: 'AMB-PARIS',
          name: 'Ambassade du Cameroun en France',
          city: 'Paris',
          parentPostId: null,
          type: { code: 'AMBASSADE' },
        },
      },
    ]);
    prismaMock.assistanceCase.create.mockImplementation(async (args: unknown) => ({
      id: 'case-1',
      ...(args as { data: Record<string, unknown> }).data,
    }));
    prismaMock.assistanceCaseHistory.create.mockResolvedValue({ id: 'hist-1' });

    // Case 1: citizen in Lyon (no direct city match) -> falls back to root Ambassade (Paris)
    const resLyon = await service.createMyCase('user-1', {
      categoryId: 'cat-perte',
      subject: 'Perte passeport à Lyon',
      description: 'Mon passeport a été volé à la gare de Lyon Part-Dieu.',
      countryId: 'country-fr',
      city: 'Lyon',
    });

    expect(resLyon.case.assignedPostId).toBe('post-paris');
    expect(resLyon.case.type).toBe(AssistanceType.DOCUMENT_LOSS);
    expect(resLyon.case.urgency).toBe(AssistanceUrgency.HIGH);

    // Case 2: citizen in Marseille -> routes directly to Consulat à Marseille
    const resMarseille = await service.createMyCase('user-1', {
      categoryId: 'cat-perte',
      subject: 'Perte passeport à Marseille',
      description: 'Mon passeport a été volé au Vieux-Port de Marseille.',
      countryId: 'country-fr',
      city: 'Marseille',
    });

    expect(resMarseille.case.assignedPostId).toBe('post-marseille');
  });
});
