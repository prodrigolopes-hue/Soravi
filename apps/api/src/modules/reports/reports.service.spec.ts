import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ContractReportReason, ContractReportStatus } from "../../generated/prisma/client";
import { ReportsService } from "./reports.service";

const customerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const contractId = "33333333-3333-4333-8333-333333333333";

function setup(existing = false) {
  const tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: contractId }]), contract: { findUnique: jest.fn().mockResolvedValue({ customerProfile: { userId: customerId }, professionalProfile: { userId: professionalId } }) }, contractReport: { findFirst: jest.fn().mockResolvedValue(existing ? { id: "open" } : null), create: jest.fn().mockResolvedValue({ protocol: "DEN-ABC" }), update: jest.fn(), findUnique: jest.fn() } };
  const prisma = { $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)), contractReport: { findMany: jest.fn(), findUnique: jest.fn() } };
  return { service: new ReportsService(prisma as never), tx };
}

describe("ReportsService", () => {
  const input = { reason: ContractReportReason.IDENTITY_DIVERGENCE, description: "Relato suficientemente detalhado" };
  it.each([customerId, professionalId])("cria denúncia para participante %s e deriva o denunciado", async (actor) => { const { service, tx } = setup(); await expect(service.createForContract(actor, contractId, input)).resolves.toEqual({ protocol: "DEN-ABC" }); expect(tx.contractReport.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reporterUserId: actor, targetUserId: actor === customerId ? professionalId : customerId }) })); });
  it("recusa terceiro e não cria denúncia", async () => { const { service, tx } = setup(); await expect(service.createForContract("44444444-4444-4444-8444-444444444444", contractId, input)).rejects.toBeInstanceOf(ForbiddenException); expect(tx.contractReport.create).not.toHaveBeenCalled(); });
  it("recusa segunda denúncia aberta do mesmo participante", async () => { const { service } = setup(true); await expect(service.createForContract(customerId, contractId, input)).rejects.toBeInstanceOf(ConflictException); });
  it("encerra sem atualizar conta ou contrato", async () => { const { service, tx } = setup(); tx.contractReport.findUnique.mockResolvedValue({ id: "report", status: ContractReportStatus.UNDER_REVIEW }); await service.updateForAdmin("admin", "report", { status: ContractReportStatus.RESOLVED, resolution: "Caso analisado." }); expect(tx.contractReport.update).toHaveBeenCalled(); expect((tx as Record<string, unknown>).user).toBeUndefined(); expect((tx as Record<string, unknown>).contract).toBeDefined(); });
});
