import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { LoginResponseDto } from "./dto/login-response.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
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
  @HttpCode(HttpStatus.OK)
  login(
    @Body() input: LoginUserDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(input);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() input: RefreshTokenDto,
  ): Promise<RefreshResponseDto> {
    return this.authService.refresh(input);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(
    @Body() input: RefreshTokenDto,
  ): Promise<void> {
    return this.authService.logout(input);
  }
}