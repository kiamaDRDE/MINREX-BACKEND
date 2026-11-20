import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { SYSTEM_ROLE_CODES } from '../../modules/identity/authorization/constants/system-roles.constants.js';

type RoleDbClient = PrismaService | Prisma.TransactionClient;

/**
 * Idempotently grants the global MENTOR_EXPERT role to a user if they do not
 * already hold an active, unexpired assignment for it.
 */
export async function grantMentorExpertRoleIfMissing(
  db: RoleDbClient,
  userId: string,
  now: Date = new Date(),
): Promise<{ granted: boolean; assignmentId: string | null }> {
  const mentorRole = await db.role.findFirst({
    where: {
      code: SYSTEM_ROLE_CODES.MENTOR_EXPERT,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!mentorRole) {
    return {
      granted: false,
      assignmentId: null,
    };
  }

  const existingAssignment = await db.userRoleAssignment.findFirst({
    where: {
      userId,
      roleId: mentorRole.id,
      postId: null,
      serviceId: null,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: {
      id: true,
    },
  });

  if (existingAssignment) {
    return {
      granted: false,
      assignmentId: existingAssignment.id,
    };
  }

  const created = await db.userRoleAssignment.create({
    data: {
      userId,
      roleId: mentorRole.id,
      postId: null,
      serviceId: null,
      isActive: true,
      expiresAt: null,
      assignedAt: now,
    },
    select: {
      id: true,
    },
  });

  return {
    granted: true,
    assignmentId: created.id,
  };
}
