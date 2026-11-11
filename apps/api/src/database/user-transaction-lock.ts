import { Prisma } from "../generated/prisma/client";

export async function lockUser(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE
  `);
}

/** Serializa, na mesma transação, regras entre a conta e suas categorias. */
export async function lockUserCategoryProtection(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await lockUser(transaction, userId);
}
