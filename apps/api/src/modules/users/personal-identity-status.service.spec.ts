import { PrismaService } from "../../database/prisma.service";
import { UserNotFoundException } from "./errors/user-not-found.exception";
import { PersonalIdentityStatusService } from "./personal-identity-status.service";

describe("PersonalIdentityStatusService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const findFirst = jest.fn();
  const service = new PersonalIdentityStatusService({
    user: { findFirst },
  } as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it("returns false without loading protected identity fields", async () => {
    findFirst.mockResolvedValue({ personalIdentity: null });

    await expect(service.findCurrent(userId)).resolves.toEqual({ recorded: false });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: userId, deletedAt: null },
      select: { personalIdentity: { select: { id: true } } },
    });
  });

  it("returns true when the current account has an identity", async () => {
    findFirst.mockResolvedValue({ personalIdentity: { id: "identity-id" } });

    await expect(service.findCurrent(userId)).resolves.toEqual({ recorded: true });
  });

  it("uses the existing unavailable-account behavior", async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findCurrent(userId)).rejects.toBeInstanceOf(
      UserNotFoundException,
    );
  });
});
