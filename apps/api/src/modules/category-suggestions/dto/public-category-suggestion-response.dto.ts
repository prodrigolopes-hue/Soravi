export class PublicCategorySuggestionResponseDto {
  data: {
    registered: true;
    message: string;
  };

  constructor() {
    this.data = {
      registered: true,
      message: "Sua sugestão de categoria foi registrada para análise da Soravi.",
    };
  }
}
