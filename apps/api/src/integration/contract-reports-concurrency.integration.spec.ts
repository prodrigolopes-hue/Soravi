import { randomUUID } from "node:crypto";

import { ConflictException } from "@nestjs/common";
import {
  ContractReportReason,
  ContractStatus,
  EstimatedDurationUnit,
  Prisma,
  ProposalStatus,
  Role,
  ServiceRequestStatus,
  UserStatus,
} from "../generated/prisma/client";
import { ReportsService } from "../modules/reports/reports.service";
import { createIntegrationPrismaService } from "./integration-database";

describe("denúncias de contratação concorrentes", () => {
  const control = createIntegrationPrismaService();
  const first = createIntegrationPrismaService();
  const second = createIntegrationPrismaService();
  const ids = new Set<string>();

  beforeAll(async () => {
    await Promise.all([control.$connect(), first.$connect(), second.$connect()]);
    const [database] = await control.$queryRaw<Array<{ current_database: string }>>(
      Prisma.sql`SELECT current_database()`,
    );
    if (database?.current_database !== "soravi_integration_test") {
      throw new Error("A suíte recusou executar fora do banco de integração.");
    }
  });

  afterEach(async () => {
    const id = (name: string) => [...ids].find((value) => value.startsWith(`${name}:`))?.slice(name.length + 1);
    const reportContractId = id("contract");
    if (reportContractId) await control.contractReport.deleteMany({ where: { contractId: reportContractId } });
    const contractId = id("contract"); const proposalId = id("proposal"); const requestId = id("request"); const customerProfileId = id("customerProfile"); const professionalProfileId = id("professionalProfile"); const customerUserId = id("customerUser"); const professionalUserId = id("professionalUser"); const categoryId = id("category");
    if (contractId) await control.contract.deleteMany({ where: { id: contractId } });
    if (proposalId) await control.proposal.deleteMany({ where: { id: proposalId } });
    if (requestId) await control.serviceRequest.deleteMany({ where: { id: requestId } });
    if (customerProfileId) await control.customerProfile.deleteMany({ where: { id: customerProfileId } });
    if (professionalProfileId) await control.professionalProfile.deleteMany({ where: { id: professionalProfileId } });
    if (customerUserId) await control.user.deleteMany({ where: { id: customerUserId } });
    if (professionalUserId) await control.user.deleteMany({ where: { id: professionalUserId } });
    if (categoryId) await control.category.deleteMany({ where: { id: categoryId } });
    ids.clear();
  });

  afterAll(async () => { await Promise.all([control.$disconnect(), first.$disconnect(), second.$disconnect()]); });

  it("aceita um envio simultâneo, rejeita o duplicado e mantém uma denúncia aberta", async () => {
    const fixture = await createFixture();
    const input = { reason: ContractReportReason.INAPPROPRIATE_CONDUCT, description: "Relato de integração para validar a concorrência." };
    const results = await Promise.allSettled([
      new ReportsService(first).createForContract(fixture.customerUserId, fixture.contractId, input),
      new ReportsService(second).createForContract(fixture.customerUserId, fixture.contractId, input),
    ]);

    const accepted = results.filter((result): result is PromiseFulfilledResult<{ protocol: string }> => result.status === "fulfilled");
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.value.protocol).toMatch(/^DEN-[A-Z0-9]{12}$/u);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ConflictException);
    await expect(control.contractReport.count({ where: { contractId: fixture.contractId, reporterUserId: fixture.customerUserId, status: { in: ["OPEN", "UNDER_REVIEW"] } } })).resolves.toBe(1);
  });

  async function createFixture() {
    const customerUserId = randomUUID(); const professionalUserId = randomUUID(); const customerProfileId = randomUUID(); const professionalProfileId = randomUUID(); const categoryId = randomUUID(); const requestId = randomUUID(); const proposalId = randomUUID(); const contractId = randomUUID();
    for (const [name, value] of Object.entries({ customerUserId, professionalUserId, customerProfileId, professionalProfileId, categoryId, requestId, proposalId, contractId })) ids.add(`${name}:${value}`);
    const customerEmail = `report-customer-${customerUserId}@example.test`; const professionalEmail = `report-professional-${professionalUserId}@example.test`;
    await control.user.create({ data: { id: customerUserId, name: "Integration customer", email: customerEmail, emailNormalized: customerEmail, passwordHash: "integration-only", status: UserStatus.ACTIVE, roles: { create: { role: Role.CUSTOMER } }, customerProfile: { create: { id: customerProfileId } } } });
    await control.user.create({ data: { id: professionalUserId, name: "Integration professional", email: professionalEmail, emailNormalized: professionalEmail, passwordHash: "integration-only", status: UserStatus.ACTIVE, roles: { create: { role: Role.PROFESSIONAL } }, professionalProfile: { create: { id: professionalProfileId, displayName: "Integration professional" } } } });
    await control.category.create({ data: { id: categoryId, name: `Integration ${categoryId}`, slug: `integration-${categoryId}`, isActive: true, displayOrder: 0 } });
    await control.serviceRequest.create({ data: { id: requestId, publicCode: `SRV-${randomUUID().slice(0, 8).toUpperCase()}`, customerProfileId, categoryId, title: "Solicitação de integração", status: ServiceRequestStatus.HIRED, country: "BR", state: "SP", city: "São Paulo", neighborhood: "Centro", postalCode: "01000-000", addressLine: "Integração", addressNumber: "1", editableUntil: new Date(0), publishedAt: new Date(), hiredAt: new Date() } });
    await control.proposal.create({ data: { id: proposalId, serviceRequestId: requestId, professionalProfileId, amountInCents: 10000, estimatedDurationValue: 1, estimatedDurationUnit: EstimatedDurationUnit.DAY, message: "Proposta de integração", status: ProposalStatus.ACCEPTED, acceptedAt: new Date() } });
    await control.contract.create({ data: { id: contractId, serviceRequestId: requestId, acceptedProposalId: proposalId, customerProfileId, professionalProfileId, agreedAmountInCents: 10000, agreedDurationValue: 1, agreedDurationUnit: EstimatedDurationUnit.DAY, agreedMessage: "Acordo de integração", status: ContractStatus.ACCEPTED } });
    return { customerUserId, contractId };
  }
});
