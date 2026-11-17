import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';

import { UserStatus } from '../../../generated/prisma/enums.js';
import type { RedisService } from '../../../infrastructure/cache/redis.service.js';
import type { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { MailService } from '../../../infrastructure/mail/mail.service.js';
import type { SmsService } from '../../../infrastructure/sms/sms.service.js';

import { AuthService } from './auth.service.js';
import type { ConsularIdentityService } from './consular-identity.service.js';

describe('AuthService — OTP & Consular Identity', () => {
  let service: AuthService;
  const redisStore = new Map<string, string>();

  const redisClientMock = {
    status: 'ready',
    set: jest.fn(async (key: string, val: string, ...args: unknown[]) => {
      if (args.includes('NX') && redisStore.has(key)) {
        return null;
      }
      redisStore.set(key, val);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    del: jest.fn(async (key: string) => (redisStore.delete(key) ? 1 : 0)),
    ttl: jest.fn(async () => 45),
    incr: jest.fn(async (key: string) => {
      const next = Number(redisStore.get(key) ?? '0') + 1;
      redisStore.set(key, String(next));
      return next;
    }),
    expire: jest.fn(async () => 1),
  };

  let createdTokenHash = '';
  let smsEnabled = true;

  const userFindFirstMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const userFindUniqueMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const userUpdateMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const verificationTokenFindFirstMock =
    jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const verificationTokenUpdateManyMock =
    jest.fn<(...args: unknown[]) => Promise<{ count: number }>>();
  const authSessionCreateMock =
    jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const transactionMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();

  const prismaMock = {
    user: {
      findFirst: userFindFirstMock,
      findUnique: userFindUniqueMock,
      update: userUpdateMock,
    },
    verificationToken: {
      findFirst: verificationTokenFindFirstMock,
      updateMany: verificationTokenUpdateManyMock,
    },
    authSession: {
      create: authSessionCreateMock,
    },
    $transaction: transactionMock,
  } as unknown as PrismaService;

  const sendOtpEmailMock =
    jest.fn<(opts: { code: string }) => Promise<void>>();
  const sendVerificationEmailMock = jest.fn<() => Promise<void>>();

  const mailMock = {
    sendOtpEmail: sendOtpEmailMock,
    sendVerificationEmail: sendVerificationEmailMock,
  } as unknown as MailService;

  const sendOtpSmsMock =
    jest.fn<
      (...args: unknown[]) => Promise<{ provider: string; simulated: boolean }>
    >();

  const smsMock = {
    getCapabilities: jest.fn(() => ({
      provider: 'mock',
      smsEnabled,
      productionReady: false,
    })),
    sendOtpSms: sendOtpSmsMock,
  } as unknown as SmsService;

  const redisMock = {
    getClient: jest.fn(() => redisClientMock),
  } as unknown as RedisService;

  const verifyConsularCredentialsMock =
    jest.fn<(...args: unknown[]) => Promise<unknown>>();

  const consularMock = {
    verifyConsularCredentials: verifyConsularCredentialsMock,
  } as unknown as ConsularIdentityService;

  const jwtMock = {
    signAsync: jest.fn(async () => 'signed.jwt.token'),
  } as unknown as JwtService;

  const envMap: Record<string, unknown> = {
    NODE_ENV: 'development',
    EXPOSE_DEV_OTP_IN_RESPONSE: true,
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 604800,
  };

  const configMock = {
    get: jest.fn((key: string, defaultVal?: unknown) =>
      envMap[key] !== undefined ? envMap[key] : defaultVal,
    ),
    getOrThrow: jest.fn((key: string) => envMap[key]),
  } as unknown as ConfigService;

  const activeUser = {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'jean.dupont@example.com',
    username: 'jean.dupont',
    phone: '+237699112233',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    phoneVerifiedAt: null,
    consularIdentifier: 'CMR-FRPAR-2026-AABBCC',
    consularVerifiedAt: new Date('2026-02-01T00:00:00Z'),
    profile: {
      firstName: 'Jean',
      lastName: 'Dupont',
      preferredLanguage: 'FR',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    createdTokenHash = '';
    smsEnabled = true;

    sendOtpEmailMock.mockResolvedValue(undefined);
    sendOtpSmsMock.mockResolvedValue({
      provider: 'mock',
      simulated: true,
    });
    userUpdateMock.mockResolvedValue(activeUser);
    authSessionCreateMock.mockResolvedValue({ id: 'sess-1' });

    transactionMock.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      const tx = {
        verificationToken: {
          updateMany: jest.fn(async () => ({ count: 1 })),
          create: jest.fn(async ({ data }: { data: { tokenHash: string } }) => {
            createdTokenHash = data.tokenHash;
            return { id: 'tok-1' };
          }),
        },
      };
      return (arg as (t: typeof tx) => Promise<unknown>)(tx);
    });

    service = new AuthService(
      prismaMock,
      mailMock,
      smsMock,
      redisMock,
      consularMock,
      jwtMock,
      configMock,
    );
  });

  it('dispatches SMS OTP in dev mock mode and verifies OTP to issue session', async () => {
    userFindFirstMock.mockResolvedValue(activeUser);

    const reqRes = await service.requestOtp({
      channel: 'SMS',
      identifier: '+237 699 11 22 33',
    });

    expect(reqRes.sent).toBe(true);
    expect(reqRes.devOtpPreview).toMatch(/^\d{6}$/);
    expect(sendOtpSmsMock).toHaveBeenCalledTimes(1);

    verificationTokenFindFirstMock.mockResolvedValue({
      id: 'tok-1',
      tokenHash: createdTokenHash,
    });

    const loginRes = await service.verifyOtp({
      channel: 'SMS',
      identifier: '+237699112233',
      code: reqRes.devOtpPreview!,
    });

    expect(loginRes.accessToken).toBe('signed.jwt.token');
    expect(loginRes.user.consularIdentifier).toBe('CMR-FRPAR-2026-AABBCC');
    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeUser.id },
        data: { phoneVerifiedAt: expect.any(Date) },
      }),
    );
  });

  it('rejects SMS OTP requests cleanly when SMS gateway is disabled in production', async () => {
    smsEnabled = false;

    await expect(
      service.requestOtp({
        channel: 'SMS',
        identifier: '+237699112233',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('clears cooldown if OTP email dispatch throws so user can retry immediately', async () => {
    userFindFirstMock.mockResolvedValue(activeUser);
    sendOtpEmailMock.mockRejectedValueOnce(new Error('SMTP down'));

    await expect(
      service.requestOtp({
        channel: 'EMAIL',
        identifier: 'jean.dupont@example.com',
      }),
    ).rejects.toThrow('SMTP down');

    expect(redisClientMock.del).toHaveBeenCalledTimes(1);
  });

  it('locks OTP token after 5 failed attempts', async () => {
    const hash = createHash('sha256')
      .update(`otp:${activeUser.id}:EMAIL:654321`)
      .digest('hex');

    userFindFirstMock.mockResolvedValue(activeUser);
    verificationTokenFindFirstMock.mockResolvedValue({
      id: 'tok-lock',
      tokenHash: hash,
    });

    for (let i = 0; i < 5; i++) {
      await expect(
        service.verifyOtp({
          channel: 'EMAIL',
          identifier: 'jean.dupont@example.com',
          code: '000000',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    expect(verificationTokenUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tok-lock', consumedAt: null },
      }),
    );
  });

  it('completes 2-factor consular identity login challenge via email OTP', async () => {
    verifyConsularCredentialsMock.mockResolvedValue({
      user: activeUser,
      consularIdentifier: 'CMR-FRPAR-2026-AABBCC',
      postName: 'Ambassade du Cameroun en France',
    });

    let sentCode = '';
    sendOtpEmailMock.mockImplementation(async (opts: { code: string }) => {
      sentCode = opts.code;
    });

    const challenge = await service.requestConsularChallenge({
      consularId: 'CMR-FRPAR-2026-AABBCC',
      birthDate: '1990-05-14',
      deliveryChannel: 'EMAIL',
    });

    expect(challenge.challengeRequired).toBe(true);
    expect(challenge.maskedDestination).toBe('je***@example.com');
    expect(sentCode).toMatch(/^\d{6}$/);

    userFindUniqueMock.mockResolvedValue(activeUser);
    verificationTokenFindFirstMock.mockResolvedValue({
      id: 'tok-consular',
      tokenHash: createdTokenHash,
    });

    const verified = await service.verifyConsularChallenge({
      challengeId: challenge.challengeId,
      code: sentCode,
    });

    expect(verified.accessToken).toBe('signed.jwt.token');
    expect(verified.user.consularIdentifier).toBe('CMR-FRPAR-2026-AABBCC');
  });
});
