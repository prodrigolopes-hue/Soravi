import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";
import { Role } from "../../generated/prisma/client";
import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UsersPhoneService } from "./users-phone.service";
import { UsersPasswordService } from "./users-password.service";
import { UsersAdminStatusService } from "./users-admin-status.service";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";
import { ProfessionalVerificationReviewService } from "./professional-verification-review.service";
import { CurrentProfessionalProfileService } from "./current-professional-profile.service";
import { CustomerProfileActivationService } from "./customer-profile-activation.service";
import { ProfessionalProfileActivationService } from "./professional-profile-activation.service";
import { PersonalIdentityStatusService } from "./personal-identity-status.service";
import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";
import { ProfessionalPortfolioService } from "./professional-portfolio.service";
import { PERSONAL_IDENTITY_RECORDING_SERVICE } from "./personal-identity-recording.provider";
import { ProfessionalIdentityVerificationStatusService } from "./professional-identity-verification-status.service";

describe("portfolio moderation HTTP authorization", () => {
  const portfolio = { listPending: jest.fn(), privateEvidence: jest.fn(), history: jest.fn(), decide: jest.fn() };
  let app: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => { app = await createApp(portfolio); }); afterAll(async () => { await app.close(); }); beforeEach(() => jest.clearAllMocks());
  it.each(["/api/v1/users/admin/professional-portfolios", "/api/v1/users/admin/professional-portfolios/525afb87-2b81-4de7-9606-8f382fff3341/evidence"])('returns 401 without authentication for %s', async (path) => { expect(await request(app.url, path)).toBe(401); expect(portfolio.listPending).not.toHaveBeenCalled(); expect(portfolio.privateEvidence).not.toHaveBeenCalled(); });
  it.each(["/api/v1/users/admin/professional-portfolios", "/api/v1/users/admin/professional-portfolios/525afb87-2b81-4de7-9606-8f382fff3341/history"])('returns 403 for a non-admin for %s', async (path) => { expect(await request(app.url, path, "customer")).toBe(403); expect(portfolio.listPending).not.toHaveBeenCalled(); expect(portfolio.history).not.toHaveBeenCalled(); });
});
async function createApp(portfolio: { listPending: jest.Mock; privateEvidence: jest.Mock; history: jest.Mock; decide: jest.Mock }) { const empty = {}; const auth = { extractBearerToken: (value?: string) => value?.replace("Bearer ", "") ?? null, authenticateAccessToken: jest.fn(async (token: string) => ({ id: "user", sessionId: "session", roles: token === "admin" ? [Role.ADMIN] : [Role.CUSTOMER], phoneVerifiedAt: null })) }; const module = await Test.createTestingModule({ imports: [ThrottlerModule.forRoot({ throttlers: [{ name: "default", limit: 100, ttl: 60000 }] })], controllers: [UsersController], providers: [{ provide: UsersService, useValue: empty }, { provide: UsersPhoneService, useValue: empty }, { provide: UsersPasswordService, useValue: empty }, { provide: UsersAdminStatusService, useValue: empty }, { provide: ProfessionalVerificationSubmissionService, useValue: empty }, { provide: ProfessionalVerificationReviewService, useValue: empty }, { provide: CurrentProfessionalProfileService, useValue: empty }, { provide: CustomerProfileActivationService, useValue: empty }, { provide: ProfessionalProfileActivationService, useValue: empty }, { provide: PersonalIdentityStatusService, useValue: empty }, { provide: ProfessionalProfilePhotoService, useValue: empty }, { provide: ProfessionalPortfolioService, useValue: portfolio }, { provide: PERSONAL_IDENTITY_RECORDING_SERVICE, useValue: undefined }, { provide: ProfessionalIdentityVerificationStatusService, useValue: empty }, AccessTokenGuard, RolesGuard, { provide: AccessTokenAuthService, useValue: auth }] }).compile(); const app = module.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.listen(0, "127.0.0.1"); const address = app.getHttpServer().address() as AddressInfo; return Object.assign(app, { url: `http://127.0.0.1:${address.port}` }); }
function request(url: string, path: string, token?: string): Promise<number> { return new Promise((resolve, reject) => { const req = httpRequest(`${url}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }, (response) => { response.resume(); response.on("end", () => resolve(response.statusCode ?? 0)); }); req.on("error", reject); req.end(); }); }
