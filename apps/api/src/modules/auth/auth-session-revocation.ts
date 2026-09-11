import { Prisma } from "../../generated/prisma/client";

export function revokeAllUserSessions(
  transaction: Prisma.TransactionClient,
  userId: string,
  revokedAt: Date,
): Promise<Prisma.BatchPayload> {
  return transaction.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt },
  });
}
