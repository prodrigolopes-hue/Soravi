interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export class RefreshResponseDto {
  readonly data: RefreshResponseData;

  constructor(data: RefreshResponseData) {
    this.data = data;
  }
}