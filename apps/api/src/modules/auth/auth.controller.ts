import {
  Body,
  Controller,
  Post,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { LoginResponseDto } from "./dto/login-response.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { RegisterResponseDto } from "./dto/register-response.dto";
import { RegisterUserDto } from "./dto/register-user.dto";

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

  @Post("login")
  login(
    @Body() input: LoginUserDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(input);
  }
}