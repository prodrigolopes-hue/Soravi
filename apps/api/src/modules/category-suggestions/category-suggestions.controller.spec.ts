import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CategorySuggestionsController } from "./category-suggestions.controller";
import { CategorySuggestionsService } from "./category-suggestions.service";
import { CreatePublicCategorySuggestionDto } from "./dto/create-public-category-suggestion.dto";
import { ModeratePublicCategorySuggestionDto } from "./dto/moderate-public-category-suggestion.dto";
import { PublicCategorySuggestionAdminResponseDto } from "./dto/public-category-suggestion-admin-response.dto";
import { PublicCategorySuggestionsAdminListResponseDto } from "./dto/public-category-suggestions-admin-list-response.dto";
import { PublicCategorySuggestionsAdminQueryDto } from "./dto/public-category-suggestions-admin-query.dto";
import { PublicCategorySuggestionResponseDto } from "./dto/public-category-suggestion-response.dto";
import { ThrottlerGuard } from "@nestjs/throttler";

describe("CategorySuggestionsController", () => {
  let controller: CategorySuggestionsController;
  let serviceMock: {
    createPublicSuggestion: jest.Mock;
    findAllAdminSuggestions: jest.Mock;
    moderateSuggestion: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      createPublicSuggestion: jest.fn(),
      findAllAdminSuggestions: jest.fn(),
      moderateSuggestion: jest.fn(),
    };

    controller = new CategorySuggestionsController(
      serviceMock as unknown as CategorySuggestionsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha o DTO para o service", async () => {
    const input: CreatePublicCategorySuggestionDto = {
      name: "Maria da Silva",
      email: "maria@exemplo.com",
      phone: "+55 11 99999-9999",
      suggestedName: "Técnico em aquecedor",
      description: "Atendimento residencial",
      privacyNoticeAccepted: true,
    };

    const response = new PublicCategorySuggestionResponseDto();
    serviceMock.createPublicSuggestion.mockResolvedValue(response);

    const result = await controller.create(input);

    expect(serviceMock.createPublicSuggestion).toHaveBeenCalledWith(input);
    expect(result).toEqual(response);
  });

  it("mantém o endpoint funcionando normalmente fora do limite", async () => {
    const input: CreatePublicCategorySuggestionDto = {
      name: "Maria da Silva",
      email: "maria@exemplo.com",
      phone: "+55 11 99999-9999",
      suggestedName: "Técnico em aquecedor",
      description: "Atendimento residencial",
      privacyNoticeAccepted: true,
    };

    const response = new PublicCategorySuggestionResponseDto();
    serviceMock.createPublicSuggestion.mockResolvedValue(response);

    const result = await controller.create(input);

    expect(result).toEqual(response);
  });

  it("configura throttling apenas na rota pública", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      CategorySuggestionsController.prototype.create,
    );

    expect(guards).toEqual([ThrottlerGuard]);

    const metadataKeys = Reflect.getMetadataKeys(
      CategorySuggestionsController.prototype.create,
    );

    expect(
      metadataKeys.some((key) =>
        String(key).toLowerCase().includes("throttler"),
      ),
    ).toBe(true);
  });

  it("encaminha listagem administrativa ao service", async () => {
    const query = new PublicCategorySuggestionsAdminQueryDto();
    const response = new PublicCategorySuggestionsAdminListResponseDto(
      [
        {
          id: "suggestion-id",
          suggestedName: "Encanador",
          description: "Atendimento 24h",
          status: "PENDING",
          createdAt: new Date("2026-08-10T10:00:00.000Z"),
          name: "João",
          email: "joao@exemplo.com",
          phone: null,
          reviewNotes: null,
          reviewedAt: null,
        },
      ],
      1,
      20,
      1,
    );

    serviceMock.findAllAdminSuggestions.mockResolvedValue(response);

    const result = await controller.findAdminSuggestions(query);

    expect(serviceMock.findAllAdminSuggestions).toHaveBeenCalledWith(query);
    expect(result).toEqual(response);
  });

  it("encaminha moderação administrativa ao service", async () => {
    const currentUser = {
      id: "admin-id",
      sessionId: "session-id",
      roles: [Role.ADMIN],
    };

    const input: ModeratePublicCategorySuggestionDto = {
      status: "APPROVED",
      reviewNotes: "Categoria válida para catálogo futuro.",
    };

    const response = new PublicCategorySuggestionAdminResponseDto({
      id: "suggestion-id",
      suggestedName: "Encanador",
      description: "Atendimento 24h",
      status: "APPROVED",
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
      name: "João",
      email: "joao@exemplo.com",
      phone: null,
      reviewNotes: "Categoria válida para catálogo futuro.",
      reviewedAt: new Date("2026-08-11T10:00:00.000Z"),
    });

    serviceMock.moderateSuggestion.mockResolvedValue(response);

    const result = await controller.moderateSuggestion(
      "suggestion-id",
      currentUser,
      input,
    );

    expect(serviceMock.moderateSuggestion).toHaveBeenCalledWith(
      "suggestion-id",
      currentUser.id,
      input,
    );
    expect(result).toEqual(response);
  });

  it("exige autenticação para listagem administrativa", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      CategorySuggestionsController.prototype.findAdminSuggestions,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
  });

  it("exige role ADMIN para listagem administrativa", () => {
    const roles = Reflect.getMetadata(
      "roles",
      CategorySuggestionsController.prototype.findAdminSuggestions,
    );

    expect(roles).toEqual([Role.ADMIN]);
  });

  it("exige autenticação para moderação administrativa", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      CategorySuggestionsController.prototype.moderateSuggestion,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
  });

  it("exige role ADMIN para moderação administrativa", () => {
    const roles = Reflect.getMetadata(
      "roles",
      CategorySuggestionsController.prototype.moderateSuggestion,
    );

    expect(roles).toEqual([Role.ADMIN]);
  });
});
