import { ServiceRequestStatus } from "../../generated/prisma/client";
import { ServiceRequestsService } from "./service-requests.service";

describe("ServiceRequestsService administrative list filters", () => {
  it("applies status and public-code filters before paginating", async () => {
    const where = { deletedAt: null, status: ServiceRequestStatus.HIRED, publicCode: { contains: "SO2026001", mode: "insensitive" } };
    const prisma = {
      serviceRequest: {
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([{ status: ServiceRequestStatus.HIRED, _count: { _all: 1 } }]),
        findMany: jest.fn().mockResolvedValue([{ id: "request-id", publicCode: "SO2026001", title: "Pintura", status: ServiceRequestStatus.HIRED, createdAt: new Date(), customerProfile: { user: { name: "Cliente" } } }]),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new ServiceRequestsService(prisma as never, {} as never, {} as never);

    await expect(service.findAdmin(" so2026001 ", ServiceRequestStatus.HIRED, 2, 20)).resolves.toMatchObject({ total: 1, pagination: { page: 2, limit: 20, totalPages: 1 } });
    expect(prisma.serviceRequest.count).toHaveBeenCalledWith({ where });
    expect(prisma.serviceRequest.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 20, take: 20 }));
  });

  it.each([
    ServiceRequestStatus.DRAFT,
    ServiceRequestStatus.OPEN,
    ServiceRequestStatus.RECEIVING_PROPOSALS,
    ServiceRequestStatus.IN_NEGOTIATION,
    ServiceRequestStatus.HIRED,
    ServiceRequestStatus.IN_PROGRESS,
    ServiceRequestStatus.COMPLETED,
    ServiceRequestStatus.CANCELLED,
  ])("applies %s as an administrative status filter", async (status) => {
    const where = { deletedAt: null, status };
    const prisma = {
      serviceRequest: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const service = new ServiceRequestsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await service.findAdmin(undefined, status);

    expect(prisma.serviceRequest.count).toHaveBeenCalledWith({ where });
    expect(prisma.serviceRequest.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
  });
});
