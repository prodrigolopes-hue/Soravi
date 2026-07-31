import {
  Body,
  Controller,
  Post,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { RegisterUserDto } from "./dto/register-user.dto";
import { RegisterResponseDto } from "./dto/register-response.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post("register")
  register(
    @Body() input: RegisterUserDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(input);
  }
}