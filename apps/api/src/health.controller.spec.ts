const mockRedisConnect = jest.fn();
const mockRedisPing = jest.fn();
const mockRedisDisconnect = jest.fn();

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    connect: mockRedisConnect,
    ping: mockRedisPing,
    disconnect: mockRedisDisconnect,
  })),
}));

import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "./database/prisma.service";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;
  let prismaMock: {
    $queryRaw: jest.Mock;
  };
  let configServiceMock: {
    getOrThrow: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ health: 1 }]),
    };
    configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue("redis://localhost:6379"),
    };
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue("PONG");
    mockRedisDisconnect.mockReset();

    controller = new HealthController(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it("mantém o healthcheck legado disponível", () => {
    const response = controller.getHealth();

    expect(response.status).toBe("ok");
    expect(response.service).toBe("soravi-api");
    expect(response.timestamp).toEqual(expect.any(String));
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(mockRedisPing).not.toHaveBeenCalled();
  });

  it("responde liveness sem consultar PostgreSQL ou Redis", () => {
    const response = controller.getLive();

    expect(response.status).toBe("ok");
    expect(response.service).toBe("soravi-api");
    expect(response.timestamp).toEqual(expect.any(String));
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(mockRedisPing).not.toHaveBeenCalled();
  });

  it("responde readiness quando PostgreSQL e Redis estão disponíveis", async () => {
    const response = await controller.getReady();

    expect(response.status).toBe("ok");
    expect(response.service).toBe("soravi-api");
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockRedisConnect).toHaveBeenCalledTimes(1);
    expect(mockRedisPing).toHaveBeenCalledTimes(1);
    expect(mockRedisDisconnect).toHaveBeenCalledTimes(1);
  });

  it("retorna indisponível quando PostgreSQL falha sem testar Redis", async () => {
    prismaMock.$queryRaw.mockRejectedValue(
      new Error("postgresql://user:secret@db.internal:5432/soravi"),
    );

    await expect(controller.getReady()).rejects.toMatchObject({
      status: 503,
      response: {
        status: "unavailable",
        service: "soravi-api",
      },
    });
    expect(mockRedisPing).not.toHaveBeenCalled();
  });

  it("retorna indisponível quando Redis falha", async () => {
    mockRedisPing.mockRejectedValue(
      new Error("redis://user:secret@redis.internal:6379"),
    );

    await expect(controller.getReady()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("não expõe detalhes de conexão na resposta de erro", async () => {
    const sensitiveConnection =
      "redis://health-user:health-password@redis.internal:6379";
    mockRedisPing.mockRejectedValue(new Error(sensitiveConnection));

    try {
      await controller.getReady();
      fail("A readiness deveria falhar.");
    } catch (error) {
      const response = (error as ServiceUnavailableException).getResponse();
      const serializedResponse = JSON.stringify(response);

      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      expect(serializedResponse).not.toContain(sensitiveConnection);
      expect(serializedResponse).not.toContain("health-password");
      expect(response).toEqual({
        status: "unavailable",
        service: "soravi-api",
      });
    }
  });
});
