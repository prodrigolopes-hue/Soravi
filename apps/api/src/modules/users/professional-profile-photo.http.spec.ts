import "reflect-metadata";

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";

import { Role } from "../../generated/prisma/client";
import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PERSONAL_IDENTITY_RECORDING_SERVICE } from "./personal-identity-recording.provider";
import { ProfessionalProfilePhotoProcessingError } from "./professional-profile-photo-image";
import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";
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

describe("Professional profile photo HTTP endpoints", () => {
  let app: INestApplication | undefined;
  const photoService = {
    replaceCurrent: jest.fn(),
    removeCurrent: jest.fn(),
  };

  beforeEach(async () => {
    app = undefined;
    photoService.replaceCurrent.mockResolvedValue({ objectKey: "private-key" });
    photoService.removeCurrent.mockResolvedValue(undefined);
    const accessTokenAuthService = {
      extractBearerToken: (header: string | undefined) =>
        header === "Bearer professional" || header === "Bearer customer"
          ? header.slice("Bearer ".length)
          : null,
      authenticateAccessToken: jest.fn().mockImplementation((token: string) =>
        Promise.resolve({
          id: token === "professional" ? "session-user-id" : "customer-user-id",
          sessionId: "session-id",
          roles: [token === "professional" ? Role.PROFESSIONAL : Role.CUSTOMER],
          phoneVerifiedAt: null,
        }),
      ),
    };

    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: "default", limit: 3, ttl: 3_600_000 }],
        }),
      ],
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: {} },
        { provide: UsersPhoneService, useValue: {} },
        { provide: UsersPasswordService, useValue: {} },
        { provide: UsersAdminStatusService, useValue: {} },
        { provide: ProfessionalVerificationSubmissionService, useValue: {} },
        { provide: ProfessionalVerificationReviewService, useValue: {} },
        { provide: CurrentProfessionalProfileService, useValue: {} },
        { provide: CustomerProfileActivationService, useValue: {} },
        { provide: ProfessionalProfileActivationService, useValue: {} },
        { provide: PersonalIdentityStatusService, useValue: {} },
        { provide: ProfessionalProfilePhotoService, useValue: photoService },
        { provide: PERSONAL_IDENTITY_RECORDING_SERVICE, useValue: {} },
        AccessTokenGuard,
        RolesGuard,
        { provide: AccessTokenAuthService, useValue: accessTokenAuthService },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0, "127.0.0.1");
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
    jest.clearAllMocks();
  });

  it("exige autenticação e papel PROFESSIONAL", async () => {
    const unauthenticated = await fetch(`${await app!.getUrl()}/api/v1/users/me/professional-profile/photo`, {
      method: "DELETE",
    });
    const unauthorizedRole = await fetch(`${await app!.getUrl()}/api/v1/users/me/professional-profile/photo`, {
      method: "DELETE",
      headers: { authorization: "Bearer customer" },
    });

    expect(unauthenticated.status).toBe(401);
    expect(unauthorizedRole.status).toBe(403);
    expect(photoService.removeCurrent).not.toHaveBeenCalled();
  });

  it("envia a foto com o usuário da sessão e não expõe objectKey", async () => {
    const response = await uploadPhoto();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recorded: true });
    expect(photoService.replaceCurrent).toHaveBeenCalledWith(
      "session-user-id",
      expect.objectContaining({ buffer: expect.any(Buffer), declaredMimeType: "image/png" }),
    );
  });

  it("rejeita foto ausente, campo incorreto e campos adicionais", async () => {
    const missing = await fetch(`${await app!.getUrl()}/api/v1/users/me/professional-profile/photo`, {
      method: "PUT",
      headers: { authorization: "Bearer professional" },
    });
    const wrongField = await uploadPhoto("file");
    const additionalField = await uploadPhoto("photo", true);

    expect(missing.status).toBe(400);
    expect(wrongField.status).toBe(400);
    expect(additionalField.status).toBe(400);
    expect(photoService.replaceCurrent).not.toHaveBeenCalled();
  });

  it("rejeita arquivo acima de 5 MiB", async () => {
    const response = await uploadPhoto("photo", false, 5 * 1024 * 1024 + 1);

    expect(response.status).toBe(413);
    expect(photoService.replaceCurrent).not.toHaveBeenCalled();
  });

  it.each([
    ["INVALID_PHOTO", 400, "PROFESSIONAL_PROFILE_PHOTO_INVALID"],
    ["UNSUPPORTED_PHOTO_FORMAT", 400, "PROFESSIONAL_PROFILE_PHOTO_UNSUPPORTED_FORMAT"],
    ["ANIMATED_PHOTO", 400, "PROFESSIONAL_PROFILE_PHOTO_ANIMATED"],
    ["PHOTO_DIMENSIONS_OUT_OF_RANGE", 400, "PROFESSIONAL_PROFILE_PHOTO_DIMENSIONS_OUT_OF_RANGE"],
    ["PHOTO_TOO_LARGE", 413, "PROFESSIONAL_PROFILE_PHOTO_TOO_LARGE"],
  ] as const)("mapeia %s para resposta pública sanitizada", async (code, status, responseCode) => {
    photoService.replaceCurrent.mockRejectedValueOnce(
      new ProfessionalProfilePhotoProcessingError(code),
    );

    const response = await uploadPhoto();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(expect.objectContaining({ code: responseCode }));
  });

  it("remove a foto do usuário da sessão e responde 204", async () => {
    const response = await fetch(`${await app!.getUrl()}/api/v1/users/me/professional-profile/photo`, {
      method: "DELETE",
      headers: { authorization: "Bearer professional" },
    });
    const repeatedResponse = await fetch(`${await app!.getUrl()}/api/v1/users/me/professional-profile/photo`, {
      method: "DELETE",
      headers: { authorization: "Bearer professional" },
    });

    expect(response.status).toBe(204);
    expect(repeatedResponse.status).toBe(204);
    expect(photoService.removeCurrent).toHaveBeenCalledWith("session-user-id");
    expect(photoService.removeCurrent).toHaveBeenCalledTimes(2);
    expect(await response.text()).toBe("");
  });

  it.each([
    ["GET", "/api/v1/users/admin/professional-identity-verifications"],
    ["GET", "/api/v1/users/admin/professional-identity-verifications/525afb87-2b81-4de7-9606-8f382fff3341/evidence"],
    ["POST", "/api/v1/users/admin/professional-identity-verifications/525afb87-2b81-4de7-9606-8f382fff3341/decision"],
  ])("denies %s %s without authentication and to CUSTOMER", async (method, path) => {
    const url = `${await app!.getUrl()}${path}`;
    const anonymous = await fetch(url, { method });
    const customer = await fetch(url, { method, headers: { authorization: "Bearer customer", "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({}) : undefined });
    expect(anonymous.status).toBe(401);
    expect(customer.status).toBe(403);
  });

  async function uploadPhoto(
    fieldName = "photo",
    includeExtraField = false,
    size = 4,
  ): Promise<Response> {
    const body = new FormData();
    body.append(
      fieldName,
      new Blob([new Uint8Array(size)], { type: "image/png" }),
      "photo.png",
    );
    if (includeExtraField) {
      body.append("userId", "other-user-id");
    }

    return fetch(`${await app!.getUrl()}/api/v1/users/me/professional-profile/photo`, {
      method: "PUT",
      headers: { authorization: "Bearer professional" },
      body,
    });
  }
});
