import { CategorySuggestionsController } from "./category-suggestions.controller";
import { CategorySuggestionsService } from "./category-suggestions.service";
import { CreatePublicCategorySuggestionDto } from "./dto/create-public-category-suggestion.dto";
import { PublicCategorySuggestionResponseDto } from "./dto/public-category-suggestion-response.dto";
import { ThrottlerGuard } from "@nestjs/throttler";

describe("CategorySuggestionsController", () => {
  let controller: CategorySuggestionsController;
  let serviceMock: {
    createPublicSuggestion: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      createPublicSuggestion: jest.fn(),
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
});
