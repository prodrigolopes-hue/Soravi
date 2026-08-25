import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import {
  NotificationType,
  ProfessionalVerificationStatus,
  ServiceRequestStatus,
} from "../../generated/prisma/client";
import { ServiceOpportunityDistributionService } from "./service-opportunity-distribution.service";

interface TransactionClientMock {
  $queryRaw: jest.Mock;
  serviceRequest: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  professionalProfile: {
    findMany: jest.Mock;
  };
  serviceOpportunity: {
    createManyAndReturn: jest.Mock;
  };
  notification: {
    createMany: jest.Mock;
  };
}

describe("ServiceOpportunityDistributionService", () => {
  const serviceRequestId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const categoryId = "825afb87-2b81-4de7-9606-8f382fff3341";
  const firstProfessionalProfileId = "925afb87-2b81-4de7-9606-8f382fff3341";
  const secondProfessionalProfileId = "a25afb87-2b81-4de7-9606-8f382fff3341";
  const firstProfessionalUserId = "b25afb87-2b81-4de7-9606-8f382fff3341";
  const secondProfessionalUserId = "c25afb87-2b81-4de7-9606-8f382fff3341";
  const firstOpportunityId = "d25afb87-2b81-4de7-9606-8f382fff3341";
  const secondOpportunityId = "e25afb87-2b81-4de7-9606-8f382fff3341";

  let service: ServiceOpportunityDistributionService;
  let prismaMock: { $transaction: jest.Mock };
  let transactionMock: TransactionClientMock;

  beforeEach(() => {
    transactionMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: serviceRequestId }]),
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({ categoryId }),
        update: jest.fn().mockResolvedValue({}),
      },
      professionalProfile: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: firstProfessionalProfileId,
              userId: firstProfessionalUserId,
            },
            {
              id: secondProfessionalProfileId,
              userId: secondProfessionalUserId,
            },
          ]),
      },
      serviceOpportunity: {
        createManyAndReturn: jest.fn().mockResolvedValue([
          {
            id: firstOpportunityId,
            professionalProfileId: firstProfessionalProfileId,
          },
          {
            id: secondOpportunityId,
            professionalProfileId: secondProfessionalProfileId,
          },
        ]),
      },
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prismaMock = {
      $transaction: jest.fn(
        async (
          callback: (transaction: TransactionClientMock) => Promise<unknown>,
        ) => callback(transactionMock),
      ),
    };
    service = new ServiceOpportunityDistributionService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("distribui solicitação OPEN com janela encerrada e ainda não distribuída", async () => {
    const beforeDistribution = Date.now();

    const result = await service.distribute(serviceRequestId);
    const afterDistribution = Date.now();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transactionMock.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: serviceRequestId,
        status: ServiceRequestStatus.OPEN,
        editableUntil: { lte: expect.any(Date) },
        opportunitiesDispatchedAt: null,
        deletedAt: null,
      },
      select: { categoryId: true },
    });
    const eligibilityDate = transactionMock.serviceRequest.findFirst.mock
      .calls[0]?.[0].where.editableUntil.lte as Date;
    expect(eligibilityDate.getTime()).toBeGreaterThanOrEqual(
      beforeDistribution,
    );
    expect(eligibilityDate.getTime()).toBeLessThanOrEqual(afterDistribution);
    expect(result).toEqual({
      dispatched: true,
      opportunitiesCreated: 2,
    });
  });

  it.each([
    "a janela ainda está aberta",
    "o status é diferente de OPEN",
    "opportunitiesDispatchedAt está preenchido",
    "deletedAt está preenchido",
  ])("não distribui quando %s", async () => {
    transactionMock.serviceRequest.findFirst.mockResolvedValue(null);

    const result = await service.distribute(serviceRequestId);

    expect(result).toEqual({
      dispatched: false,
      opportunitiesCreated: 0,
    });
    expect(transactionMock.professionalProfile.findMany).not.toHaveBeenCalled();
    expect(
      transactionMock.serviceOpportunity.createManyAndReturn,
    ).not.toHaveBeenCalled();
    expect(transactionMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("não distribui quando a solicitação não existe", async () => {
    transactionMock.$queryRaw.mockResolvedValue([]);

    const result = await service.distribute(serviceRequestId);

    expect(result).toEqual({
      dispatched: false,
      opportunitiesCreated: 0,
    });
    expect(transactionMock.serviceRequest.findFirst).not.toHaveBeenCalled();
  });

  it("seleciona somente profissionais aprovados, disponíveis, ativos e da categoria", async () => {
    await service.distribute(serviceRequestId);

    expect(transactionMock.professionalProfile.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        isAvailable: true,
        verificationStatus: ProfessionalVerificationStatus.APPROVED,
        professionalCategories: {
          some: { categoryId },
        },
      },
      select: { id: true, userId: true },
    });
  });

  it("não marca a solicitação quando não há profissional elegível", async () => {
    transactionMock.professionalProfile.findMany.mockResolvedValue([]);

    const result = await service.distribute(serviceRequestId);

    expect(result).toEqual({
      dispatched: false,
      opportunitiesCreated: 0,
    });
    expect(
      transactionMock.serviceOpportunity.createManyAndReturn,
    ).not.toHaveBeenCalled();
    expect(transactionMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("cria oportunidades idempotentes e marca o instante da distribuição", async () => {
    const result = await service.distribute(serviceRequestId);

    expect(
      transactionMock.serviceOpportunity.createManyAndReturn,
    ).toHaveBeenCalledWith({
      data: [
        {
          serviceRequestId,
          professionalProfileId: firstProfessionalProfileId,
        },
        {
          serviceRequestId,
          professionalProfileId: secondProfessionalProfileId,
        },
      ],
      skipDuplicates: true,
      select: {
        id: true,
        professionalProfileId: true,
      },
    });
    expect(transactionMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: firstProfessionalUserId,
          type: NotificationType.OPPORTUNITY_CREATED,
          title: "Nova oportunidade",
          message: "Uma nova oportunidade está disponível.",
          resourceType: "SERVICE_OPPORTUNITY",
          resourceId: firstOpportunityId,
        },
        {
          userId: secondProfessionalUserId,
          type: NotificationType.OPPORTUNITY_CREATED,
          title: "Nova oportunidade",
          message: "Uma nova oportunidade está disponível.",
          resourceType: "SERVICE_OPPORTUNITY",
          resourceId: secondOpportunityId,
        },
      ],
      skipDuplicates: true,
    });
    expect(transactionMock.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: serviceRequestId },
      data: { opportunitiesDispatchedAt: expect.any(Date) },
    });
    expect(result).toEqual({
      dispatched: true,
      opportunitiesCreated: 2,
    });
  });

  it("não marca como distribuída quando nenhuma oportunidade nova é criada", async () => {
    transactionMock.serviceOpportunity.createManyAndReturn.mockResolvedValue([]);

    const result = await service.distribute(serviceRequestId);

    expect(result).toEqual({
      dispatched: false,
      opportunitiesCreated: 0,
    });
    expect(transactionMock.notification.createMany).not.toHaveBeenCalled();
    expect(transactionMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("não notifica profissional cuja oportunidade foi ignorada por duplicidade", async () => {
    transactionMock.serviceOpportunity.createManyAndReturn.mockResolvedValue([
      {
        id: firstOpportunityId,
        professionalProfileId: firstProfessionalProfileId,
      },
    ]);

    const result = await service.distribute(serviceRequestId);

    expect(transactionMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: firstProfessionalUserId,
          resourceId: firstOpportunityId,
        }),
      ],
      skipDuplicates: true,
    });
    expect(transactionMock.notification.createMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: secondProfessionalUserId }),
        ]),
      }),
    );
    expect(result.opportunitiesCreated).toBe(1);
  });

  it("a segunda chamada não duplica oportunidades", async () => {
    transactionMock.serviceRequest.findFirst
      .mockResolvedValueOnce({ categoryId })
      .mockResolvedValueOnce(null);

    const firstResult = await service.distribute(serviceRequestId);
    const secondResult = await service.distribute(serviceRequestId);

    expect(firstResult).toEqual({
      dispatched: true,
      opportunitiesCreated: 2,
    });
    expect(secondResult).toEqual({
      dispatched: false,
      opportunitiesCreated: 0,
    });
    expect(
      transactionMock.serviceOpportunity.createManyAndReturn,
    ).toHaveBeenCalledTimes(1);
    expect(transactionMock.notification.createMany).toHaveBeenCalledTimes(1);
    expect(transactionMock.serviceRequest.update).toHaveBeenCalledTimes(1);
  });

  it("não marca dispatchedAt quando a criação de oportunidades falha", async () => {
    transactionMock.serviceOpportunity.createManyAndReturn.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(service.distribute(serviceRequestId)).rejects.toThrow(
      "database unavailable",
    );

    expect(transactionMock.notification.createMany).not.toHaveBeenCalled();
    expect(transactionMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("não marca dispatchedAt quando a criação de notificações falha", async () => {
    transactionMock.notification.createMany.mockRejectedValue(
      new Error("notification unavailable"),
    );

    await expect(service.distribute(serviceRequestId)).rejects.toThrow(
      "notification unavailable",
    );

    expect(
      transactionMock.serviceOpportunity.createManyAndReturn,
    ).toHaveBeenCalled();
    expect(transactionMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("mantém lock, criação e atualização na mesma transação e na ordem correta", async () => {
    await service.distribute(serviceRequestId);

    const lockOrder = firstCallOrder(transactionMock.$queryRaw);
    const validationOrder = firstCallOrder(
      transactionMock.serviceRequest.findFirst,
    );
    const professionalsOrder = firstCallOrder(
      transactionMock.professionalProfile.findMany,
    );
    const opportunitiesOrder = firstCallOrder(
      transactionMock.serviceOpportunity.createManyAndReturn,
    );
    const notificationsOrder = firstCallOrder(
      transactionMock.notification.createMany,
    );
    const updateOrder = firstCallOrder(transactionMock.serviceRequest.update);

    expect(lockOrder).toBeLessThan(validationOrder);
    expect(validationOrder).toBeLessThan(professionalsOrder);
    expect(professionalsOrder).toBeLessThan(opportunitiesOrder);
    expect(opportunitiesOrder).toBeLessThan(notificationsOrder);
    expect(notificationsOrder).toBeLessThan(updateOrder);
  });
});

function firstCallOrder(mock: jest.Mock): number {
  const order = mock.mock.invocationCallOrder[0];

  if (order === undefined) {
    throw new Error("A chamada esperada não foi realizada.");
  }

  return order;
}
