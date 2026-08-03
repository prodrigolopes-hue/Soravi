import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { Role } from "../../../generated/prisma/client";
import {
  ROLES_KEY,
} from "../decorators/roles.decorator";
import { InsufficientPermissionsException } from "../errors/insufficient-permissions.exception";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (
      !requiredRoles ||
      requiredRoles.length === 0
    ) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const currentUser = request.user;

    if (!currentUser) {
      throw new InsufficientPermissionsException();
    }

    const hasRequiredRole =
      requiredRoles.some((requiredRole) =>
        currentUser.roles.includes(requiredRole),
      );

    if (!hasRequiredRole) {
      throw new InsufficientPermissionsException();
    }

    return true;
  }
}