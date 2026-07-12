import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + dependency health' })
  async check() {
    const checks: Record<string, 'up' | 'down'> = { api: 'up', database: 'down', redis: 'down' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      // reported as down
    }
    try {
      await this.redis.client.ping();
      checks.redis = 'up';
    } catch {
      // reported as down
    }
    const healthy = Object.values(checks).every((s) => s === 'up');
    return { status: healthy ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() };
  }
}
