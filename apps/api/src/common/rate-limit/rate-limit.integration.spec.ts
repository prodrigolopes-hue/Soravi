import "reflect-metadata";

import { randomUUID, createHash } from "node:crypto";
import { get } from "node:http";
import { AddressInfo } from "node:net";

import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import {
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
} from "@nestjs/throttler";
import { config as loadEnvironment } from "dotenv";
import Redis, { RedisOptions } from "ioredis";

const TEST_LIMIT = 5;
const TEST_TTL_MS = 60_000;
const REDIS_OPTIONS: RedisOptions = {
  connectTimeout: 1_000,
  commandTimeout: 1_000,
  enableOfflineQueue: false,
  enableReadyCheck: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => (attempt <= 1 ? 50 : null),
};

@Controller("rate-limit-integration")
class DistributedRateLimitTestController {
  @Get()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: TEST_LIMIT, ttl: TEST_TTL_MS } })
  limited(): { allowed: true } {
    return { allowed: true };
  }
}

interface TestApplication {
  app: INestApplication;
  storage: ThrottlerStorageRedisService;
  url: string;
}

function getLocalRedisUrl(): string {
  loadEnvironment({ path: "../../.env", quiet: true });

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL local é obrigatória para este teste.");
  }

  const hostname = new URL(redisUrl).hostname;

  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error("O teste de integração exige um Redis local.");
  }

  return redisUrl;
}

function redisKeysForTracker(tracker: string): [string, string] {
  const unhashedKey =
    `DistributedRateLimitTestController-limited-default-${tracker}`;
  const key = createHash("sha256").update(unhashedKey).digest("hex");

  return [`{${key}:default}:hits`, `{${key}:default}:blocked`];
}

async function deleteRedisKeys(
  redisUrl: string,
  keys: [string, string],
): Promise<void> {
  const client = new Redis(redisUrl, {
    connectTimeout: 1_000,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    await client.del(...keys);
  } finally {
    client.disconnect(false);
  }
}

async function createTestApplication(
  redisUrl: string,
  tracker: string,
  options: RedisOptions = REDIS_OPTIONS,
): Promise<TestApplication> {
  const storage = new ThrottlerStorageRedisService(redisUrl, options);
  storage.redis.on("error", () => undefined);

  @Module({
    imports: [
      ThrottlerModule.forRoot({
        getTracker: () => tracker,
        storage,
        throttlers: [{ limit: TEST_LIMIT, ttl: TEST_TTL_MS }],
      }),
    ],
    controllers: [DistributedRateLimitTestController],
  })
  class TestRateLimitModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestRateLimitModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");

  const address = app.getHttpServer().address() as AddressInfo;

  return {
    app,
    storage,
    url: `http://127.0.0.1:${address.port}/rate-limit-integration`,
  };
}

async function waitForRedisReady(
  storage: ThrottlerStorageRedisService,
): Promise<void> {
  if (storage.redis.status === "ready") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onReady = (): void => {
      cleanupListeners();
      resolve();
    };
    const onEnd = (): void => {
      cleanupListeners();
      reject(new Error("A conexão Redis encerrou antes de ficar pronta."));
    };
    const cleanupListeners = (): void => {
      storage.redis.off("ready", onReady);
      storage.redis.off("end", onEnd);
    };

    storage.redis.once("ready", onReady);
    storage.redis.once("end", onEnd);
  });
}

async function requestStatus(url: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const request = get(url, { agent: false }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });

    request.once("error", reject);
  });
}

describe("rate limit distribuído com Redis", () => {
  it("compartilha o contador entre duas aplicações Nest independentes", async () => {
    const redisUrl = getLocalRedisUrl();
    const tracker = `soravi-rate-limit-integration-${randomUUID()}`;
    const keys = redisKeysForTracker(tracker);
    let apiA: TestApplication | undefined;
    let apiB: TestApplication | undefined;

    try {
      await deleteRedisKeys(redisUrl, keys);
      apiA = await createTestApplication(redisUrl, tracker);
      apiB = await createTestApplication(redisUrl, tracker);
      await Promise.all([
        waitForRedisReady(apiA.storage),
        waitForRedisReady(apiB.storage),
      ]);

      const statuses: number[] = [];

      for (let request = 0; request < 3; request += 1) {
        statuses.push(await requestStatus(apiA.url));
      }

      for (let request = 0; request < 3; request += 1) {
        statuses.push(await requestStatus(apiB.url));
      }

      expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    } finally {
      await apiA?.app.close();
      await apiB?.app.close();
      await deleteRedisKeys(redisUrl, keys);
    }

    expect(apiA?.storage.redis.status).toBe("end");
    expect(apiB?.storage.redis.status).toBe("end");
  });

  it("não continua atendendo quando o Redis está indisponível", async () => {
    const tracker = `soravi-rate-limit-unavailable-${randomUUID()}`;
    const unavailableOptions: RedisOptions = {
      connectTimeout: 100,
      commandTimeout: 100,
      enableOfflineQueue: false,
      enableReadyCheck: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    };
    const testApplication = await createTestApplication(
      "redis://127.0.0.1:1",
      tracker,
      unavailableOptions,
    );

    try {
      const status = await requestStatus(testApplication.url);

      expect(status).toBeGreaterThanOrEqual(500);
      expect(status).not.toBe(429);
    } finally {
      await testApplication.app.close();
    }

    expect(testApplication.storage.redis.status).toBe("end");
  });
});
