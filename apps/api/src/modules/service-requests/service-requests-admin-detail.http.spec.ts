import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";

import { Role } from "../../generated/prisma/client";
import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ServiceRequestsController } from "./service-requests.controller";
import { ServiceRequestsService } from "./service-requests.service";

describe("administrative service request detail HTTP authorization", () => {
  const detail = { publicCode: "SO2026001", proposals: [], contract: null };
  const service = { findAdmin: jest.fn().mockResolvedValue({ total: 0, byStatus: [], items: [], pagination: { page: 1, limit: 20, totalPages: 0 } }), findAdminDetailByPublicCode: jest.fn().mockResolvedValue(detail) };
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp(service);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without authentication and does not read detail", async () => {
    const response = await request(app.url, "/api/v1/service-requests/admin/by-code/SO2026001");
    expect(response.status).toBe(401);
    expect(service.findAdminDetailByPublicCode).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin and does not read detail", async () => {
    const response = await request(app.url, "/api/v1/service-requests/admin/by-code/SO2026001", "customer");
    expect(response.status).toBe(403);
    expect(service.findAdminDetailByPublicCode).not.toHaveBeenCalled();
  });

  it("returns the detail to an ADMIN through the real guards", async () => {
    const response = await request(app.url, "/api/v1/service-requests/admin/by-code/so2026001", "admin");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(detail);
    expect(service.findAdminDetailByPublicCode).toHaveBeenCalledWith("admin-id", "so2026001");
  });

  it("combines the validated status filter and public code for an ADMIN", async () => {
    const response = await request(app.url, "/api/v1/service-requests/admin?code=so2026001&status=HIRED&page=2&limit=20", "admin");
    expect(response.status).toBe(200);
    expect(service.findAdmin).toHaveBeenCalledWith("so2026001", "HIRED", 2, 20);
  });

  it("rejects an unsupported administrative status filter", async () => {
    const response = await request(app.url, "/api/v1/service-requests/admin?status=OPEN", "admin");
    expect(response.status).toBe(400);
    expect(service.findAdmin).not.toHaveBeenCalled();
  });
});

async function createApp(service: { findAdmin: jest.Mock; findAdminDetailByPublicCode: jest.Mock }) {
  const auth = {
    extractBearerToken: (value?: string) => value?.replace("Bearer ", "") ?? null,
    authenticateAccessToken: jest.fn(async (token: string) => ({ id: token === "admin" ? "admin-id" : "customer-id", sessionId: "session", roles: token === "admin" ? [Role.ADMIN] : [Role.CUSTOMER], phoneVerifiedAt: null })),
  };
  const module = await Test.createTestingModule({
    controllers: [ServiceRequestsController],
    providers: [
      { provide: ServiceRequestsService, useValue: service },
      AccessTokenGuard,
      RolesGuard,
      { provide: AccessTokenAuthService, useValue: auth },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as AddressInfo;
  return Object.assign(app, { url: `http://127.0.0.1:${address.port}` });
}

function request(url: string, path: string, token?: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(`${url}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: response.statusCode ?? 0, body: text ? JSON.parse(text) : null });
      });
    });
    req.on("error", reject);
    req.end();
  });
}
