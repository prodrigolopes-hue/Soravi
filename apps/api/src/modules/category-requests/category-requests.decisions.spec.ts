import { ConflictException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { CategoryRequestStatus, Prisma } from "../../generated/prisma/client";
import { CategoryRequestsService } from "./category-requests.service";

describe("CategoryRequestsService decisions", () => {
  const requestId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const profileId = "825afb87-2b81-4de7-9606-8f382fff3341";
  const userId = "925afb87-2b81-4de7-9606-8f382fff3341";
  const adminId = "a25afb87-2b81-4de7-9606-8f382fff3341";
  let service: CategoryRequestsService;
  let tx: Record<string, any>;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: userId }]),
      categoryRequest: {
        findUnique: jest.fn().mockResolvedValue({ id: requestId, status: CategoryRequestStatus.PENDING, professionalProfileId: profileId, suggestedName: "Técnico solar" }),
        update: jest.fn().mockResolvedValue({ id: requestId, suggestedName: "Técnico solar", description: null, status: CategoryRequestStatus.APPROVED, reviewNotes: null, resolvedCategory: { id: "category-id", name: "Técnico solar", slug: "tecnico-solar" }, createdAt: new Date() }),
      },
      professionalProfile: { findUnique: jest.fn().mockResolvedValue({ userId }) },
      professionalCategory: { count: jest.fn().mockResolvedValue(1), findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      category: { findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "category-id" }) },
    };
    const prisma = { $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)) };
    service = new CategoryRequestsService(prisma as unknown as PrismaService);
  });

  it("aprova criando categoria ativa e associa o perfil", async () => {
    await service.decide(requestId, adminId, { decision: "CREATE" });
    expect(tx.category.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Técnico solar", slug: "tecnico-solar", isActive: true }) }));
    expect(tx.professionalCategory.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { professionalProfileId: profileId, categoryId: "category-id" } }));
    expect(tx.categoryRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CategoryRequestStatus.APPROVED, resolvedCategoryId: "category-id", reviewedByUserId: adminId }) }));
  });

  it("associa somente uma categoria oficial ativa existente", async () => {
    tx.category.findFirst.mockResolvedValue({ id: "existing-category" });
    await service.decide(requestId, adminId, { decision: "ASSOCIATE", categoryId: "existing-category" });
    expect(tx.category.create).not.toHaveBeenCalled();
    expect(tx.categoryRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CategoryRequestStatus.MERGED, resolvedCategoryId: "existing-category" }) }));
  });

  it("rejeita somente com motivo e não cria associação", async () => {
    await expect(service.decide(requestId, adminId, { decision: "REJECT" })).rejects.toBeInstanceOf(Error);
    await service.decide(requestId, adminId, { decision: "REJECT", reviewNotes: "Escopo indisponível." });
    expect(tx.professionalCategory.upsert).not.toHaveBeenCalled();
    expect(tx.categoryRequest.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CategoryRequestStatus.REJECTED, reviewNotes: "Escopo indisponível." }) }));
  });

  it("bloqueia aprovação que adicionaria uma quarta categoria", async () => {
    tx.professionalCategory.count.mockResolvedValue(3);
    await expect(service.decide(requestId, adminId, { decision: "CREATE" })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.professionalCategory.upsert).not.toHaveBeenCalled();
    expect(tx.categoryRequest.update).not.toHaveBeenCalled();
  });

  it("converte somente conflito de serialização em conflito controlado", async () => {
    jest.spyOn(service as any, "decideOnce").mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("serialization", { code: "P2034", clientVersion: "test" }),
    );
    await expect(service.decide(requestId, adminId, { decision: "CREATE" })).rejects.toMatchObject({ response: expect.objectContaining({ code: "CATEGORY_REQUEST_DECISION_CONFLICT" }) });
  });

  it("não transforma erro inesperado em decisão concorrente", async () => {
    jest.spyOn(service as any, "decideOnce").mockRejectedValue(new Error("database unavailable"));
    await expect(service.decide(requestId, adminId, { decision: "CREATE" })).rejects.toThrow("database unavailable");
  });
});
