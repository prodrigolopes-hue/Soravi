import { Prisma } from "../../generated/prisma/client";
import { revokeAllUserSessions } from "./auth-session-revocation";

describe("revokeAllUserSessions", () => {
  it("revoga somente sessoes nao revogadas do usuario usando a transacao recebida", async () => {
    const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
    const revokedAt = new Date("2026-09-10T12:00:00.000Z");
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const transaction = {
      authSession: { updateMany },
    } as unknown as Prisma.TransactionClient;

    await expect(
      revokeAllUserSessions(transaction, userId, revokedAt),
    ).resolves.toEqual({ count: 2 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  });
});
