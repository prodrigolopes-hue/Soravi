import { IsIn } from "class-validator";

import { UserStatus } from "../../../generated/prisma/client";

export const ADMIN_USER_STATUSES = [
  UserStatus.ACTIVE,
  UserStatus.BLOCKED,
] as const;

export class UpdateUserAdminStatusDto {
  @IsIn(ADMIN_USER_STATUSES, {
    message: "O status deve ser ACTIVE ou BLOCKED.",
  })
  status!: (typeof ADMIN_USER_STATUSES)[number];
}
