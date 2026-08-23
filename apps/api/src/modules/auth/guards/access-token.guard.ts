import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";

import { AccessTokenAuthService } from "../access-token-auth.service";
import { InvalidAccessTokenException } from "../errors/invalid-access-token.exception";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly accessTokenAuthService: AccessTokenAuthService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const accessToken = this.accessTokenAuthService.extractBearerToken(
      request.headers.authorization,
    );

    if (!accessToken) {
      throw new InvalidAccessTokenException();
    }

    request.user = await this.accessTokenAuthService.authenticateAccessToken(
      accessToken,
    );

    return true;
  }

}