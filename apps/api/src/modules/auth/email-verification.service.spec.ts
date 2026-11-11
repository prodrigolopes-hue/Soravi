import { createHash } from "node:crypto";

import { UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { EmailVerificationInvalidOrExpiredException } from "./errors/email-verification-invalid-or-expired.exception";
import { EmailVerificationService } from "./email-verification.service";

describe("EmailVerificationService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const tokenId = "625afb87-2b81-4de7-9606-8f382fff3341";
  const email = "maria@example.com";
  const deliveryPort = { sendVerification: jest.fn() };
  let queryRaw: jest.Mock;
  let transactionMock: Record<string, unknown>;
  let prisma: Record<string, unknown>;
  let service: EmailVerificationService;

  beforeEach(() => {
    queryRaw = jest.fn();
    transactionMock = {
      $queryRaw: queryRaw,
      emailVerificationToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: tokenId }),
        update: jest.fn().mockResolvedValue({ id: tokenId }),
      },
      user: { update: jest.fn().mockResolvedValue({ id: userId }) },
    };
    prisma = {
      user: { findUnique: jest.fn() },
      emailVerificationToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: typeof transactionMock) => unknown) => callback(transactionMock)),
    };
    deliveryPort.sendVerification.mockReset();
    service = new EmailVerificationService(
      prisma as unknown as PrismaService,
      deliveryPort,
    );
  });

  it("does not disclose whether a requested email exists", async () => {
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.requestVerification(email)).resolves.toBeUndefined();
    expect(deliveryPort.sendVerification).not.toHaveBeenCalled();
  });

  it("stores only a hash and delivers a 24 hour single-use token", async () => {
    queryRaw.mockResolvedValueOnce([lockedUser()]);

    await service.sendForRegisteredUser(userId);

    const sent = deliveryPort.sendVerification.mock.calls[0][0] as {
      rawToken: string;
      expiresAt: Date;
    };
    expect(sent.rawToken).toHaveLength(43);
    expect(sent.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const transaction = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(transaction).toBeDefined();
  });

  it("consumes the token and confirms the email exactly once", async () => {
    const rawToken = "a".repeat(43);
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    (prisma.emailVerificationToken as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: tokenId, userId });
    queryRaw.mockResolvedValueOnce([lockedUser()]).mockResolvedValueOnce([
      { id: tokenId, userId, tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: null },
    ]);

    await expect(service.confirm(rawToken)).resolves.toBe(userId);
    const transaction = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(transaction).toBeDefined();
  });

  it("rejects expired or reused tokens with one neutral error", async () => {
    const rawToken = "b".repeat(43);
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    (prisma.emailVerificationToken as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: tokenId, userId });
    queryRaw.mockResolvedValueOnce([lockedUser()]).mockResolvedValueOnce([
      { id: tokenId, userId, tokenHash, expiresAt: new Date(Date.now() - 1), usedAt: null },
    ]);

    await expect(service.confirm(rawToken)).rejects.toBeInstanceOf(
      EmailVerificationInvalidOrExpiredException,
    );
  });

  it("allows only one concurrent confirmation to consume a token", async () => {
    const rawToken = "c".repeat(43);
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    let emailVerifiedAt: Date | null = null;
    let usedAt: Date | null = null;
    (prisma.emailVerificationToken as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: tokenId, userId });
    queryRaw.mockImplementation((query: { strings: readonly string[] }) => {
      const sql = query.strings.join(" ");
      return Promise.resolve(
        sql.includes('FROM "users"')
          ? [lockedUser({ emailVerifiedAt })]
          : [{ id: tokenId, userId, tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt }],
      );
    });
    ((transactionMock.user as { update: jest.Mock }).update).mockImplementation(
      ({ data }: { data: { emailVerifiedAt: Date } }) => {
        emailVerifiedAt = data.emailVerifiedAt;
        return Promise.resolve({ id: userId });
      },
    );
    ((transactionMock.emailVerificationToken as { update: jest.Mock }).update).mockImplementation(
      ({ data }: { data: { usedAt: Date } }) => {
        usedAt = data.usedAt;
        return Promise.resolve({ id: tokenId });
      },
    );
    let queue = Promise.resolve();
    (prisma.$transaction as jest.Mock).mockImplementation(
      <T>(callback: (tx: typeof transactionMock) => Promise<T>) => {
        const result = queue.then(() => callback(transactionMock));
        queue = result.then(() => undefined, () => undefined);
        return result;
      },
    );

    const results = await Promise.allSettled([
      service.confirm(rawToken),
      service.confirm(rawToken),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((transactionMock.user as { update: jest.Mock }).update).toHaveBeenCalledTimes(1);
  });

  function lockedUser(overrides: Record<string, unknown> = {}) {
    return {
      id: userId,
      email,
      status: UserStatus.PENDING,
      deletedAt: null,
      emailVerifiedAt: null,
      ...overrides,
    };
  }
});
