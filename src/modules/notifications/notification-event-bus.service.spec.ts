import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  NotificationChannel,
  UserStatus,
} from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { MailService } from '../../infrastructure/mail/mail.service.js';

import { NotificationEventBusService } from './services/notification-event-bus.service.js';

describe('NotificationEventBusService', () => {
  const notificationPreferenceFindMany = jest.fn<() => Promise<unknown[]>>();
  const userFindMany = jest.fn<() => Promise<unknown[]>>();
  const notificationCreateMany = jest.fn<() => Promise<{ count: number }>>();
  const notificationCount = jest.fn<() => Promise<number>>();
  const enqueueNotificationEmail = jest.fn();

  const prismaMock = {
    notificationPreference: { findMany: notificationPreferenceFindMany },
    user: { findMany: userFindMany },
    notification: {
      createMany: notificationCreateMany,
      count: notificationCount,
    },
  } as unknown as PrismaService;

  const mailMock = {
    enqueueNotificationEmail,
  } as unknown as MailService;

  let service: NotificationEventBusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationEventBusService(prismaMock, mailMock);
  });

  it('creates in-app notifications and dispatches emails honoring preferences', async () => {
    notificationPreferenceFindMany.mockResolvedValue([
      { userId: 'u1', inAppEnabled: true, emailEnabled: true },
      { userId: 'u2', inAppEnabled: true, emailEnabled: false },
    ]);

    userFindMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'u1@example.com',
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        profile: { firstName: 'Nadine', lastName: 'Mbarga' },
      },
      {
        id: 'u2',
        email: 'u2@example.com',
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        profile: { firstName: 'Paul', lastName: 'Ngono' },
      },
    ]);

    notificationCreateMany.mockResolvedValue({ count: 2 });

    const res = await service.emitToUsers(['u1', 'u2'], {
      type: 'ASSISTANCE_STATUS',
      title: 'Dossier mis à jour',
      message: 'Votre dossier avance.',
      priority: 'HIGH',
      actionUrl: '/espace/assistance',
    });

    expect(res).toEqual({ count: 2 });
    expect(notificationCreateMany).toHaveBeenCalledTimes(1);

    const createPayload = notificationCreateMany.mock.calls[0] as unknown as [
      { data: Array<{ recipientId: string; channels: NotificationChannel[] }> },
    ];
    expect(createPayload[0].data[0]?.channels).toEqual([
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
    ]);
    expect(createPayload[0].data[1]?.channels).toEqual([
      NotificationChannel.IN_APP,
    ]);

    expect(enqueueNotificationEmail).toHaveBeenCalledTimes(1);
    expect(enqueueNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u1@example.com',
        recipientName: 'Nadine Mbarga',
        priority: 'HIGH',
        actionUrl: '/espace/assistance',
      }),
    );
  });

  it('skips unverified email addresses for email dispatch', async () => {
    notificationPreferenceFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([
      {
        id: 'u3',
        email: 'u3@example.com',
        emailVerifiedAt: null,
        status: UserStatus.ACTIVE,
        profile: null,
      },
    ]);
    notificationCreateMany.mockResolvedValue({ count: 1 });

    await service.emitToUser('u3', {
      type: 'SYSTEM_SECURITY',
      title: 'Sécurité',
      message: 'Alerte',
    });

    expect(enqueueNotificationEmail).not.toHaveBeenCalled();
  });
});
