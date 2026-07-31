import { UserResponseDto } from "../../users/dto/user-response.dto";

export class LoginResponseDto {
  readonly data: UserResponseDto;

  constructor(user: UserResponseDto) {
    this.data = user;
  }
}