import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { PrismaService } from "./database/prisma.service";

interface HealthResponse {
  status: "ok";
  service: "soravi-api";
  timestamp: string;
}

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return this.getHealthyResponse();
  }

  @Get("live")
  getLive(): HealthResponse {
    return this.getHealthyResponse();
  }

  @Get("ready")
  async getReady(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.checkRedis();
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        service: "soravi-api",
      });
    }

    return this.getHealthyResponse();
  }

  private getHealthyResponse(): HealthResponse {
    return {
      status: "ok",
      service: "soravi-api",
      timestamp: new Date().toISOString(),
    };
  }

  private async checkRedis(): Promise<void> {
    const redis = new Redis(
      this.configService.getOrThrow<string>("REDIS_URL"),
      {
        lazyConnect: true,
        connectTimeout: 5_000,
        commandTimeout: 2_000,
        enableOfflineQueue: false,
        enableReadyCheck: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (attempt) =>
          attempt <= 3 ? Math.min(attempt * 200, 1_000) : null,
      },
    );

    try {
      await redis.connect();
      await redis.ping();
    } finally {
      redis.disconnect();
    }
  }
}
