import {
  createParamDecorator,
  ExecutionContext,
} from "@nestjs/common";
import { Request } from "express";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedUser => {
    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error(
        "O usuário autenticado não está disponível na requisição.",
      );
    }

    return request.user;
  },
);