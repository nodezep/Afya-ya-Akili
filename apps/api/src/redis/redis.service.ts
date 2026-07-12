import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /** Sliding-window rate limit. Returns true when the action is allowed. */
  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return count <= limit;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
