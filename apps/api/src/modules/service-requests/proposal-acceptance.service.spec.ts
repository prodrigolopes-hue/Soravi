import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import {
  ContractStatus,
  ConversationStatus,
  EstimatedDurationUnit,
  Prisma,
  ProposalStatus,
  ServiceRequestStatus,
} from "../../generated/prisma/client";
import { ContractAlreadyExistsException } from "./errors/contract-already-exists.exception";
import { ProposalNotActiveException } from "./errors/proposal-not-active.exception";
import { ProposalNotFoundException } from "./errors/proposal-not-found.exception";
import { ServiceRequestNotAcceptingProposalsException } from "./errors/service-request-not-accepting-proposals.exception";
import { ProposalsService } from "./proposals.service";

describe("ProposalsService.accept", () => {
  const proposalId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const serviceRequestId = "825afb87-2b81-4de7-9606-8f382fff3341";
  const customerProfileId = "925afb87-2b81-4de7-9606-8f382fff3341";
  const professionalProfileId = "a25afb87-2b81-4de7-9606-8f382fff3341";
  const userId = "b25afb87-2b81-4de7-9606-8f382fff3341";

  let service: ProposalsService;
  let transaction: {
    customerProfile: { findUnique: jest.Mock };
    proposal: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    serviceRequest: { findFirst: jest.Mock; update: jest.Mock };
    contract: { findUnique: jest.Mock; create: jest.Mock };
    conversation: { create: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let prisma: { $transaction: jest.Mock };

  beforeEach(() => {
    transaction = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: customerProfileId }),
      },
      proposal: {
        findUnique: jest.fn().mockResolvedValue(acceptingProposal()),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: serviceRequestId,
          status: ServiceRequestStatus.RECEIVING_PROPOSALS,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "contract-id",
          status: ContractStatus.ACCEPTED,
          agreedAmountInCents: 15000,
          acceptedAt: new Date("2026-08-20T12:00:00.000Z"),
        }),
      },
      conversation: {
        create: jest.fn().mockResolvedValue({
          id: "conversation-id",
          status: ConversationStatus.ACTIVE,
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: serviceRequestId }]),
    };
    prisma = {
      $transaction: jest.fn().mockImplementation(
        (callback: (input: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    service = new ProposalsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("aceita em RECEIVING_PROPOSALS, rejeita as demais e cria o fluxo", async () => {
    const result = await service.accept(userId, proposalId);

    expect(transaction.proposal.update).toHaveBeenCalledWith({
      where: { id: proposalId },
      data: expect.objectContaining({
        status: ProposalStatus.ACCEPTED,
        acceptedAt: expect.any(Date),
      }),
    });
    expect(transaction.proposal.updateMany).toHaveBeenCalledWith({
      where: {
        serviceRequestId,
        status: ProposalStatus.ACTIVE,
        id: { not: proposalId },
      },
      data: expect.objectContaining({
        status: ProposalStatus.REJECTED,
        rejectedAt: expect.any(Date),
      }),
    });
    expect(transaction.contract.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceRequestId,
        acceptedProposalId: proposalId,
        customerProfileId,
        professionalProfileId,
        agreedAmountInCents: 15000,
        agreedDurationValue: 2,
        agreedDurationUnit: EstimatedDurationUnit.HOUR,
        agreedMessage: "Proposta aceita.",
        status: ContractStatus.ACCEPTED,
        acceptedAt: expect.any(Date),
      }),
      select: expect.any(Object),
    });
    expect(transaction.conversation.create).toHaveBeenCalledWith({
      data: { contractId: "contract-id", status: ConversationStatus.ACTIVE },
      select: { id: true, status: true },
    });
    expect(transaction.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: serviceRequestId },
      data: {
        status: ServiceRequestStatus.HIRED,
        hiredAt: expect.any(Date),
      },
    });
    expect(result.data.contract.status).toBe(ContractStatus.ACCEPTED);
    expect(result.data.conversation.status).toBe(ConversationStatus.ACTIVE);
  });

  it.each([ServiceRequestStatus.RECEIVING_PROPOSALS, ServiceRequestStatus.IN_NEGOTIATION])(
    "transiciona %s para HIRED",
    async (status) => {
      transaction.serviceRequest.findFirst.mockResolvedValue({
        id: serviceRequestId,
        status,
      });

      await service.accept(userId, proposalId);

      expect(transaction.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ServiceRequestStatus.HIRED }),
        }),
      );
    },
  );

  it("retorna 404 neutro para proposta inexistente ou alheia", async () => {
    transaction.proposal.findUnique.mockResolvedValue(null);

    await expect(service.accept(userId, proposalId)).rejects.toBeInstanceOf(
      ProposalNotFoundException,
    );

    transaction.proposal.findUnique.mockResolvedValue(acceptingProposal());
    transaction.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(service.accept(userId, proposalId)).rejects.toBeInstanceOf(
      ProposalNotFoundException,
    );
  });

  it("retorna 409 para proposta não ativa", async () => {
    transaction.proposal.findUnique
      .mockResolvedValueOnce(acceptingProposal())
      .mockResolvedValueOnce({ status: ProposalStatus.REJECTED });

    await expect(service.accept(userId, proposalId)).rejects.toBeInstanceOf(
      ProposalNotActiveException,
    );
  });

  it("retorna 409 para estado inválido da solicitação", async () => {
    transaction.serviceRequest.findFirst.mockResolvedValue({
      id: serviceRequestId,
      status: ServiceRequestStatus.CANCELLED,
    });

    await expect(service.accept(userId, proposalId)).rejects.toBeInstanceOf(
      ServiceRequestNotAcceptingProposalsException,
    );
  });

  it("retorna 409 quando já existe contratação", async () => {
    transaction.contract.findUnique.mockResolvedValue({ id: "existing-contract" });

    await expect(service.accept(userId, proposalId)).rejects.toBeInstanceOf(
      ContractAlreadyExistsException,
    );
  });

  it("propaga falha e não atualiza a solicitação fora da transação", async () => {
    transaction.conversation.create.mockRejectedValue(new Error("conversation failure"));

    await expect(service.accept(userId, proposalId)).rejects.toThrow(
      "conversation failure",
    );
    expect(transaction.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("converte conflito unique concorrente em 409 controlado", async () => {
    transaction.contract.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(service.accept(userId, proposalId)).rejects.toBeInstanceOf(
      ContractAlreadyExistsException,
    );
  });
});

function acceptingProposal() {
  return {
    id: "725afb87-2b81-4de7-9606-8f382fff3341",
    serviceRequestId: "825afb87-2b81-4de7-9606-8f382fff3341",
    professionalProfileId: "a25afb87-2b81-4de7-9606-8f382fff3341",
    amountInCents: 15000,
    estimatedDurationValue: 2,
    estimatedDurationUnit: EstimatedDurationUnit.HOUR,
    message: "Proposta aceita.",
    status: ProposalStatus.ACTIVE,
  };
}
