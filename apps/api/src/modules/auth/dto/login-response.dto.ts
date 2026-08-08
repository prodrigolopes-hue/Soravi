import { UserResponseDto } from "../../users/dto/user-response.dto";

interface LoginResponseData {
  user: UserResponseDto;
  accessToken: string;
  accessTokenExpiresIn: number;
}

export class LoginResponseDto {
  readonly data: LoginResponseData;

  constructor(data: LoginResponseData) {
    this.data = data;
  }
}