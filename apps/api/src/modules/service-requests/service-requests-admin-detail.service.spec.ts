import { ServiceRequestsService } from "./service-requests.service";
import { Prisma } from "../../generated/prisma/client";

describe("ServiceRequestsService administrative detail", () => {
  const serviceRequest = {
    id: "request-id", publicCode: "SO2026001", title: "Pintura", description: "Sala", status: "RECEIVING_PROPOSALS",
    country: "BR", state: "SP", city: "São Paulo", neighborhood: "Centro",
    createdAt: new Date("2026-10-01T10:00:00.000Z"), publishedAt: new Date("2026-10-01T10:01:00.000Z"), hiredAt: null, startedAt: null, completedAt: null, cancelledAt: null, cancellationReason: null,
    category: { id: "category-id", name: "Pintura", slug: "pintura" },
    customerProfile: { id: "customer-id", user: { name: "Cliente" } }, targetProfessionalProfile: null,
    serviceOpportunities: [],
    proposals: [{ id: "proposal-id", amountInCents: 125000, estimatedDurationValue: 2, estimatedDurationUnit: "DAYS", message: "Inclui material", status: "ACTIVE", isVisible: true, submittedAt: new Date("2026-10-02T10:00:00.000Z"), acceptedAt: null, rejectedAt: null, withdrawnAt: null, expiredAt: null, professionalProfile: { id: "professional-id", displayName: "Profissional" } }],
    contract: null,
  };

  it("audits before returning the minimum commercial detail", async () => {
    const order: string[] = [];
    const findFirst = jest.fn<Promise<typeof serviceRequest>, [Prisma.ServiceRequestFindFirstArgs]>(async () => { order.push("read"); return serviceRequest; });
    const transaction = { serviceRequest: { findFirst }, adminCommercialDataAccessAudit: { create: jest.fn(async () => { order.push("audit"); }) } };
    const prisma = { $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
    const service = new ServiceRequestsService(prisma as never, {} as never, {} as never);

    await expect(service.findAdminDetailByPublicCode("admin-id", " so2026001 ")).resolves.toMatchObject({ publicCode: "SO2026001", region: { city: "São Paulo" }, customer: { name: "Cliente" }, proposals: [expect.objectContaining({ amountInCents: 125000, conditions: "Inclui material" })], contract: null });
    expect(order).toEqual(["read", "audit"]);
    expect(transaction.adminCommercialDataAccessAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({ serviceRequestId: "request-id", operatorUserId: "admin-id", action: "SERVICE_REQUEST_DETAIL_VIEW", accessedAt: expect.any(Date) }) });
    expect(findFirst).toHaveBeenCalledTimes(1);
    const call = findFirst.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("A consulta administrativa não foi registrada.");
    const [query] = call;
    const select = query.select;
    expect(select).toBeDefined();
    if (!select) throw new Error("A consulta administrativa deve declarar select explícito.");
    expect(JSON.stringify(select)).not.toContain("email");
    expect(JSON.stringify(select)).not.toContain("phone");
    expect(JSON.stringify(select)).not.toContain("objectKey");
    expect(JSON.stringify(select)).not.toContain("conversation");
  });

  it("does not return commercial data when audit persistence fails", async () => {
    const transaction = { serviceRequest: { findFirst: jest.fn().mockResolvedValue(serviceRequest) }, adminCommercialDataAccessAudit: { create: jest.fn().mockRejectedValue(new Error("audit unavailable")) } };
    const prisma = { $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
    const service = new ServiceRequestsService(prisma as never, {} as never, {} as never);

    await expect(service.findAdminDetailByPublicCode("admin-id", "SO2026001")).rejects.toThrow("audit unavailable");
  });

  it("returns empty proposals and a null contract when neither exists", async () => {
    const transaction = { serviceRequest: { findFirst: jest.fn().mockResolvedValue({ ...serviceRequest, proposals: [], contract: null }) }, adminCommercialDataAccessAudit: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
    const service = new ServiceRequestsService(prisma as never, {} as never, {} as never);

    await expect(service.findAdminDetailByPublicCode("admin-id", "SO2026001")).resolves.toMatchObject({ proposals: [], contract: null });
  });

  it("returns not found when the code has no active request", async () => {
    const transaction = { serviceRequest: { findFirst: jest.fn().mockResolvedValue(null) }, adminCommercialDataAccessAudit: { create: jest.fn() } };
    const prisma = { $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
    const service = new ServiceRequestsService(prisma as never, {} as never, {} as never);

    await expect(service.findAdminDetailByPublicCode("admin-id", "SO2026999")).rejects.toHaveProperty("status", 404);
    expect(transaction.adminCommercialDataAccessAudit.create).not.toHaveBeenCalled();
  });
});
