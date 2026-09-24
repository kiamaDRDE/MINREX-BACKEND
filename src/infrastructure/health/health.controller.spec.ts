import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { HealthController } from './health.controller.js';
import type { RedisService } from '../cache/redis.service.js';
import type { PrismaService } from '../database/prisma.service.js';

describe('HealthController', () => {
  let controller: HealthController;

  const prismaMock = {
    $queryRaw: jest.fn(),
  };

  const redisMock = {
    ping: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.$queryRaw.mockResolvedValue([{ result: 1 }]);
    redisMock.ping.mockResolvedValue('PONG');

    controller = new HealthController(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
    );
  });

  it('should report database and redis as up', async () => {
    const result = await controller.check();

    expect(result).toEqual({
      status: 'ok',
      service: 'minrex-api',
      services: {
        database: 'up',
        redis: 'up',
      },
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(redisMock.ping).toHaveBeenCalledTimes(1);
  });
});
