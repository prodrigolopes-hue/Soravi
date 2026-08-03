import { Role } from "../../../generated/prisma/client";

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  roles: Role[];
}