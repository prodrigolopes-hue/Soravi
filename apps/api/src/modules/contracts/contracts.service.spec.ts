import "reflect-metadata";

import { ContractStatus, ServiceRequestStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ContractsService } from "./contracts.service";
import { ContractActionForbiddenException } from "./errors/contract-action-forbidden.exception";
import { ContractNotFoundException } from "./errors/contract-not-found.exception";
import { ContractTransitionNotAllowedException } from "./errors/contract-transition-not-allowed.exception";

const contractId = "11111111-1111-4111-8111-111111111111";
const serviceRequestId = "22222222-2222-4222-8222-222222222222";

function contract(status: ContractStatus) {
  return { id: contractId, serviceRequestId, status, startedAt: status === ContractStatus.IN_PROGRESS ? new Date("2026-01-01") : null, completedAt: status === ContractStatus.COMPLETED ? new Date("2026-01-02") : null, customerProfile: { userId: "customer" }, professionalProfile: { userId: "professional" } };
}

describe("ContractsService", () => {
  const transaction = { $queryRaw: jest.fn(), contract: { findUnique: jest.fn(), update: jest.fn() }, serviceRequest: { update: jest.fn() }, review: { findUnique: jest.fn(), create: jest.fn(), aggregate: jest.fn() }, professionalProfile: { update: jest.fn() } };
  const prisma = { $transaction: jest.fn((callback: (value: typeof transaction) => unknown) => callback(transaction)) };
  const service = new ContractsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.$queryRaw.mockResolvedValue([{ id: contractId }]);
    transaction.contract.findUnique.mockResolvedValue(contract(ContractStatus.ACCEPTED));
    transaction.contract.update.mockImplementation(async ({ data }: { data: { status: ContractStatus; startedAt?: Date; completedAt?: Date } }) => ({ id: contractId, status: data.status, startedAt: data.startedAt ?? null, completedAt: data.completedAt ?? null }));
    transaction.review.findUnique.mockResolvedValue(null);
    transaction.review.create.mockResolvedValue({ id: "review", rating: 5, comment: null });
    transaction.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { id: 2 } });
    transaction.professionalProfile.update.mockResolvedValue({ averageRating: "4.5", reviewCount: 2 });
  });

  it("profissional proprietário inicia ACCEPTED e preenche startedAt", async () => {
    const result = await service.start("professional", contractId);
    expect(result.status).toBe(ContractStatus.IN_PROGRESS);
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(transaction.contract.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ContractStatus.IN_PROGRESS, startedAt: expect.any(Date) }) }));
  });

  it.each(["customer", "other-professional"])("rejeita start sem ownership (%s)", async (userId) => {
    await expect(service.start(userId, contractId)).rejects.toBeInstanceOf(ContractActionForbiddenException);
  });

  it("start é idempotente em IN_PROGRESS", async () => {
    transaction.contract.findUnique.mockResolvedValue(contract(ContractStatus.IN_PROGRESS));
    await expect(service.start("professional", contractId)).resolves.toMatchObject({ status: ContractStatus.IN_PROGRESS });
    expect(transaction.contract.update).not.toHaveBeenCalled();
  });

  it.each([ContractStatus.COMPLETED, ContractStatus.CANCELLED])("rejeita start em %s", async (status) => {
    transaction.contract.findUnique.mockResolvedValue(contract(status));
    await expect(service.start("professional", contractId)).rejects.toBeInstanceOf(ContractTransitionNotAllowedException);
  });

  it("cliente proprietário conclui IN_PROGRESS e atualiza solicitação com o mesmo timestamp", async () => {
    transaction.contract.findUnique.mockResolvedValue(contract(ContractStatus.IN_PROGRESS));
    const result = await service.complete("customer", contractId);
    expect(result.status).toBe(ContractStatus.COMPLETED);
    expect(result.completedAt).toBeInstanceOf(Date);
    const completedAt = transaction.contract.update.mock.calls[0][0].data.completedAt as Date;
    expect(transaction.serviceRequest.update).toHaveBeenCalledWith({ where: { id: serviceRequestId }, data: { status: ServiceRequestStatus.COMPLETED, completedAt } });
  });

  it.each(["professional", "other-customer"])("rejeita complete sem ownership (%s)", async (userId) => {
    transaction.contract.findUnique.mockResolvedValue(contract(ContractStatus.IN_PROGRESS));
    await expect(service.complete(userId, contractId)).rejects.toBeInstanceOf(ContractActionForbiddenException);
  });

  it("complete é idempotente em COMPLETED", async () => {
    transaction.contract.findUnique.mockResolvedValue(contract(ContractStatus.COMPLETED));
    await expect(service.complete("customer", contractId)).resolves.toMatchObject({ status: ContractStatus.COMPLETED });
    expect(transaction.contract.update).not.toHaveBeenCalled();
    expect(transaction.serviceRequest.update).not.toHaveBeenCalled();
  });

  it.each([ContractStatus.ACCEPTED, ContractStatus.CANCELLED])("rejeita complete em %s", async (status) => {
    transaction.contract.findUnique.mockResolvedValue(contract(status));
    await expect(service.complete("customer", contractId)).rejects.toBeInstanceOf(ContractTransitionNotAllowedException);
  });

  it("retorna CONTRACT_NOT_FOUND quando o lock não encontra contrato", async () => {
    transaction.$queryRaw.mockResolvedValue([]);
    await expect(service.start("professional", contractId)).rejects.toBeInstanceOf(ContractNotFoundException);
  });
  it("cria review de contrato COMPLETED e recalcula reputação na mesma transação", async () => {
    transaction.contract.findUnique.mockResolvedValue({ ...contract(ContractStatus.COMPLETED), customerProfileId: "customer-profile", professionalProfileId: "professional-profile" });
    const result = await service.review("customer", contractId, { rating: 5, comment: "Ótimo" });
    expect(result.reputation).toMatchObject({ averageRating: "4.5", reviewCount: 2 });
    expect(transaction.review.create).toHaveBeenCalled();
    expect(transaction.review.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { professionalProfileId: "professional-profile" } }));
    expect(transaction.professionalProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewCount: 2 }) }));
  });

  it.each([ContractStatus.ACCEPTED, ContractStatus.IN_PROGRESS])("rejeita review em %s", async (status) => {
    transaction.contract.findUnique.mockResolvedValue({ ...contract(status), customerProfileId: "customer-profile", professionalProfileId: "professional-profile" });
    await expect(service.review("customer", contractId, { rating: 5 })).rejects.toThrow();
  });

  it("rejeita cliente diferente e segunda review", async () => {
    transaction.contract.findUnique.mockResolvedValue({ ...contract(ContractStatus.COMPLETED), customerProfileId: "customer-profile", professionalProfileId: "professional-profile" });
    await expect(service.review("other", contractId, { rating: 5 })).rejects.toThrow();
    transaction.review.findUnique.mockResolvedValue({ id: "review" });
    await expect(service.review("customer", contractId, { rating: 5 })).rejects.toThrow();
  });
});
