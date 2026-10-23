import { Logger } from "@nestjs/common";

import { StorageService } from "../../storage/storage.service";
import {
  PROFESSIONAL_PROFILE_PHOTO_READ_URL_TTL_SECONDS,
  ProfessionalProfilePhotoReadService,
} from "./professional-profile-photo-read.service";

describe("ProfessionalProfilePhotoReadService", () => {
  let storageMock: { createTemporaryReadUrl: jest.Mock };
  let service: ProfessionalProfilePhotoReadService;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    storageMock = { createTemporaryReadUrl: jest.fn() };
    service = new ProfessionalProfilePhotoReadService(
      storageMock as unknown as StorageService,
    );
    loggerErrorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retorna null sem foto sem chamar o assinador", async () => {
    await expect(service.createTemporaryReadUrl(undefined)).resolves.toBeNull();
    expect(storageMock.createTemporaryReadUrl).not.toHaveBeenCalled();
  });

  it("retorna URL temporária com expiração de quinze minutos", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
    storageMock.createTemporaryReadUrl.mockResolvedValue("https://storage.example/signed");

    await expect(service.createTemporaryReadUrl("private-object-key")).resolves.toEqual({
      url: "https://storage.example/signed",
      expiresAt: "2026-10-23T12:15:00.000Z",
    });
    expect(storageMock.createTemporaryReadUrl).toHaveBeenCalledWith(
      "private-object-key",
      PROFESSIONAL_PROFILE_PHOTO_READ_URL_TTL_SECONDS,
    );
    jest.useRealTimers();
  });

  it("preserva resposta nula quando a assinatura falha", async () => {
    storageMock.createTemporaryReadUrl.mockRejectedValue(new Error("storage unavailable"));

    await expect(service.createTemporaryReadUrl("private-object-key")).resolves.toBeNull();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha sanitizada ao assinar URL temporária de foto profissional.",
    );
  });
});
