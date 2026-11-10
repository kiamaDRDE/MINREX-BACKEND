import {
  Injectable,
} from '@nestjs/common';

import {
  AssignmentStatus,
} from '../../../generated/prisma/enums.js';

import type {
  Prisma,
} from '../../../generated/prisma/client.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import type {
  NotificationPayload,
  NotificationRoleCode,
} from '../interfaces/notification-payload.interface.js';

type NotificationDatabase =
  | PrismaService
  | Prisma.TransactionClient;

@Injectable()
export class NotificationEventBusService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private getDatabase(
    tx?: Prisma.TransactionClient,
  ): NotificationDatabase {
    return tx ?? this.prisma;
  }

  /**
   * Notify one user.
   */
  async emitToUser(
    userId: string,
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ) {
    return this.emitToUsers(
      [userId],
      payload,
      tx,
    );
  }

  /**
   * Notify several users.
   */
  async emitToUsers(
    userIds: string[],
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ) {
    const recipients = [
      ...new Set(
        userIds.filter(Boolean),
      ),
    ];

    if (!recipients.length) {
      return {
        count: 0,
      };
    }

    const db = this.getDatabase(tx);

    return db.notification.createMany({
      data: recipients.map(
        (recipientId) => ({
          recipientId,

          type: payload.type,

          title: payload.title,

          content: payload.message,

          priority:
            payload.priority ?? 'NORMAL',

          actionUrl:
            payload.actionUrl ?? null,
        }),
      ),
    });
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
      return {
        count: 0,
      };
    }

    const db = this.getDatabase(tx);

    const postAssignments =
      await db.userPostAssignment.findMany({
        where: {
          postId,

          status:
            AssignmentStatus.ACTIVE,
        },

        select: {
          userId: true,
        },
      });

    const assignedUserIds = [
      ...new Set(
        postAssignments.map(
          (assignment) => assignment.userId,
        ),
      ),
    ];

    if (!assignedUserIds.length) {
      return {
        count: 0,
      };
    }

    const now = new Date();

    const roleAssignments =
      await db.userRoleAssignment.findMany({
        where: {
          userId: {
            in: assignedUserIds,
          },

          isActive: true,

          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],

          role: {
            isActive: true,

            code: {
              in: [...roleCodes],
            },
          },
        },

        select: {
          userId: true,
        },
      });

    const recipients = [
      ...new Set(
        roleAssignments.map(
          (assignment) => assignment.userId,
        ),
      ),
    ];

    return this.emitToUsers(
      recipients,
      payload,
      tx,
    );
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
      return {
        count: 0,
      };
    }

    const db = this.getDatabase(tx);

    const now = new Date();

    const assignments =
      await db.userRoleAssignment.findMany({
        where: {
          isActive: true,

          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],

          role: {
            isActive: true,

            code: {
              in: [...roleCodes],
            },
          },
        },

        select: {
          userId: true,
        },
      });

    const recipients = [
      ...new Set(
        assignments.map(
          (assignment) => assignment.userId,
        ),
      ),
    ];

    return this.emitToUsers(
      recipients,
      payload,
      tx,
    );
  }
}