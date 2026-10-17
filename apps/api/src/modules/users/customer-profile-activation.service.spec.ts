import { Role, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CustomerProfileActivationUnavailableException } from "./errors/customer-profile-activation-unavailable.exception";
import { CustomerProfileActivationService } from "./customer-profile-activation.service";
import { UsersService } from "./users.service";

describe("CustomerProfileActivationService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  let service: CustomerProfileActivationService;
  let transaction: any;
  let prisma: any;
  let usersService: { findSafeById: jest.Mock };

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: userId }]),
      user: { findFirst: jest.fn().mockResolvedValue({ id: userId }) },
      customerProfile: { upsert: jest.fn().mockResolvedValue({ id: "customer-profile-id" }) },
      userRole: { upsert: jest.fn().mockResolvedValue({ id: "customer-role-id" }) },
    };
    prisma = { $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
    usersService = { findSafeById: jest.fn().mockResolvedValue({ id: userId, roles: [Role.PROFESSIONAL, Role.CUSTOMER] }) };
    service = new CustomerProfileActivationService(prisma as PrismaService, usersService as unknown as UsersService);
  });

  it.each([UserStatus.PENDING, UserStatus.ACTIVE])("creates the customer profile and role for an eligible %s account", async () => {
    await expect(service.activateCurrentProfessional(userId)).resolves.toMatchObject({ id: userId });

    expect(transaction.$queryRaw).toHaveBeenCalled();
    expect(transaction.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] },
        deletedAt: null,
        roles: { some: { role: Role.PROFESSIONAL } },
        professionalProfile: { is: { deletedAt: null } },
      }),
    }));
    expect(transaction.customerProfile.upsert).toHaveBeenCalledWith({ where: { userId }, update: {}, create: { userId } });
    expect(transaction.userRole.upsert).toHaveBeenCalledWith({
      where: { userId_role: { userId, role: Role.CUSTOMER } }, update: {}, create: { userId, role: Role.CUSTOMER },
    });
  });

  it.each(["CustomerProfile existente sem CUSTOMER", "CUSTOMER existente sem CustomerProfile"])
  ("recupera associacao parcial: %s", async () => {
    await service.activateCurrentProfessional(userId);

    expect(transaction.customerProfile.upsert).toHaveBeenCalled();
    expect(transaction.userRole.upsert).toHaveBeenCalled();
  });

  it("repete a ativacao de forma idempotente", async () => {
    await service.activateCurrentProfessional(userId);
    await service.activateCurrentProfessional(userId);

    expect(transaction.customerProfile.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.userRole.upsert).toHaveBeenCalledTimes(2);
    expect(usersService.findSafeById).toHaveBeenCalledWith(userId);
  });

  it.each(Object.values(UserStatus).filter((status) => status !== UserStatus.PENDING && status !== UserStatus.ACTIVE))
  ("rejects an ineligible %s account status", async () => {
    transaction.user.findFirst.mockResolvedValue(null);

    await expect(service.activateCurrentProfessional(userId)).rejects.toBeInstanceOf(CustomerProfileActivationUnavailableException);

    expect(transaction.customerProfile.upsert).not.toHaveBeenCalled();
    expect(transaction.userRole.upsert).not.toHaveBeenCalled();
  });

  it.each(["a deleted user", "a missing professional profile", "a deleted professional profile"])
  ("rejects %s", async () => {
    transaction.user.findFirst.mockResolvedValue(null);

    await expect(service.activateCurrentProfessional(userId)).rejects.toBeInstanceOf(CustomerProfileActivationUnavailableException);

    expect(transaction.customerProfile.upsert).not.toHaveBeenCalled();
    expect(transaction.userRole.upsert).not.toHaveBeenCalled();
  });
});
