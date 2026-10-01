import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PublicCategorySuggestionNotFoundException } from "./errors/public-category-suggestion-not-found.exception";
import { PublicCategorySuggestionNotPendingException } from "./errors/public-category-suggestion-not-pending.exception";

import { PrismaService } from "../../database/prisma.service";
import { PublicCategorySuggestionStatus } from "../../generated/prisma/client";
import { CategorySuggestionsService } from "./category-suggestions.service";
import { CreatePublicCategorySuggestionDto } from "./dto/create-public-category-suggestion.dto";
import { PublicCategorySuggestionsAdminQueryDto } from "./dto/public-category-suggestions-admin-query.dto";

describe("CategorySuggestionsService", () => {
  let service: CategorySuggestionsService;

  let prismaMock: {
    publicCategorySuggestion: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const baseInput: CreatePublicCategorySuggestionDto = {
    name: " Maria da Silva ",
    email: " maria@exemplo.com ",
    phone: "+55 11 99999-9999",
    suggestedName: " Técnico em aquecedor ",
    description: " Atendimento residencial ",
    privacyNoticeAccepted: true,
  };

  beforeEach(() => {
    prismaMock = {
      publicCategorySuggestion: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prismaMock.publicCategorySuggestion.create.mockResolvedValue({});
    prismaMock.publicCategorySuggestion.count.mockResolvedValue(1);
    prismaMock.publicCategorySuggestion.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[]));

    service = new CategorySuggestionsService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("cria sugestão pública válida", async () => {
    const response = await service.createPublicSuggestion(baseInput);

    expect(prismaMock.publicCategorySuggestion.create).toHaveBeenCalledWith({
      data: {
        name: "Maria da Silva",
        email: "maria@exemplo.com",
        phone: "+55 11 99999-9999",
        suggestedName: "Técnico em aquecedor",
        description: "Atendimento residencial",
        status: PublicCategorySuggestionStatus.PENDING,
        privacyNoticeAcceptedAt: expect.any(Date),
      },
    });

    expect(response).toEqual({
      data: {
        registered: true,
        message: "Sua sugestão de categoria foi registrada para análise da Soravi.",
      },
    });
  });

  it("rejeita privacyNoticeAccepted=false", async () => {
    const instance = plainToInstance(
      CreatePublicCategorySuggestionDto,
      {
        ...baseInput,
        privacyNoticeAccepted: false,
      },
    );

    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toEqual(
      expect.objectContaining({
        equals: "O aviso de privacidade deve ser aceito.",
      }),
    );
  });

  it("rejeita suggestedName vazio", async () => {
    const instance = plainToInstance(
      CreatePublicCategorySuggestionDto,
      {
        ...baseInput,
        suggestedName: " ",
      },
    );

    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toEqual(
      expect.objectContaining({
        minLength: "O nome sugerido deve possuir pelo menos 2 caracteres.",
      }),
    );
  });

  it("rejeita email inválido", async () => {
    const instance = plainToInstance(
      CreatePublicCategorySuggestionDto,
      {
        ...baseInput,
        email: "email-invalido",
      },
    );

    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toEqual(
      expect.objectContaining({
        isEmail: "Informe um e-mail válido.",
      }),
    );
  });

  it("lista sugestões públicas no admin com paginação", async () => {
    const query = new PublicCategorySuggestionsAdminQueryDto();
    query.page = 1;
    query.pageSize = 20;

    prismaMock.publicCategorySuggestion.findMany.mockResolvedValue([
      {
        id: "suggestion-id",
        suggestedName: "Encanador",
        description: "Atendimento 24h",
        status: PublicCategorySuggestionStatus.PENDING,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        name: "João",
        email: "joao@exemplo.com",
        phone: null,
        reviewNotes: null,
        reviewedAt: null,
      },
    ]);

    const result = await service.findAllAdminSuggestions(query);

    expect(prismaMock.publicCategorySuggestion.count).toHaveBeenCalledWith({ where: {} });
    expect(prismaMock.publicCategorySuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: {
          createdAt: "desc",
        },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.suggestedName).toBe("Encanador");
  });

  it("modera sugestão pendente com sucesso", async () => {
    prismaMock.publicCategorySuggestion.findUnique
      .mockResolvedValueOnce({
      id: "suggestion-id",
      status: PublicCategorySuggestionStatus.PENDING,
      })
      .mockResolvedValueOnce({

      id: "suggestion-id",
      suggestedName: "Encanador",
      description: "Atendimento 24h",
      status: PublicCategorySuggestionStatus.APPROVED,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
      name: "João",
      email: "joao@exemplo.com",
      phone: null,
      reviewNotes: "Categoria válida",
      reviewedAt: new Date("2026-08-11T10:00:00.000Z"),
      });
    prismaMock.publicCategorySuggestion.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.moderateSuggestion(
      "suggestion-id",
      "admin-id",
      {
        status: PublicCategorySuggestionStatus.APPROVED,
        reviewNotes: "Categoria válida",
      },
    );

    expect(prismaMock.publicCategorySuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "suggestion-id",
          status: PublicCategorySuggestionStatus.PENDING,
        },
        data: expect.objectContaining({
          status: PublicCategorySuggestionStatus.APPROVED,
          reviewNotes: "Categoria válida",
          reviewedByUserId: "admin-id",
          reviewedAt: expect.any(Date),
        }),
      }),
    );

    expect(result.status).toBe(PublicCategorySuggestionStatus.APPROVED);
  });

  it("modera sugestao pendente para REJECTED", async () => {
    prismaMock.publicCategorySuggestion.findUnique
      .mockResolvedValueOnce({
        id: "suggestion-id",
        status: PublicCategorySuggestionStatus.PENDING,
      })
      .mockResolvedValueOnce({
        id: "suggestion-id",
        suggestedName: "Encanador",
        description: "Atendimento 24h",
        status: PublicCategorySuggestionStatus.REJECTED,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        name: "Joao",
        email: "joao@exemplo.com",
        phone: null,
        reviewNotes: "Fora do escopo",
        reviewedAt: new Date("2026-08-11T10:00:00.000Z"),
      });
    prismaMock.publicCategorySuggestion.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.moderateSuggestion(
      "suggestion-id",
      "admin-id",
      {
        status: PublicCategorySuggestionStatus.REJECTED,
        reviewNotes: "Fora do escopo",
      },
    );

    expect(result.status).toBe(PublicCategorySuggestionStatus.REJECTED);
  });

  it("falha quando sugestão não existe", async () => {
    prismaMock.publicCategorySuggestion.findUnique.mockResolvedValue(null);

    await expect(
      service.moderateSuggestion("missing-id", "admin-id", {
        status: PublicCategorySuggestionStatus.REJECTED,
      }),
    ).rejects.toBeInstanceOf(PublicCategorySuggestionNotFoundException);
  });

  it("falha quando sugestão já foi moderada", async () => {
    prismaMock.publicCategorySuggestion.findUnique.mockResolvedValue({
      id: "suggestion-id",
      status: PublicCategorySuggestionStatus.APPROVED,
    });

    await expect(
      service.moderateSuggestion("suggestion-id", "admin-id", {
        status: PublicCategorySuggestionStatus.REJECTED,
      }),
    ).rejects.toBeInstanceOf(PublicCategorySuggestionNotPendingException);

    expect(prismaMock.publicCategorySuggestion.updateMany).not.toHaveBeenCalled();
  });

  it("falha quando a atualizacao condicional perde a concorrencia", async () => {
    const persistedSuggestion = {
      status: PublicCategorySuggestionStatus.APPROVED,
      reviewNotes: "Categoria valida",
    };

    prismaMock.publicCategorySuggestion.findUnique.mockResolvedValue({
      id: "suggestion-id",
      status: PublicCategorySuggestionStatus.PENDING,
    });
    prismaMock.publicCategorySuggestion.updateMany.mockImplementation(
      async ({
        where,
      }: {
        where: { status: PublicCategorySuggestionStatus };
      }) => ({
        count:
          persistedSuggestion.status === where.status
            ? 1
            : 0,
      }),
    );

    await expect(
      service.moderateSuggestion("suggestion-id", "second-admin-id", {
        status: PublicCategorySuggestionStatus.REJECTED,
        reviewNotes: "Segunda decisao",
      }),
    ).rejects.toBeInstanceOf(PublicCategorySuggestionNotPendingException);

    expect(persistedSuggestion).toEqual({
      status: PublicCategorySuggestionStatus.APPROVED,
      reviewNotes: "Categoria valida",
    });
    expect(prismaMock.publicCategorySuggestion.findUnique).toHaveBeenCalledTimes(1);
  });
});
