import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { RedisService } from '../cache/redis.service.js';
import { SmsService } from './sms.service.js';

describe('SmsService', () => {
  let envMap: Record<string, unknown>;
  const redisSet = jest.fn<() => Promise<string>>();

  const configMock = {
    get: jest.fn((key: string, defaultVal?: unknown) =>
      envMap[key] !== undefined ? envMap[key] : defaultVal,
    ),
  } as unknown as ConfigService;

  const redisMock = {
    getClient: jest.fn(() => ({
      status: 'ready',
      set: redisSet,
    })),
  } as unknown as RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisSet.mockResolvedValue('OK');
    envMap = {
      NODE_ENV: 'development',
      SMS_PROVIDER: 'mock',
      SMS_SENDER_ID: 'MINREX-CMR',
    };
  });

  it('reports non-production capabilities in mock mode and blocks mock in production', async () => {
    const service = new SmsService(configMock, redisMock);
    expect(service.getCapabilities()).toEqual({
      provider: 'mock',
      smsEnabled: true,
      productionReady: false,
    });

    const res = await service.sendOtpSms({
      to: '+237699001122',
      code: '123456',
      purposeLabel: 'Connexion',
      expiresMinutes: 5,
    });
    expect(res).toEqual({ provider: 'mock', simulated: true });
    expect(redisSet).toHaveBeenCalledTimes(1);

    envMap['NODE_ENV'] = 'production';
    expect(service.getCapabilities().smsEnabled).toBe(false);
    await expect(
      service.sendOtpSms({
        to: '+237699001122',
        code: '123456',
        purposeLabel: 'Connexion',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('requires credentials for production SMS gateways', () => {
    envMap['NODE_ENV'] = 'production';
    envMap['SMS_PROVIDER'] = 'brevo';
    envMap['SMS_API_KEY'] = '';
    const service = new SmsService(configMock, redisMock);
    expect(service.getCapabilities()).toEqual({
      provider: 'brevo',
      smsEnabled: false,
      productionReady: false,
    });

    envMap['SMS_API_KEY'] = 'xkeysib-123';
    expect(service.getCapabilities()).toEqual({
      provider: 'brevo',
      smsEnabled: true,
      productionReady: true,
    });
  });
});
