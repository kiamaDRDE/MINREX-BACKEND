import { Controller, Get } from '@nestjs/common';

import { RedisService } from '../cache/redis.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    await Promise.all([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    return {
      status: 'ok',
      service: 'minrex-api',
      services: {
        database: 'up',
        redis: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
