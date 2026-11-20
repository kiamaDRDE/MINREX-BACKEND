import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { envValidationSchema } from '../src/config/env.validation.js';
import {
  CensusStatus,
  DepartureReason,
  ResidenceStatus,
  TalentApplicationStatus,
  UserStatus,
} from '../src/generated/prisma/enums.js';
import { RedisModule } from '../src/infrastructure/cache/redis.module.js';
import { DatabaseModule } from '../src/infrastructure/database/database.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { MailModule } from '../src/infrastructure/mail/mail.module.js';
import { MailService } from '../src/infrastructure/mail/mail.service.js';
import { CensusModule } from '../src/modules/census/census.module.js';
import { SYSTEM_ROLE_CODES } from '../src/modules/identity/authorization/constants/system-roles.constants.js';
import { IdentityModule } from '../src/modules/identity/identity.module.js';
import { MentorshipModule } from '../src/modules/mentorship/mentorship.module.js';
import { NetworkModule } from '../src/modules/network/network.module.js';
import { NotificationModule } from '../src/modules/notifications/notification.module.js';
import { TalentModule } from '../src/modules/talent/talent.module.js';

interface TestUserFixture {
  id: string;
  email: string;
  username: string;
  password: string;
  accessToken: string;
}

describe('Proposer mon expertise -> Validation -> Attribution automatique rôle MENTOR_EXPERT (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testRunId = randomUUID().slice(0, 8);
  const createdUserIds: string[] = [];
  const createdMentorshipIds: string[] = [];

  let adminUser: TestUserFixture;
  let expertApplicant: TestUserFixture;
  let rejectedApplicant: TestUserFixture;
  let censusExpertApplicant: TestUserFixture;
  let menteeUser: TestUserFixture;

  let activeCountryId: string;
  let activePostId: string;

  const mockMailService = {
    verifyTransport: async () => true,
    sendVerificationEmail: async () => undefined,
    sendOtpEmail: async () => undefined,
    sendNotificationEmail: async () => undefined,
    sendConsularIdentityEmail: async () => undefined,
    enqueueVerificationEmail: () => undefined,
    enqueueNotificationEmail: () => undefined,
    enqueueConsularIdentityEmail: () => undefined,
    resolveFrontendUrl: (p?: string | null) => p ?? null,
    onModuleDestroy: () => undefined,
  };

  async function createAuthenticatedTestUser(params: {
    prefix: string;
    firstName: string;
    lastName: string;
    roleCode: string;
  }): Promise<TestUserFixture> {
    const suffix = `${testRunId}_${params.prefix}_${randomUUID().slice(0, 4)}`;
    const email = `e2e.${suffix}@minrex-test.local`;
    const username = `e2e_${suffix}`.slice(0, 45);
    const password = 'TestPassword!2026';
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const role = await prisma.role.findFirstOrThrow({
      where: {
        code: params.roleCode,
        isActive: true,
      },
      select: { id: true },
    });

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName: params.firstName,
            lastName: params.lastName,
            displayName: `${params.firstName} ${params.lastName}`,
            residenceCountry: 'France',
          },
        },
        roleAssignments: {
          create: {
            roleId: role.id,
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    createdUserIds.push(user.id);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-minrex-client', 'web')
      .send({
        identifier: email,
        password,
      })
      .expect(200);

    const body = loginRes.body as {
      success: boolean;
      data: { accessToken: string };
    };

    expect(body.success).toBe(true);
    expect(typeof body.data.accessToken).toBe('string');

    return {
      id: user.id,
      email,
      username,
      password,
      accessToken: body.data.accessToken,
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
        DatabaseModule,
        RedisModule,
        MailModule,
        IdentityModule,
        NetworkModule,
        CensusModule,
        TalentModule,
        MentorshipModule,
        NotificationModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    })
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    // Résoudre un pays actif couvert par un poste diplomatique actif pour le scénario recensement
    const coverage = await prisma.postCoverage.findFirstOrThrow({
      where: {
        post: { status: 'ACTIVE' },
        country: { isActive: true },
      },
      select: {
        countryId: true,
        postId: true,
      },
    });
    activeCountryId = coverage.countryId;
    activePostId = coverage.postId;

    adminUser = await createAuthenticatedTestUser({
      prefix: 'admin',
      firstName: 'Admin',
      lastName: 'E2E',
      roleCode: SYSTEM_ROLE_CODES.PLATFORM_ADMIN,
    });

    expertApplicant = await createAuthenticatedTestUser({
      prefix: 'expert',
      firstName: 'Jean',
      lastName: `Expert${testRunId}`,
      roleCode: SYSTEM_ROLE_CODES.DIASPORA_MEMBER,
    });

    rejectedApplicant = await createAuthenticatedTestUser({
      prefix: 'reject',
      firstName: 'Paul',
      lastName: `Refuse${testRunId}`,
      roleCode: SYSTEM_ROLE_CODES.DIASPORA_MEMBER,
    });

    censusExpertApplicant = await createAuthenticatedTestUser({
      prefix: 'census',
      firstName: 'Marie',
      lastName: `Recensee${testRunId}`,
      roleCode: SYSTEM_ROLE_CODES.DIASPORA_MEMBER,
    });

    menteeUser = await createAuthenticatedTestUser({
      prefix: 'mentee',
      firstName: 'Aline',
      lastName: 'Mentoree',
      roleCode: SYSTEM_ROLE_CODES.DIASPORA_MEMBER,
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma && createdUserIds.length > 0) {
      if (createdMentorshipIds.length > 0) {
        await prisma.mentorshipRequestHistory.deleteMany({
          where: { requestId: { in: createdMentorshipIds } },
        });
        await prisma.mentorshipRequest.deleteMany({
          where: { id: { in: createdMentorshipIds } },
        });
      }

      await prisma.notification.deleteMany({
        where: {
          OR: [
            { recipientId: { in: createdUserIds } },
            { content: { contains: testRunId } },
          ],
        },
      });

      const censusRecords = await prisma.censusRecord.findMany({
        where: { userId: { in: createdUserIds } },
        select: { id: true },
      });
      const censusRecordIds = censusRecords.map((r) => r.id);

      if (censusRecordIds.length > 0) {
        await prisma.censusReview.deleteMany({
          where: { censusRecordId: { in: censusRecordIds } },
        });
        await prisma.censusStatusHistory.deleteMany({
          where: { censusRecordId: { in: censusRecordIds } },
        });
        await prisma.censusDocument.deleteMany({
          where: { censusRecordId: { in: censusRecordIds } },
        });
        await prisma.censusRecord.deleteMany({
          where: { id: { in: censusRecordIds } },
        });
      }

      await prisma.authSession.deleteMany({
        where: { userId: { in: createdUserIds } },
      });

      await prisma.userRoleAssignment.deleteMany({
        where: { userId: { in: createdUserIds } },
      });

      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    if (app) {
      await app.close();
    }
  }, 30_000);

  it('attribue automatiquement le rôle MENTOR_EXPERT après validation admin de "Proposer mon expertise" et débloque l’espace mentor + matching', async () => {
    // 1. Avant la demande : uniquement DIASPORA_MEMBER, aucun accès mentor
    const meBeforeRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .expect(200);

    const rolesBefore = (
      meBeforeRes.body.data.authorization.assignments as Array<{
        role: { code: string };
      }>
    ).map((a) => a.role.code);

    expect(rolesBefore).toEqual([SYSTEM_ROLE_CODES.DIASPORA_MEMBER]);
    expect(meBeforeRes.body.data.authorization.permissions).not.toContain(
      'talent.mentorship.handle',
    );

    await request(app.getHttpServer())
      .get('/api/v1/mentorship/mentor/requests')
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .expect(403);

    // 2. Le citoyen soumet "Proposer mon expertise"
    const submitRes = await request(app.getHttpServer())
      .post('/api/v1/talents/me/application')
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .send({
        jobTitle: 'Architecte Cloud Senior',
        sector: "Technologies de l'Information & IA",
        yearsExperience: 9,
        skills: ['Kubernetes', 'TypeScript', 'Architecture Cloud'],
        qualifications: 'Diplômes: Master Informatique (2017) | Spécifications: Cloud souverain',
        optInTalentDirectory: true,
      })
      .expect(201);

    const applicationId: string = submitRes.body.data.application.id;
    expect(submitRes.body.data.application.talentStatus).toBe(
      TalentApplicationStatus.PENDING,
    );
    expect(submitRes.body.data.application.optInTalentDirectory).toBe(true);

    // Tant que l'admin n'a pas validé, le rôle MENTOR_EXPERT ne doit PAS encore être accordé
    const mePendingRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .expect(200);

    const rolesPending = (
      mePendingRes.body.data.authorization.assignments as Array<{
        role: { code: string };
      }>
    ).map((a) => a.role.code);
    expect(rolesPending).not.toContain(SYSTEM_ROLE_CODES.MENTOR_EXPERT);

    // Et le candidat ne figure pas encore dans l'annuaire public des experts approuvés
    const talentsBeforeApprovalRes = await request(app.getHttpServer())
      .get('/api/v1/talents')
      .query({ q: 'Architecte Cloud Senior' })
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .expect(200);

    expect(
      (talentsBeforeApprovalRes.body.data.items as Array<{ id: string }>).some(
        (t) => t.id === applicationId,
      ),
    ).toBe(false);

    // 3. L'admin consulte la file des candidatures en attente
    const pendingListRes = await request(app.getHttpServer())
      .get('/api/v1/talents/admin/applications')
      .query({ status: TalentApplicationStatus.PENDING })
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .expect(200);

    expect(
      (pendingListRes.body.data.items as Array<{ id: string }>).some(
        (item) => item.id === applicationId,
      ),
    ).toBe(true);

    // 4. L'admin valide la demande d'expertise
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/talents/admin/applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({
        comment: 'Expertise vérifiée et validée par la direction MTC.',
      })
      .expect(201);

    expect(approveRes.body.data.application.talentStatus).toBe(
      TalentApplicationStatus.APPROVED,
    );
    expect(approveRes.body.data.mentorRoleGranted).toBe(true);

    // 5. Vérification immédiate : le rôle MENTOR_EXPERT est automatiquement présent dans /auth/me
    const meAfterRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .expect(200);

    const rolesAfter = (
      meAfterRes.body.data.authorization.assignments as Array<{
        role: { code: string };
      }>
    ).map((a) => a.role.code);

    expect(rolesAfter).toContain(SYSTEM_ROLE_CODES.DIASPORA_MEMBER);
    expect(rolesAfter).toContain(SYSTEM_ROLE_CODES.MENTOR_EXPERT);
    expect(meAfterRes.body.data.authorization.permissions).toContain(
      'talent.mentorship.handle',
    );

    // 6. Le nouvel expert accède désormais aux routes mentor (200 au lieu de 403)
    await request(app.getHttpServer())
      .get('/api/v1/mentorship/mentor/requests')
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .expect(200);

    // 7. Il apparaît dans l'annuaire public /api/v1/talents
    const talentsAfterApprovalRes = await request(app.getHttpServer())
      .get('/api/v1/talents')
      .query({ q: 'Architecte Cloud Senior' })
      .set('Authorization', `Bearer ${menteeUser.accessToken}`)
      .expect(200);

    expect(
      (talentsAfterApprovalRes.body.data.items as Array<{ id: string }>).some(
        (t) => t.id === applicationId,
      ),
    ).toBe(true);

    // 8. Un mentoré crée une demande et l'admin peut immédiatement lui affecter ce nouveau mentor
    const mentorshipCreateRes = await request(app.getHttpServer())
      .post('/api/v1/mentorship/me/requests')
      .set('Authorization', `Bearer ${menteeUser.accessToken}`)
      .send({
        topic: 'Migration Cloud & Kubernetes',
        objectives: 'Accompagnement sur une architecture cloud souveraine au Cameroun.',
      })
      .expect(201);

    const mentorshipRequestId: string = mentorshipCreateRes.body.data.id;
    createdMentorshipIds.push(mentorshipRequestId);

    const matchRes = await request(app.getHttpServer())
      .post(`/api/v1/mentorship/admin/requests/${mentorshipRequestId}/match`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({
        mentorId: expertApplicant.id,
      })
      .expect(201);

    expect(matchRes.body.data.mentorId).toBe(expertApplicant.id);
    expect(matchRes.body.data.status).toBe('MATCHED');

    const mentorAssignedRes = await request(app.getHttpServer())
      .get('/api/v1/mentorship/mentor/requests')
      .set('Authorization', `Bearer ${expertApplicant.accessToken}`)
      .expect(200);

    expect(
      (mentorAssignedRes.body.data as Array<{ id: string }>).some(
        (req) => req.id === mentorshipRequestId,
      ),
    ).toBe(true);

    // 9. Idempotence : une seconde approbation ne crée pas de doublon de UserRoleAssignment
    const secondApproveRes = await request(app.getHttpServer())
      .post(`/api/v1/talents/admin/applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({})
      .expect(201);

    expect(secondApproveRes.body.data.mentorRoleGranted).toBe(false);

    const mentorAssignmentsCount = await prisma.userRoleAssignment.count({
      where: {
        userId: expertApplicant.id,
        isActive: true,
        role: { code: SYSTEM_ROLE_CODES.MENTOR_EXPERT },
      },
    });
    expect(mentorAssignmentsCount).toBe(1);
  });

  it('ne donne PAS le rôle MENTOR_EXPERT si la demande "Proposer mon expertise" est rejetée par l’admin', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/api/v1/talents/me/application')
      .set('Authorization', `Bearer ${rejectedApplicant.accessToken}`)
      .send({
        jobTitle: 'Consultant Junior',
        sector: 'Finance, Banque & Économie',
        yearsExperience: 1,
        skills: ['Excel'],
        optInTalentDirectory: true,
      })
      .expect(201);

    const applicationId: string = submitRes.body.data.application.id;

    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/talents/admin/applications/${applicationId}/reject`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({
        reason: 'Expérience professionnelle insuffisante pour l’accréditation mentor.',
      })
      .expect(201);

    expect(rejectRes.body.data.application.talentStatus).toBe(
      TalentApplicationStatus.REJECTED,
    );
    expect(rejectRes.body.data.application.optInTalentDirectory).toBe(false);

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${rejectedApplicant.accessToken}`)
      .expect(200);

    const roles = (
      meRes.body.data.authorization.assignments as Array<{
        role: { code: string };
      }>
    ).map((a) => a.role.code);

    expect(roles).toEqual([SYSTEM_ROLE_CODES.DIASPORA_MEMBER]);
    expect(roles).not.toContain(SYSTEM_ROLE_CODES.MENTOR_EXPERT);

    await request(app.getHttpServer())
      .get('/api/v1/mentorship/mentor/requests')
      .set('Authorization', `Bearer ${rejectedApplicant.accessToken}`)
      .expect(403);
  });

  it('attribue aussi automatiquement MENTOR_EXPERT lors de la validation du dossier de recensement avec optInTalentDirectory=true', async () => {
    // 1. Créer un brouillon de recensement
    const draftRes = await request(app.getHttpServer())
      .post('/api/v1/census/me')
      .set('Authorization', `Bearer ${censusExpertApplicant.accessToken}`)
      .expect(201);

    const recordId: string = draftRes.body.data.record.id;

    // 2. Remplir le dossier + champs d'expertise (y compris skills, qualifications, optInTalentDirectory)
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/census/me/${recordId}`)
      .set('Authorization', `Bearer ${censusExpertApplicant.accessToken}`)
      .send({
        firstName: 'Marie',
        lastName: 'Recensee',
        birthDate: '1990-05-15',
        birthPlace: 'Douala',
        nationalityCountryId: activeCountryId,
        email: censusExpertApplicant.email,
        residenceCountryId: activeCountryId,
        residenceCity: 'Paris',
        residenceStatus: ResidenceStatus.WORKER,
        cameroonRegion: 'Littoral',
        departureYear: 2016,
        departureReason: DepartureReason.WORK,
        profession: 'Médecin Spécialiste',
        jobTitle: 'Cardiologue Hospitalier',
        sector: 'Santé & Sciences Médicales',
        yearsExperience: 10,
        expertiseDomains: ['Santé & Sciences Médicales'],
        skills: ['Cardiologie', 'Télémédecine'],
        qualifications: 'Doctorat en Médecine (2015)',
        optInTalentDirectory: true,
        declaredAccurate: true,
        consentDataProcessing: true,
        privacyNoticeAccepted: true,
      })
      .expect(200);

    expect(patchRes.body.data.record.optInTalentDirectory).toBe(true);
    expect(patchRes.body.data.record.talentStatus).toBe(
      TalentApplicationStatus.PENDING,
    );

    // 3. Soumettre le recensement
    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/census/me/${recordId}/submit`)
      .set('Authorization', `Bearer ${censusExpertApplicant.accessToken}`)
      .expect(201);

    const routedPostId: string =
      submitRes.body.data.record.assignedPostId ?? activePostId;

    // 4. L'admin démarre l'instruction puis valide le dossier
    await request(app.getHttpServer())
      .post(`/api/v1/census/posts/${routedPostId}/records/${recordId}/start-review`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .expect(201);

    const verifyRes = await request(app.getHttpServer())
      .post(`/api/v1/census/posts/${routedPostId}/records/${recordId}/verify`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({
        comment: 'Dossier consulaire et profil d’expertise vérifiés.',
      })
      .expect(201);

    expect(verifyRes.body.data.record.status).toBe(CensusStatus.VERIFIED);
    expect(verifyRes.body.data.record.talentStatus).toBe(
      TalentApplicationStatus.APPROVED,
    );
    expect(verifyRes.body.data.mentorRoleGranted).toBe(true);

    // 5. Le citoyen possède désormais automatiquement MENTOR_EXPERT
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${censusExpertApplicant.accessToken}`)
      .expect(200);

    const roles = (
      meRes.body.data.authorization.assignments as Array<{
        role: { code: string };
      }>
    ).map((a) => a.role.code);

    expect(roles).toContain(SYSTEM_ROLE_CODES.DIASPORA_MEMBER);
    expect(roles).toContain(SYSTEM_ROLE_CODES.MENTOR_EXPERT);

    await request(app.getHttpServer())
      .get('/api/v1/mentorship/mentor/requests')
      .set('Authorization', `Bearer ${censusExpertApplicant.accessToken}`)
      .expect(200);
  });
});
