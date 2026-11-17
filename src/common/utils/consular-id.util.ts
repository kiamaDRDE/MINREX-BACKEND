import { randomBytes } from 'node:crypto';

import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../infrastructure/database/prisma.service.js';

type ConsularDbClient = PrismaService | Prisma.TransactionClient;

/**
 * Generates an official sovereign consular identity number, e.g. CMR-FRPAR-2026-A1B2C3.
 */
export function formatConsularIdentifier(
  postCode?: string | null,
  year: number = new Date().getUTCFullYear(),
): string {
  const sanitizedPost = (postCode ?? '')
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '')
    .slice(0, 6);

  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return sanitizedPost
    ? `CMR-${sanitizedPost}-${year}-${suffix}`
    : `CMR-${year}-${suffix}`;
}

/**
 * Atomically assigns a unique consularIdentifier to a user if they do not already hold one.
 * Safe against concurrent verification requests.
 */
export async function assignConsularIdentifierIfMissing(
  db: ConsularDbClient,
  userId: string,
  postCode?: string | null,
  verifiedAt: Date = new Date(),
): Promise<{ consularIdentifier: string; newlyAssigned: boolean }> {
  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: { consularIdentifier: true },
  });

  if (existingUser?.consularIdentifier) {
    return {
      consularIdentifier: existingUser.consularIdentifier,
      newlyAssigned: false,
    };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = formatConsularIdentifier(postCode);

    const conflict = await db.user.findUnique({
      where: { consularIdentifier: candidate },
      select: { id: true },
    });

    if (conflict) {
      continue;
    }

    try {
      const updated = await db.user.updateMany({
        where: {
          id: userId,
          consularIdentifier: null,
        },
        data: {
          consularIdentifier: candidate,
          consularVerifiedAt: verifiedAt,
        },
      });

      if (updated.count === 1) {
        return { consularIdentifier: candidate, newlyAssigned: true };
      }

      const refreshed = await db.user.findUnique({
        where: { id: userId },
        select: { consularIdentifier: true },
      });

      if (refreshed?.consularIdentifier) {
        return {
          consularIdentifier: refreshed.consularIdentifier,
          newlyAssigned: false,
        };
      }
    } catch (error) {
      const errCode =
        error && typeof error === 'object'
          ? (error as { code?: unknown }).code
          : undefined;
      if (errCode !== 'P2002') {
        throw error;
      }
    }
  }

  throw new Error('Unable to assign a unique consular identifier.');
}
