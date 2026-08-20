import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import {
  EstimatedDurationUnit,
  Prisma,
  ProfessionalVerificationStatus,
  ProposalStatus,
  Role,
  ServiceRequestStatus,
} from "../../generated/prisma/client";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import { ProposalAlreadyExistsException } from "./errors/proposal-already-exists.exception";
import { ProposalCreationUnavailableException } from "./errors/proposal-creation-unavailable.exception";
import { ServiceRequestNotAcceptingProposalsException } from "./errors/service-request-not-accepting-proposals.exception";
import { ProposalsService } from "./proposals.service";

describe("ProposalsService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const professionalProfileId = "625afb87-2b81-4de7-9606-8f382fff3341";
  const serviceRequestId = "725afb87-2b81-4de7-9606-8f382fff3341";

  let service: ProposalsService;
  let transactionMock: {
    professionalProfile: { findFirst: jest.Mock };
    serviceRequest: { findFirst: jest.Mock; update: jest.Mock };
    serviceOpportunity: { findUnique: jest.Mock };
    proposal: { findUnique: jest.Mock; create: jest.Mock };
  };
  let prismaMock: { $transaction: jest.Mock };

  beforeEach(() => {
    transactionMock = {
      professionalProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: professionalProfileId }),
      },
      serviceRequest: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ status: ServiceRequestStatus.OPEN }),
        update: jest.fn().mockResolvedValue({}),
      },
      serviceOpportunity: {
        findUnique: jest.fn().mockResolvedValue({ id: "opportunity-id" }),
      },
      proposal: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createProposal()),
      },
    };
    prismaMock = {
      $transaction: jest
        .fn()
        .mockImplementation((callback) => callback(transactionMock)),
    };
    service = new ProposalsService(prismaMock as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("cria proposta ACTIVE para profissional elegível com oportunidade", async () => {
    const result = await service.create(userId, serviceRequestId, createDto());

    expect(transactionMock.professionalProfile.findFirst).toHaveBeenCalledWith({
      where: {
        userId,
        verificationStatus: ProfessionalVerificationStatus.APPROVED,
        isAvailable: true,
        deletedAt: null,
        user: {
          deletedAt: null,
          roles: { some: { role: Role.PROFESSIONAL } },
        },
      },
      select: { id: true },
    });
    expect(transactionMock.serviceOpportunity.findUnique).toHaveBeenCalledWith({
      where: {
        serviceRequestId_professionalProfileId: {
          serviceRequestId,
          professionalProfileId,
        },
      },
      select: { id: true },
    });
    expect(transactionMock.proposal.create).toHaveBeenCalledWith({
      data: {
        serviceRequestId,
        professionalProfileId,
        amountInCents: 15000,
        estimatedDurationValue: 2,
        estimatedDurationUnit: EstimatedDurationUnit.HOUR,
        message: "Posso realizar amanhã.",
        status: ProposalStatus.ACTIVE,
        acceptedAt: null,
        rejectedAt: null,
        withdrawnAt: null,
        expiredAt: null,
      },
      select: expect.any(Object),
    });
    expect(result.status).toBe(ProposalStatus.ACTIVE);
  });

  it("altera OPEN para RECEIVING_PROPOSALS depois de criar", async () => {
    await service.create(userId, serviceRequestId, createDto());

    expect(transactionMock.proposal.create).toHaveBeenCalled();
    expect(transactionMock.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: serviceRequestId },
      data: { status: ServiceRequestStatus.RECEIVING_PROPOSALS },
    });
    expect(
      transactionMock.proposal.create.mock.invocationCallOrder[0],
    ).toBeLessThan(
      transactionMock.serviceRequest.update.mock.invocationCallOrder[0],
    );
  });

  it("mantém RECEIVING_PROPOSALS sem atualizar a solicitação", async () => {
    transactionMock.serviceRequest.findFirst.mockResolvedValue({
      status: ServiceRequestStatus.RECEIVING_PROPOSALS,
    });

    await service.create(userId, serviceRequestId, createDto());

    expect(transactionMock.proposal.create).toHaveBeenCalled();
    expect(transactionMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("retorna erro neutro quando não existe oportunidade", async () => {
    transactionMock.serviceOpportunity.findUnique.mockResolvedValue(null);

    await expect(
      service.create(userId, serviceRequestId, createDto()),
    ).rejects.toBeInstanceOf(ProposalCreationUnavailableException);

    expect(transactionMock.proposal.create).not.toHaveBeenCalled();
  });

  it("bloqueia perfil não aprovado pela consulta de elegibilidade", async () => {
    transactionMock.professionalProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.create(userId, serviceRequestId, createDto()),
    ).rejects.toBeInstanceOf(ProposalCreationUnavailableException);

    expect(transactionMock.professionalProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: ProfessionalVerificationStatus.APPROVED,
        }),
      }),
    );
    expect(transactionMock.serviceRequest.findFirst).not.toHaveBeenCalled();
  });

  it("bloqueia perfil indisponível pela consulta de elegibilidade", async () => {
    transactionMock.professionalProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.create(userId, serviceRequestId, createDto()),
    ).rejects.toBeInstanceOf(ProposalCreationUnavailableException);

    expect(transactionMock.professionalProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isAvailable: true }),
      }),
    );
    expect(transactionMock.serviceOpportunity.findUnique).not.toHaveBeenCalled();
  });

  it("retorna 409 quando já existe proposta", async () => {
    transactionMock.proposal.findUnique.mockResolvedValue({ id: "proposal-id" });

    await expect(
      service.create(userId, serviceRequestId, createDto()),
    ).rejects.toBeInstanceOf(ProposalAlreadyExistsException);

    expect(transactionMock.proposal.create).not.toHaveBeenCalled();
  });

  it("converte conflito unique concorrente em 409 controlado", async () => {
    transactionMock.proposal.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      service.create(userId, serviceRequestId, createDto()),
    ).rejects.toBeInstanceOf(ProposalAlreadyExistsException);
  });

  it("retorna 409 quando a solicitação não aceita propostas", async () => {
    transactionMock.serviceRequest.findFirst.mockResolvedValue({
      status: ServiceRequestStatus.CANCELLED,
    });

    await expect(
      service.create(userId, serviceRequestId, createDto()),
    ).rejects.toBeInstanceOf(ServiceRequestNotAcceptingProposalsException);

    expect(transactionMock.proposal.create).not.toHaveBeenCalled();
  });

  it("não altera a solicitação quando a criação falha", async () => {
    transactionMock.proposal.create.mockRejectedValue(
      new Error("Falha ao criar proposta"),
    );

    await expect(
      service.create(userId, serviceRequestId, createDto()),
    ).rejects.toThrow("Falha ao criar proposta");

    expect(transactionMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("não expõe professionalProfileId na resposta", async () => {
    const result = await service.create(userId, serviceRequestId, createDto());

    expect(result).toEqual(createProposal());
    expect(result).not.toHaveProperty("professionalProfileId");
  });
});

function createDto(): CreateProposalDto {
  return {
    amountInCents: 15000,
    estimatedDurationValue: 2,
    estimatedDurationUnit: EstimatedDurationUnit.HOUR,
    message: "Posso realizar amanhã.",
  };
}

function createProposal() {
  return {
    id: "proposal-id",
    serviceRequestId: "725afb87-2b81-4de7-9606-8f382fff3341",
    amountInCents: 15000,
    estimatedDurationValue: 2,
    estimatedDurationUnit: EstimatedDurationUnit.HOUR,
    message: "Posso realizar amanhã.",
    status: ProposalStatus.ACTIVE,
    submittedAt: new Date("2026-08-19T12:00:00.000Z"),
    createdAt: new Date("2026-08-19T12:00:00.000Z"),
    updatedAt: new Date("2026-08-19T12:00:00.000Z"),
  };
}