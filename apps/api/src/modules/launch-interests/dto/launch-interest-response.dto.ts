export class LaunchInterestRegistrationResponseDto {
  data: {
    registered: true;
    message: string;
  };

  constructor() {
    this.data = {
      registered: true,
      message: "Seu interesse no lançamento da Soravi foi registrado.",
    };
  }
}
