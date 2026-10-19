import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";

import { Role } from "../../generated/prisma/client";
import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { CurrentProfessionalProfileService } from "./current-professional-profile.service";
import { CustomerProfileActivationService } from "./customer-profile-activation.service";
import { PERSONAL_IDENTITY_RECORDING_SERVICE } from "./personal-identity-recording.provider";
import { PersonalIdentityStatusService } from "./personal-identity-status.service";
import { ProfessionalProfileActivationService } from "./professional-profile-activation.service";
import { ProfessionalVerificationReviewService } from "./professional-verification-review.service";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";
import { UsersAdminStatusService } from "./users-admin-status.service";
import { UsersController } from "./users.controller";
import { UsersPasswordService } from "./users-password.service";
import { UsersPhoneService } from "./users-phone.service";
import { UsersService } from "./users.service";

describe("POST /api/v1/users/me/personal-identity", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const recordingService = { recordInitial: jest.fn().mockResolvedValue({ recorded: true }) };
  const statusService = { findCurrent: jest.fn().mockResolvedValue({ recorded: false }) };
  let app: Awaited<ReturnType<typeof createApp>> | undefined;

  beforeAll(async () => { app = await createApp(userId, recordingService, statusService); });
  afterAll(async () => { if (app) await app.close(); });
  afterEach(() => {
    jest.clearAllMocks();
    recordingService.recordInitial.mockResolvedValue({ recorded: true });
    statusService.findCurrent.mockResolvedValue({ recorded: false });
  });

  it("returns 401 for an unauthenticated identity status request", async () => {
    expect((await get(app!.url)).status).toBe(401);
    expect(statusService.findCurrent).not.toHaveBeenCalled();
  });

  it("returns the exact safe status for the session user without an identity", async () => {
    const response = await get(app!.url, true);
    expect(response.status).toBe(200);
    expect(response.body).toBe('{"recorded":false}');
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(statusService.findCurrent).toHaveBeenCalledWith(userId);
  });

  it("returns the exact safe status when the session user has an identity", async () => {
    statusService.findCurrent.mockResolvedValue({ recorded: true });
    const response = await get(app!.url, true);
    expect(response.status).toBe(200);
    expect(response.body).toBe('{"recorded":true}');
    expect(response.body).not.toMatch(/cpf|hmac|envelope|fingerprint|key/i);
  });

  it("reads the status while identity recording is disabled", async () => {
    const disabledApp = await createApp(userId, undefined, statusService);
    try {
      const response = await get(disabledApp.url, true);
      expect(response.status).toBe(200);
      expect(response.body).toBe('{"recorded":false}');
      expect(statusService.findCurrent).toHaveBeenCalledWith(userId);
    } finally {
      await disabledApp.close();
    }
  });

  it("rejects unauthenticated access", async () => {
    expect((await post(app!.url, { cpf: "529.982.247-25" })).status).toBe(401);
    expect(recordingService.recordInitial).not.toHaveBeenCalled();
  });

  it("rejects an extra userId through ValidationPipe", async () => {
    const response = await post(app!.url, { cpf: "529.982.247-25", userId: "other-user" }, true);
    expect(response.status).toBe(400);
    expect(recordingService.recordInitial).not.toHaveBeenCalled();
  });

  it("rejects invalid CPF without echoing it", async () => {
    const cpf = "000.000.000-00";
    const response = await post(app!.url, { cpf }, true);
    expect(response.status).toBe(400);
    expect(response.body).not.toContain(cpf);
    expect(recordingService.recordInitial).not.toHaveBeenCalled();
  });

  it("uses only the session user id and returns the safe confirmation", async () => {
    const response = await post(app!.url, { cpf: "529.982.247-25" }, true);
    expect(response.status).toBe(201);
    expect(response.body).toBe('{"recorded":true}');
    expect(recordingService.recordInitial).toHaveBeenCalledWith(userId, "529.982.247-25");
  });

  it("returns 503 without calling recordInitial while the feature is disabled", async () => {
    const disabledApp = await createApp(userId, undefined, statusService);
    try {
      const response = await post(disabledApp.url, { cpf: "529.982.247-25" }, true);
      expect(response.status).toBe(503);
      expect(recordingService.recordInitial).not.toHaveBeenCalled();
    } finally {
      await disabledApp.close();
    }
  });

  it("returns 429 after three valid requests in an isolated in-memory limiter", async () => {
    const rateLimitedService = { recordInitial: jest.fn().mockResolvedValue({ recorded: true }) };
    const rateLimitedApp = await createApp(userId, rateLimitedService, statusService);
    try {
      const responses = [
        await post(rateLimitedApp.url, { cpf: "529.982.247-25" }, true),
        await post(rateLimitedApp.url, { cpf: "529.982.247-25" }, true),
        await post(rateLimitedApp.url, { cpf: "529.982.247-25" }, true),
      ];
      expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
      await expect(post(rateLimitedApp.url, { cpf: "529.982.247-25" }, true)).resolves.toMatchObject({ status: 429 });
      expect(rateLimitedService.recordInitial).toHaveBeenCalledTimes(3);
    } finally {
      await rateLimitedApp.close();
    }
  });
});

async function createApp(
  userId: string,
  recordingService: { recordInitial: jest.Mock } | undefined,
  statusService: { findCurrent: jest.Mock },
) {
  const accessTokenAuthService = {
    extractBearerToken: (header: string | undefined) => header === "Bearer valid-token" ? "valid-token" : null,
    authenticateAccessToken: jest.fn().mockResolvedValue({ id: userId, sessionId: "session-id", roles: [Role.CUSTOMER], phoneVerifiedAt: null }),
  };
  const empty = {};
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [{ name: "default", limit: 3, ttl: 3_600_000 }],
      }),
    ],
    controllers: [UsersController],
    providers: [
      { provide: UsersService, useValue: empty }, { provide: UsersPhoneService, useValue: empty },
      { provide: UsersPasswordService, useValue: empty }, { provide: UsersAdminStatusService, useValue: empty },
      { provide: ProfessionalVerificationSubmissionService, useValue: empty }, { provide: ProfessionalVerificationReviewService, useValue: empty },
      { provide: CurrentProfessionalProfileService, useValue: empty }, { provide: CustomerProfileActivationService, useValue: empty },
      { provide: ProfessionalProfileActivationService, useValue: empty },
      { provide: PERSONAL_IDENTITY_RECORDING_SERVICE, useValue: recordingService },
      { provide: PersonalIdentityStatusService, useValue: statusService },
      AccessTokenGuard,
      { provide: AccessTokenAuthService, useValue: accessTokenAuthService },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as AddressInfo;
  return Object.assign(app, { url: `http://127.0.0.1:${address.port}/api/v1/users/me/personal-identity` });
}

function post(url: string, body: object, authenticated = false): Promise<{ status: number; body: string }> {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload), ...(authenticated ? { authorization: "Bearer valid-token" } : {}) } }, (response) => {
      let responseBody = "";
      response.on("data", (chunk: Buffer) => { responseBody += chunk.toString("utf8"); });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: responseBody }));
    });
    request.on("error", reject);
    request.end(payload);
  });
}

function get(
  url: string,
  authenticated = false,
): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {
      method: "GET",
      headers: authenticated ? { authorization: "Bearer valid-token" } : {},
    }, (response) => {
      let responseBody = "";
      response.on("data", (chunk: Buffer) => { responseBody += chunk.toString("utf8"); });
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        body: responseBody,
        headers: response.headers,
      }));
    });
    request.on("error", reject);
    request.end();
  });
}
