import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";

import { Role } from "../../../generated/prisma/client";
import { InsufficientPermissionsException } from "../errors/insufficient-permissions.exception";
import { PhoneVerificationRequiredException } from "../errors/phone-verification-required.exception";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class PhoneVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const currentUser = request.user;

    if (!currentUser) {
      throw new InsufficientPermissionsException();
    }

    // ADMIN fica temporariamente fora desta exigencia no MVP.
    if (
      currentUser.roles.includes(Role.ADMIN) ||
      currentUser.phoneVerifiedAt !== null
    ) {
      return true;
    }

    throw new PhoneVerificationRequiredException();
  }
}
