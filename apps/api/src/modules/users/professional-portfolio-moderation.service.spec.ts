import { BadRequestException } from "@nestjs/common";
import { ProfessionalPortfolioService } from "./professional-portfolio.service";

describe("ProfessionalPortfolioService moderation", () => {
  it("requires a standardized rejection reason", async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new ProfessionalPortfolioService(prisma as never, {} as never);
    await expect(service.decide("admin", "item", "REJECTED", undefined, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a conditional decision conflict without creating history", async () => {
    const transaction = { professionalPortfolioItem: { findFirst: jest.fn().mockResolvedValue({ id: "item", moderationVersion: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) }, professionalPortfolioModerationDecision: { create: jest.fn() } };
    const prisma = { $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
    const service = new ProfessionalPortfolioService(prisma as never, {} as never);
    await expect(service.decide("admin", "item", "APPROVED", undefined, 1)).rejects.toHaveProperty("status", 409);
    expect(transaction.professionalPortfolioModerationDecision.create).not.toHaveBeenCalled();
  });

  it("does not issue a private URL for a removed or decided item", async () => {
    const prisma = { professionalPortfolioItem: { findFirst: jest.fn().mockResolvedValue(null) } };
    const storage = { createTemporaryReadUrl: jest.fn() };
    const service = new ProfessionalPortfolioService(prisma as never, storage as never);
    await expect(service.privateEvidence("item")).rejects.toHaveProperty("status", 404);
    expect(storage.createTemporaryReadUrl).not.toHaveBeenCalled();
  });

  it("soft-deletes only an item owned by the current professional and preserves decision history", async () => {
    const item = { id: "item", objectKey: "professional-portfolios/item.webp" };
    const prisma = { professionalPortfolioItem: { findFirst: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue(item), delete: jest.fn(), count: jest.fn().mockResolvedValue(11) }, professionalPortfolioModerationDecision: { findMany: jest.fn().mockResolvedValue([{ result: "APPROVED" }]) } };
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = new ProfessionalPortfolioService(prisma as never, storage as never);
    await service.removeCurrent("owner", "item");
    expect(prisma.professionalPortfolioItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deletedAt: null, professionalProfile: expect.objectContaining({ userId: "owner" }) }) }));
    expect(prisma.professionalPortfolioItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }));
    expect(prisma.professionalPortfolioItem.delete).not.toHaveBeenCalled();
    await expect(service.history("item")).resolves.toEqual([{ result: "APPROVED" }]);
  });

  it("requires ADMIN authorization at the HTTP controller boundary", () => {
    // HTTP coverage is implemented in users.controller HTTP tests: endpoint guards are AccessTokenGuard + RolesGuard and the ADMIN role decorator is required.
    const { UsersController } = require("./users.controller") as typeof import("./users.controller");
    const { AccessTokenGuard } = require("../auth/guards/access-token.guard") as typeof import("../auth/guards/access-token.guard");
    const { RolesGuard } = require("../auth/guards/roles.guard") as typeof import("../auth/guards/roles.guard");
    const { Role } = require("../../generated/prisma/client") as typeof import("../../generated/prisma/client");
    expect(Reflect.getMetadata("__guards__", UsersController.prototype.listPendingProfessionalPortfolioItems)).toEqual([AccessTokenGuard, RolesGuard]);
    expect(Reflect.getMetadata("roles", UsersController.prototype.listPendingProfessionalPortfolioItems)).toEqual([Role.ADMIN]);
  });
});
