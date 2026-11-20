import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  CensusStatus,
  TalentApplicationStatus,
} from '../../generated/prisma/enums.js';
import { grantMentorExpertRoleIfMissing } from '../../common/utils/mentor-role.util.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { NotificationEventBusService } from '../notifications/services/notification-event-bus.service.js';

import { ListTalentApplicationsQueryDto } from './dto/list-talent-applications-query.dto.js';
import { ListTalentsQueryDto } from './dto/list-talents-query.dto.js';
import {
  ApproveTalentApplicationDto,
  RejectTalentApplicationDto,
} from './dto/review-talent-application.dto.js';
import { SubmitTalentApplicationDto } from './dto/submit-talent-application.dto.js';

const TALENT_APPLICATION_SELECT = {
  id: true,
  reference: true,
  userId: true,
  status: true,
  firstName: true,
  lastName: true,
  email: true,
  profession: true,
  jobTitle: true,
  sector: true,
  employer: true,
  yearsExperience: true,
  expertiseDomains: true,
  skills: true,
  qualifications: true,
  optInTalentDirectory: true,
  talentStatus: true,
  talentSubmittedAt: true,
  talentReviewedAt: true,
  talentReviewedById: true,
  talentRejectionReason: true,
  verifiedAt: true,
  residenceCity: true,
  residenceCountry: {
    select: {
      id: true,
      iso2Code: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      username: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          photoUrl: true,
        },
      },
    },
  },
  documents: {
    where: {
      type: 'OTHER' as const,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
    select: {
      id: true,
      type: true,
      status: true,
      documentNumber: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class TalentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationEventBusService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | PUBLIC / DIRECTORY LISTING OF APPROVED EXPERTS
  |--------------------------------------------------------------------------
  */

  async findAll(query: ListTalentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const insensitive = 'insensitive' as const;

    const where = {
      optInTalentDirectory: true,
      talentStatus: TalentApplicationStatus.APPROVED,

      ...(query.countryId
        ? {
            residenceCountryId: query.countryId,
          }
        : {}),

      ...(query.expertiseDomain
        ? {
            expertiseDomains: {
              has: query.expertiseDomain,
            },
          }
        : {}),

      ...(query.skill
        ? {
            skills: {
              has: query.skill,
            },
          }
        : {}),

      ...(query.q
        ? {
            OR: [
              {
                firstName: {
                  contains: query.q,
                  mode: insensitive,
                },
              },
              {
                lastName: {
                  contains: query.q,
                  mode: insensitive,
                },
              },
              {
                profession: {
                  contains: query.q,
                  mode: insensitive,
                },
              },
              {
                jobTitle: {
                  contains: query.q,
                  mode: insensitive,
                },
              },
              {
                sector: {
                  contains: query.q,
                  mode: insensitive,
                },
              },
              {
                qualifications: {
                  contains: query.q,
                  mode: insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [talents, total] = await this.prisma.$transaction([
      this.prisma.censusRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            talentReviewedAt: 'desc',
          },
          {
            verifiedAt: 'desc',
          },
          {
            updatedAt: 'desc',
          },
        ],
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          profession: true,
          jobTitle: true,
          sector: true,
          employer: true,
          yearsExperience: true,
          expertiseDomains: true,
          skills: true,
          qualifications: true,
          talentStatus: true,
          talentReviewedAt: true,
          verifiedAt: true,
          residenceCity: true,
          residenceCountry: {
            select: {
              id: true,
              iso2Code: true,
              name: true,
            },
          },
          user: {
            select: {
              profile: {
                select: {
                  displayName: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.censusRecord.count({
        where,
      }),
    ]);

    return {
      items: talents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(talentId: string) {
    const talent = await this.prisma.censusRecord.findFirst({
      where: {
        id: talentId,
        optInTalentDirectory: true,
        talentStatus: TalentApplicationStatus.APPROVED,
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        profession: true,
        jobTitle: true,
        sector: true,
        employer: true,
        yearsExperience: true,
        expertiseDomains: true,
        skills: true,
        qualifications: true,
        talentStatus: true,
        talentReviewedAt: true,
        verifiedAt: true,
        residenceCity: true,
        residenceCountry: {
          select: {
            id: true,
            iso2Code: true,
            iso3Code: true,
            name: true,
          },
        },
        user: {
          select: {
            profile: {
              select: {
                displayName: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!talent) {
      throw new NotFoundException('Talent profile not found.');
    }

    return talent;
  }

  /*
  |--------------------------------------------------------------------------
  | CITIZEN EXPERTISE APPLICATION ("Proposer mon expertise")
  |--------------------------------------------------------------------------
  */

  async getMyApplication(userId: string) {
    const application = await this.prisma.censusRecord.findFirst({
      where: {
        userId,
        status: {
          not: CensusStatus.REJECTED,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: TALENT_APPLICATION_SELECT,
    });

    return {
      application: application ?? null,
    };
  }

  async submitMyApplication(
    userId: string,
    dto: SubmitTalentApplicationDto,
  ) {
    const cleanJobTitle = dto.jobTitle.trim();
    const cleanProfession = (dto.profession ?? dto.jobTitle).trim();
    const cleanSector = dto.sector?.trim() || null;
    const cleanEmployer = dto.employer?.trim() || null;
    const cleanQualifications = dto.qualifications?.trim() || null;
    const cleanSkills = [
      ...new Set(dto.skills.map((skill) => skill.trim()).filter(Boolean)),
    ];

    if (cleanSkills.length === 0) {
      throw new BadRequestException(
        'At least one non-empty skill is required.',
      );
    }

    const rawDomains = dto.expertiseDomains?.length
      ? dto.expertiseDomains
      : cleanSector
        ? [cleanSector]
        : [];
    const cleanDomains = [
      ...new Set(rawDomains.map((domain) => domain.trim()).filter(Boolean)),
    ];

    const nextOptIn = dto.optInTalentDirectory ?? true;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      let existing = await tx.censusRecord.findFirst({
        where: {
          userId,
          status: {
            not: CensusStatus.REJECTED,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          talentStatus: true,
          talentSubmittedAt: true,
        },
      });

      if (!existing) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        if (!user) {
          throw new NotFoundException('User not found.');
        }

        const created = await tx.censusRecord.create({
          data: {
            reference: this.generateReference(),
            userId,
            firstName: user.profile?.firstName ?? null,
            lastName: user.profile?.lastName ?? null,
            email: user.email ?? null,
            status: CensusStatus.DRAFT,
          },
          select: {
            id: true,
            talentStatus: true,
            talentSubmittedAt: true,
          },
        });

        await tx.censusStatusHistory.create({
          data: {
            censusRecordId: created.id,
            fromStatus: null,
            toStatus: CensusStatus.DRAFT,
            changedById: userId,
            reason: 'Census draft initialized from expertise application.',
          },
        });

        existing = created;
      }

      const alreadyApproved =
        existing.talentStatus === TalentApplicationStatus.APPROVED;

      let nextTalentStatus: TalentApplicationStatus = existing.talentStatus;
      let shouldNotifyAdmins = false;

      if (nextOptIn) {
        if (!alreadyApproved) {
          nextTalentStatus = TalentApplicationStatus.PENDING;
          shouldNotifyAdmins = true;
        }
      } else if (!alreadyApproved) {
        nextTalentStatus = TalentApplicationStatus.NONE;
      }

      const updated = await tx.censusRecord.update({
        where: { id: existing.id },
        data: {
          jobTitle: cleanJobTitle,
          profession: cleanProfession,
          ...(cleanSector !== null ? { sector: cleanSector } : {}),
          ...(cleanEmployer !== null ? { employer: cleanEmployer } : {}),
          ...(dto.yearsExperience !== undefined
            ? { yearsExperience: dto.yearsExperience }
            : {}),
          expertiseDomains: cleanDomains,
          skills: cleanSkills,
          ...(cleanQualifications !== null
            ? { qualifications: cleanQualifications }
            : {}),
          optInTalentDirectory: nextOptIn,
          talentStatus: nextTalentStatus,
          ...(nextTalentStatus === TalentApplicationStatus.PENDING
            ? {
                talentSubmittedAt: now,
                talentRejectionReason: null,
              }
            : {}),
        },
        select: TALENT_APPLICATION_SELECT,
      });

      if (shouldNotifyAdmins) {
        const applicantName =
          `${updated.firstName ?? ''} ${updated.lastName ?? ''}`.trim() ||
          updated.user?.profile?.displayName ||
          updated.user?.username ||
          'Un membre de la diaspora';

        await this.notifications.emitToGlobalRole(
          ['PLATFORM_ADMIN', 'MINREX_CENTRAL_AGENT'],
          {
            type: 'MENTORSHIP_INVITE',
            title: 'Nouvelle demande d’accréditation Expert / Mentor',
            message: `${applicantName} a soumis son profil d’expertise (${cleanJobTitle}) pour devenir Expert / Mentor MTC.`,
            priority: 'NORMAL',
            actionUrl: '/talents',
          },
          tx,
        );
      }

      return updated;
    });

    return {
      application: result,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | ADMINISTRATION — LIST & VALIDATE EXPERTISE APPLICATIONS
  |--------------------------------------------------------------------------
  */

  async listAdminApplications(query: ListTalentApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const insensitive = 'insensitive' as const;

    const where = {
      talentStatus: query.status
        ? query.status
        : {
            in: [
              TalentApplicationStatus.PENDING,
              TalentApplicationStatus.APPROVED,
              TalentApplicationStatus.REJECTED,
            ],
          },
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: insensitive } },
              { lastName: { contains: query.q, mode: insensitive } },
              { jobTitle: { contains: query.q, mode: insensitive } },
              { profession: { contains: query.q, mode: insensitive } },
              { sector: { contains: query.q, mode: insensitive } },
              { qualifications: { contains: query.q, mode: insensitive } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.censusRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { talentSubmittedAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        select: TALENT_APPLICATION_SELECT,
      }),
      this.prisma.censusRecord.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveApplication(
    actorId: string,
    recordId: string,
    dto: ApproveTalentApplicationDto = {},
  ) {
    const record = await this.prisma.censusRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        userId: true,
        talentStatus: true,
        optInTalentDirectory: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Talent application record not found.');
    }

    if (
      record.talentStatus === TalentApplicationStatus.NONE &&
      !record.optInTalentDirectory
    ) {
      throw new BadRequestException(
        'No expertise application has been submitted for this record.',
      );
    }

    const now = new Date();
    const comment = dto.comment?.trim();

    const outcome = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.censusRecord.update({
        where: { id: record.id },
        data: {
          optInTalentDirectory: true,
          talentStatus: TalentApplicationStatus.APPROVED,
          talentReviewedAt: now,
          talentReviewedById: actorId,
          talentRejectionReason: null,
        },
        select: TALENT_APPLICATION_SELECT,
      });

      const roleOutcome = await grantMentorExpertRoleIfMissing(
        tx,
        record.userId,
        now,
      );

      await this.notifications.emitToUser(
        record.userId,
        {
          type: 'MENTORSHIP_INVITE',
          title: 'Accréditation Expert & Mentor MTC validée',
          message: comment
            ? `Félicitations ! Votre demande « Proposer mon expertise » a été validée (${comment}). Le rôle Mentor / Expert vous a été automatiquement attribué.`
            : 'Félicitations ! Votre demande « Proposer mon expertise » a été validée. Le rôle Mentor / Expert vous a été automatiquement attribué et votre Espace Mentor est désormais actif.',
          priority: 'HIGH',
          actionUrl: '/espace-mentor',
        },
        tx,
      );

      return {
        application: updated,
        mentorRoleGranted: roleOutcome.granted,
      };
    });

    return outcome;
  }

  async rejectApplication(
    actorId: string,
    recordId: string,
    dto: RejectTalentApplicationDto,
  ) {
    const record = await this.prisma.censusRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        userId: true,
        talentStatus: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Talent application record not found.');
    }

    if (record.talentStatus !== TalentApplicationStatus.PENDING) {
      throw new ConflictException(
        'Only pending expertise applications can be rejected.',
      );
    }

    const now = new Date();
    const reason = dto.reason.trim();

    const application = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.censusRecord.update({
        where: { id: record.id },
        data: {
          optInTalentDirectory: false,
          talentStatus: TalentApplicationStatus.REJECTED,
          talentReviewedAt: now,
          talentReviewedById: actorId,
          talentRejectionReason: reason,
        },
        select: TALENT_APPLICATION_SELECT,
      });

      await this.notifications.emitToUser(
        record.userId,
        {
          type: 'MENTORSHIP_INVITE',
          title: 'Demande d’expertise non retenue',
          message: `Votre demande « Proposer mon expertise » n’a pas pu être validée pour le motif suivant : ${reason}`,
          priority: 'HIGH',
          actionUrl: '/espace/talents',
        },
        tx,
      );

      return updated;
    });

    return {
      application,
    };
  }

  private generateReference() {
    return `CNS-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  }
}
