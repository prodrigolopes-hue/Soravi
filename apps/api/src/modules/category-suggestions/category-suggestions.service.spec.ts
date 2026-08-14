import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { PrismaService } from "../../database/prisma.service";
import { PublicCategorySuggestionStatus } from "../../generated/prisma/client";
import { CategorySuggestionsService } from "./category-suggestions.service";
import { CreatePublicCategorySuggestionDto } from "./dto/create-public-category-suggestion.dto";

describe("CategorySuggestionsService", () => {
  let service: CategorySuggestionsService;

  let prismaMock: {
    publicCategorySuggestion: {
      create: jest.Mock;
    };
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
      },
    };

    prismaMock.publicCategorySuggestion.create.mockResolvedValue({});

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
});
