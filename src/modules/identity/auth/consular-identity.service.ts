import { Injectable } from '@nestjs/common';

import {
  CensusDocumentStatus,
  CensusDocumentType,
  CensusStatus,
  PreferredLanguage,
  UserStatus,
} from '../../../generated/prisma/enums.js';
import { assignConsularIdentifierIfMissing } from '../../../common/utils/consular-id.util.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

export interface ConsularVerifiedUser {
  id: string;
  email: string;
  username: string;
  phone: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  consularIdentifier: string | null;
  consularVerifiedAt: Date | null;
  profile: {
    firstName: string;
    lastName: string;
    preferredLanguage: PreferredLanguage;
  } | null;
}

export interface ConsularIdentityMatch {
  user: ConsularVerifiedUser;
  consularIdentifier: string;
  postName: string | null;
}

export interface ConsularIdentityProvider {
  verifyConsularCredentials(
    consularId: string,
    birthDateIso: string,
  ): Promise<ConsularIdentityMatch | null>;
}

interface VerifiedRecordCandidate {
  id: string;
  birthDate: Date | null;
  assignedPost: { code: string; name: string } | null;
  user: ConsularVerifiedUser;
}

const CONSULAR_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  consularIdentifier: true,
  consularVerifiedAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      preferredLanguage: true,
    },
  },
} as const;

@Injectable()
export class ConsularIdentityService implements ConsularIdentityProvider {
  constructor(private readonly prisma: PrismaService) {}

  async verifyConsularCredentials(
    rawConsularId: string,
    rawBirthDate: string,
  ): Promise<ConsularIdentityMatch | null> {
    const consularId = rawConsularId.trim();
    const expectedDate = this.normalizeStrictIsoDate(rawBirthDate);

    if (!consularId || !expectedDate) {
      return null;
    }

    const match = await this.findVerifiedCandidate(consularId);
    if (!match || !match.birthDate) {
      return null;
    }

    const recordBirthIso = match.birthDate.toISOString().slice(0, 10);
    if (recordBirthIso !== expectedDate) {
      return null;
    }

    let user = match.user;
    let consularIdentifier = user.consularIdentifier;

    if (!consularIdentifier) {
      const assigned = await assignConsularIdentifierIfMissing(
        this.prisma,
        user.id,
        match.assignedPost?.code,
      );
      consularIdentifier = assigned.consularIdentifier;
      user = {
        ...user,
        consularIdentifier,
        consularVerifiedAt: user.consularVerifiedAt ?? new Date(),
      };
    }

    return {
      user,
      consularIdentifier,
      postName: match.assignedPost?.name ?? null,
    };
  }

  private async findVerifiedCandidate(
    consularId: string,
  ): Promise<VerifiedRecordCandidate | null> {
    // 1. Direct lookup by permanent consularIdentifier
    const directUser = await this.prisma.user.findFirst({
      where: {
        consularIdentifier: { equals: consularId, mode: 'insensitive' },
        status: UserStatus.ACTIVE,
        emailVerifiedAt: { not: null },
      },
      select: CONSULAR_USER_SELECT,
    });

    if (directUser) {
      const record = await this.prisma.censusRecord.findFirst({
        where: {
          userId: directUser.id,
          status: CensusStatus.VERIFIED,
          birthDate: { not: null },
        },
        orderBy: { verifiedAt: 'desc' },
        select: {
          id: true,
          birthDate: true,
          assignedPost: { select: { code: true, name: true } },
        },
      });

      if (record) {
        return {
          ...record,
          user: directUser,
        };
      }
    }

    // 2. Lookup by VERIFIED CensusRecord reference (e.g. REC-...)
    const byReference = await this.prisma.censusRecord.findFirst({
      where: {
        reference: { equals: consularId, mode: 'insensitive' },
        status: CensusStatus.VERIFIED,
        birthDate: { not: null },
        user: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: { not: null },
        },
      },
      orderBy: { verifiedAt: 'desc' },
      select: {
        id: true,
        birthDate: true,
        assignedPost: { select: { code: true, name: true } },
        user: { select: CONSULAR_USER_SELECT },
      },
    });

    if (byReference) {
      return byReference;
    }

    // 3. Lookup by VERIFIED identity document number (Passport / CNI)
    const byDoc = await this.prisma.censusDocument.findFirst({
      where: {
        documentNumber: { equals: consularId, mode: 'insensitive' },
        type: CensusDocumentType.IDENTITY_DOCUMENT,
        status: CensusDocumentStatus.VERIFIED,
        censusRecord: {
          status: CensusStatus.VERIFIED,
          birthDate: { not: null },
          user: {
            status: UserStatus.ACTIVE,
            emailVerifiedAt: { not: null },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        censusRecord: {
          select: {
            id: true,
            birthDate: true,
            assignedPost: { select: { code: true, name: true } },
            user: { select: CONSULAR_USER_SELECT },
          },
        },
      },
    });

    return byDoc?.censusRecord ?? null;
  }

  private normalizeStrictIsoDate(raw: string): string | null {
    const trimmed = raw.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() + 1 !== month ||
      utcDate.getUTCDate() !== day
    ) {
      return null;
    }

    return trimmed;
  }
}
