import { Role, UserStatus } from "../../generated/prisma/client";
import { tryAutoActivatePendingCustomer } from "./customer-account-auto-activation";

describe("tryAutoActivatePendingCustomer", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";

  it("promotes only an eligible pending customer once", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await expect(tryAutoActivatePendingCustomer({ user: { updateMany } } as never, userId)).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: UserStatus.PENDING, roles: { some: { role: Role.CUSTOMER } }, emailVerifiedAt: { not: null }, phoneVerifiedAt: { not: null }, deletedAt: null }),
      data: { status: UserStatus.ACTIVE },
    }));
  });

  it("does not promote protected states, non-customers, incomplete profiles, or a concurrent winner", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(tryAutoActivatePendingCustomer({ user: { updateMany } } as never, userId)).resolves.toBe(false);
  });

  it("allows only one winner when email and phone confirmation reach activation concurrently", async () => {
    let attempts = 0;
    const updateMany = jest.fn().mockImplementation(() =>
      Promise.resolve({ count: ++attempts === 1 ? 1 : 0 }),
    );
    const transaction = { user: { updateMany } } as never;

    const results = await Promise.all([
      tryAutoActivatePendingCustomer(transaction, userId),
      tryAutoActivatePendingCustomer(transaction, userId),
    ]);

    expect(results).toEqual(expect.arrayContaining([true, false]));
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});
