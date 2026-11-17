import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import {
  AssignmentStatus,
  NotificationChannel,
  UserStatus,
} from '../../../generated/prisma/enums.js';

import type { Prisma } from '../../../generated/prisma/client.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { MailService } from '../../../infrastructure/mail/mail.service.js';

import type {
  NotificationPayload,
  NotificationRoleCode,
} from '../interfaces/notification-payload.interface.js';

type NotificationDatabase = PrismaService | Prisma.TransactionClient;

interface EmailRecipientTarget {
  email: string;
  recipientName: string | null;
}

@Injectable()
export class NotificationEventBusService {
  private readonly logger = new Logger(NotificationEventBusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private getDatabase(tx?: Prisma.TransactionClient): NotificationDatabase {
    return tx ?? this.prisma;
  }

  /**
   * Notify one user (In-App + Email respecting user preferences).
   */
  async emitToUser(
    userId: string,
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ) {
    return this.emitToUsers([userId], payload, tx);
  }

  /**
   * Notify several users (In-App inside transaction + async post-commit Email).
   */
  async emitToUsers(
    userIds: string[],
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ) {
    const recipients = [...new Set(userIds.filter(Boolean))];

    if (!recipients.length) {
      return { count: 0 };
    }

    const db = this.getDatabase(tx);

    const [preferences, users] = await Promise.all([
      db.notificationPreference.findMany({
        where: {
          userId: { in: recipients },
          type: payload.type,
        },
        select: {
          userId: true,
          inAppEnabled: true,
          emailEnabled: true,
        },
      }),
      db.user.findMany({
        where: {
          id: { in: recipients },
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const prefByUser = new Map(preferences.map((p) => [p.userId, p]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const notificationsToCreate: Prisma.NotificationCreateManyInput[] = [];
    const createdIds: string[] = [];
    const emailTargets: EmailRecipientTarget[] = [];

    for (const recipientId of recipients) {
      const pref = prefByUser.get(recipientId);
      const inAppEnabled = pref?.inAppEnabled ?? true;
      const emailEnabled = pref?.emailEnabled ?? true;

      const user = userById.get(recipientId);
      const canSendEmail = Boolean(
        emailEnabled && user?.email && user.emailVerifiedAt,
      );

      if (canSendEmail && user) {
        const fullName = user.profile
          ? `${user.profile.firstName ?? ''} ${user.profile.lastName ?? ''}`.trim()
          : '';
        emailTargets.push({
          email: user.email,
          recipientName: fullName || null,
        });
      }

      if (inAppEnabled) {
        const notifId = randomUUID();
        createdIds.push(notifId);
        notificationsToCreate.push({
          id: notifId,
          recipientId,
          type: payload.type,
          title: payload.title,
          content: payload.message,
          priority: payload.priority ?? 'NORMAL',
          channels: canSendEmail
            ? [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
            : [NotificationChannel.IN_APP],
          actionUrl: payload.actionUrl ?? null,
        });
      }
    }

    let createdCount = 0;
    if (notificationsToCreate.length > 0) {
      const res = await db.notification.createMany({
        data: notificationsToCreate,
      });
      createdCount = res.count;
    }

    if (emailTargets.length > 0) {
      this.scheduleEmailDispatch(
        emailTargets,
        payload,
        createdIds,
        Boolean(tx),
      );
    }

    return { count: createdCount };
  }

  /**
   * Notify active users assigned to a diplomatic post
   * who also possess one of the specified roles.
   */
  async emitToPostRole(
    postId: string,
    roleCodes: readonly NotificationRoleCode[],
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ) {
    if (!roleCodes.length) {
      return { count: 0 };
    }

    const db = this.getDatabase(tx);

    const postAssignments = await db.userPostAssignment.findMany({
      where: {
        postId,
        status: AssignmentStatus.ACTIVE,
      },
      select: { userId: true },
    });

    const assignedUserIds = [
      ...new Set(postAssignments.map((assignment) => assignment.userId)),
    ];

    if (!assignedUserIds.length) {
      return { count: 0 };
    }

    const now = new Date();

    const roleAssignments = await db.userRoleAssignment.findMany({
      where: {
        userId: { in: assignedUserIds },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: {
          isActive: true,
          code: { in: [...roleCodes] },
        },
      },
      select: { userId: true },
    });

    const recipients = [
      ...new Set(roleAssignments.map((assignment) => assignment.userId)),
    ];

    return this.emitToUsers(recipients, payload, tx);
  }

  /**
   * Notify active users with global roles.
   */
  async emitToGlobalRole(
    roleCodes: readonly NotificationRoleCode[],
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ) {
    if (!roleCodes.length) {
      return { count: 0 };
    }

    const db = this.getDatabase(tx);
    const now = new Date();

    const assignments = await db.userRoleAssignment.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: {
          isActive: true,
          code: { in: [...roleCodes] },
        },
      },
      select: { userId: true },
    });

    const recipients = [
      ...new Set(assignments.map((assignment) => assignment.userId)),
    ];

    return this.emitToUsers(recipients, payload, tx);
  }

  private scheduleEmailDispatch(
    targets: EmailRecipientTarget[],
    payload: NotificationPayload,
    createdNotificationIds: string[],
    usedExternalTransaction: boolean,
  ): void {
    const enqueueAll = () => {
      for (const target of targets) {
        this.mailService.enqueueNotificationEmail({
          to: target.email,
          recipientName: target.recipientName,
          subject: `[MINREX] ${payload.title}`,
          title: payload.title,
          content: payload.message,
          priority: payload.priority ?? 'NORMAL',
          actionUrl: payload.actionUrl ?? null,
          actionLabel: 'Consulter sur le portail',
        });
      }
    };

    if (!usedExternalTransaction) {
      enqueueAll();
      return;
    }

    // Wait briefly so outer Prisma transaction commits; verify persisted rows before emailing
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (createdNotificationIds.length > 0) {
            const committed = await this.prisma.notification.count({
              where: { id: { in: createdNotificationIds } },
            });
            if (committed === 0) {
              this.logger.debug(
                `Skipped email dispatch for rolled-back notification transaction.`,
              );
              return;
            }
          }
          enqueueAll();
        } catch (error) {
          this.logger.warn(
            `Error verifying committed notifications before email dispatch: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      })();
    }, 150);

    timer.unref?.();
  }
}
