import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";

import { Role } from "../../generated/prisma/client";
import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentProfessionalProfileService } from "./current-professional-profile.service";
import { CustomerProfileActivationService } from "./customer-profile-activation.service";
import { PERSONAL_IDENTITY_RECORDING_SERVICE } from "./personal-identity-recording.provider";
import { PersonalIdentityStatusService } from "./personal-identity-status.service";
import { ProfessionalIdentityReviewService } from "./professional-identity-review.service";
import { ProfessionalIdentityVerificationStatusService } from "./professional-identity-verification-status.service";
import { ProfessionalProfileActivationService } from "./professional-profile-activation.service";
import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";
import { ProfessionalVerificationReviewService } from "./professional-verification-review.service";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";
import { UsersAdminStatusService } from "./users-admin-status.service";
import { UsersController } from "./users.controller";
import { UsersPasswordService } from "./users-password.service";
import { UsersPhoneService } from "./users-phone.service";
import { UsersService } from "./users.service";

describe("administrative identity review HTTP endpoints", () => {
  const attemptId = "a9f1d53e-60d0-4f56-af8f-7809e7e1cc93";
  const reviewService = { details: jest.fn(), revealCpf: jest.fn() };
  let app: Awaited<ReturnType<typeof createApp>> | undefined;

  beforeAll(async () => { app = await createApp(reviewService); });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["GET", `/api/v1/users/admin/professional-identity-verifications/${attemptId}/details`],
    ["POST", `/api/v1/users/admin/professional-identity-verifications/${attemptId}/cpf-reveal`],
  ])("returns 401 without authentication for %s %s", async (method, path) => {
    const response = await request(app!.url, method, path);
    expect(response.status).toBe(401);
    expect(reviewService.details).not.toHaveBeenCalled();
    expect(reviewService.revealCpf).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", `/api/v1/users/admin/professional-identity-verifications/${attemptId}/details`],
    ["POST", `/api/v1/users/admin/professional-identity-verifications/${attemptId}/cpf-reveal`],
  ])("returns 403 to a non-admin for %s %s", async (method, path) => {
    const response = await request(app!.url, method, path, "customer-token");
    expect(response.status).toBe(403);
    expect(reviewService.details).not.toHaveBeenCalled();
    expect(reviewService.revealCpf).not.toHaveBeenCalled();
  });

  it("returns the explicit no-store directive when an admin reveals a CPF", async () => {
    reviewService.revealCpf.mockResolvedValue({ cpf: "52998224725" });

    const response = await request(app!.url, "POST", `/api/v1/users/admin/professional-identity-verifications/${attemptId}/cpf-reveal`, "admin-token");

    expect(response.status).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(reviewService.revealCpf).toHaveBeenCalledWith("admin-user-id", attemptId);
  });
});

async function createApp(reviewService: { details: jest.Mock; revealCpf: jest.Mock }) {
  const accessTokenAuthService = {
    extractBearerToken: (header: string | undefined) => header?.replace("Bearer ", "") ?? null,
    authenticateAccessToken: jest.fn(async (token: string) => ({
      id: token === "admin-token" ? "admin-user-id" : "customer-user-id",
      sessionId: "session-id",
      roles: token === "admin-token" ? [Role.ADMIN] : [Role.CUSTOMER],
      phoneVerifiedAt: null,
    })),
  };
  const empty = {};
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot({ throttlers: [{ name: "default", limit: 100, ttl: 60_000 }] })],
    controllers: [UsersController],
    providers: [
      { provide: UsersService, useValue: empty }, { provide: UsersPhoneService, useValue: empty },
      { provide: UsersPasswordService, useValue: empty }, { provide: UsersAdminStatusService, useValue: empty },
      { provide: ProfessionalVerificationSubmissionService, useValue: empty }, { provide: ProfessionalVerificationReviewService, useValue: empty },
      { provide: CurrentProfessionalProfileService, useValue: empty }, { provide: CustomerProfileActivationService, useValue: empty },
      { provide: ProfessionalProfileActivationService, useValue: empty }, { provide: PersonalIdentityStatusService, useValue: empty },
      { provide: ProfessionalProfilePhotoService, useValue: empty }, { provide: PERSONAL_IDENTITY_RECORDING_SERVICE, useValue: undefined },
      { provide: ProfessionalIdentityVerificationStatusService, useValue: empty },
      { provide: ProfessionalIdentityReviewService, useValue: reviewService },
      AccessTokenGuard, RolesGuard, { provide: AccessTokenAuthService, useValue: accessTokenAuthService },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as AddressInfo;
  return Object.assign(app, { url: `http://127.0.0.1:${address.port}` });
}

function request(url: string, method: string, path: string, token?: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(`${url}${path}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} }, (response) => {
      response.resume();
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}
