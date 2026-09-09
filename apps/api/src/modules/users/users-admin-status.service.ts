import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma, Role, UserStatus } from "../../generated/prisma/client";
import { UpdateUserAdminStatusDto } from "./dto/update-user-admin-status.dto";
import { AdminSelfStatusChangeForbiddenException } from "./errors/admin-self-status-change-forbidden.exception";
import { AdminTargetStatusChangeForbiddenException } from "./errors/admin-target-status-change-forbidden.exception";
import { UserNotFoundException } from "./errors/user-not-found.exception";
import { UserStatusTransitionNotAllowedException } from "./errors/user-status-transition-not-allowed.exception";

interface LockedUserStatusData {
  id: string;
  status: UserStatus;
  deletedAt: Date | null;
  isAdmin: boolean;
}

const ADMIN_MANAGEABLE_STATUSES: readonly UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.BLOCKED,
];

@Injectable()
export class UsersAdminStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async updateStatus(
    actorUserId: string,
    targetUserId: string,
    input: UpdateUserAdminStatusDto,
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new AdminSelfStatusChangeForbiddenException();
    }

    if (!ADMIN_MANAGEABLE_STATUSES.includes(input.status)) {
      throw new UserStatusTransitionNotAllowedException();
    }

    await this.prisma.$transaction(async (transaction) => {
      const target = await this.lockUser(transaction, targetUserId);

      if (target === null || target.deletedAt !== null) {
        throw new UserNotFoundException();
      }

      if (target.isAdmin) {
        throw new AdminTargetStatusChangeForbiddenException();
      }

      if (!ADMIN_MANAGEABLE_STATUSES.includes(target.status)) {
        throw new UserStatusTransitionNotAllowedException();
      }

      if (target.status !== input.status) {
        await transaction.user.update({
          where: { id: targetUserId },
          data: { status: input.status },
        });
      }

      if (input.status === UserStatus.BLOCKED) {
        const now = new Date();
        await transaction.authSession.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
    });
  }

  private async lockUser(
    transaction: Prisma.TransactionClient,
    targetUserId: string,
  ): Promise<LockedUserStatusData | null> {
    const [user] = await transaction.$queryRaw<LockedUserStatusData[]>(
      Prisma.sql`
        SELECT
          "id",
          "status",
          "deleted_at" AS "deletedAt",
          EXISTS (
            SELECT 1
            FROM "user_roles"
            WHERE "user_id" = "users"."id"
              AND "role" = ${Role.ADMIN}::"Role"
          ) AS "isAdmin"
        FROM "users"
        WHERE "id" = ${targetUserId}::uuid
        FOR UPDATE
      `,
    );

    return user ?? null;
  }
}
