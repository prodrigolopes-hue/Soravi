import { Prisma, Role, UserStatus } from "../../generated/prisma/client";

/** Activates only a currently pending account that is already a complete customer. */
export async function tryAutoActivatePendingCustomer(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<boolean> {
  const result = await transaction.user.updateMany({
    where: {
      id: userId,
      status: UserStatus.PENDING,
      deletedAt: null,
      emailVerifiedAt: { not: null },
      phoneVerifiedAt: { not: null },
      roles: { some: { role: Role.CUSTOMER } },
      customerProfile: { is: {} },
    },
    data: { status: UserStatus.ACTIVE },
  });

  return result.count === 1;
}
