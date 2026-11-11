import { ConflictException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import type { StorageService } from "../../storage/storage.service";
import { PreProposalConversationsService } from "./pre-proposal-conversations.service";

const storageMock: StorageService = {
  upload: jest.fn(),
  delete: jest.fn(),
  createTemporaryReadUrl: jest.fn(),
};

function createService(prisma: PrismaService): PreProposalConversationsService {
  return new PreProposalConversationsService(prisma, storageMock);
}

describe("PreProposalConversationsService.send", () => {
  it("bloqueia a mensagem quando o pedido é encerrado enquanto a escrita aguarda o lock", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      preProposalConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "conversation-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          customerProfileId: "customer-profile-id",
          professionalProfileId: "professional-profile-id",
          customerProfile: { userId: "customer-user-id" },
          professionalProfile: { userId: "professional-user-id" },
          serviceOpportunity: {
            serviceRequestId: "request-id",
            professionalProfileId: "professional-profile-id",
            serviceRequest: {
              id: "request-id",
              title: "Pedido",
              status: "OPEN",
              deletedAt: null,
              customerProfileId: "customer-profile-id",
              targetProfessionalProfileId: null,
              contract: null,
            },
          },
        }),
        update: jest.fn(),
      },
      serviceRequest: {
        // A releitura após FOR UPDATE representa o cancelamento/contratação
        // concluído concorrentemente antes de esta transação adquirir o lock.
        findFirst: jest.fn().mockResolvedValue(null),
      },
      preProposalMessage: { create: jest.fn() },
      professionalProfile: { findFirst: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.respond("customer-user-id", "conversation-id", "Ainda está disponível?")).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.serviceRequest.findFirst.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.$queryRaw.mock.invocationCallOrder[0] ?? 0,
    );
    expect(tx.preProposalMessage.create).not.toHaveBeenCalled();
  });

  it("não expõe conversa quando os participantes persistidos não correspondem à solicitação", async () => {
    const prisma = {
      preProposalConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "conversation-id", createdAt: new Date(), updatedAt: new Date(),
          customerProfileId: "another-customer-profile-id", professionalProfileId: "professional-profile-id",
          customerProfile: { userId: "customer-user-id" }, professionalProfile: { userId: "professional-user-id" },
          serviceOpportunity: { professionalProfileId: "professional-profile-id", serviceRequestId: "request-id", serviceRequest: { id: "request-id", title: "Pedido", status: "OPEN", deletedAt: null, customerProfileId: "customer-profile-id", targetProfessionalProfileId: null, contract: null } },
        }),
      },
    };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.findOne("customer-user-id", "conversation-id")).rejects.toMatchObject({ response: { code: "PRE_PROPOSAL_CONVERSATION_NOT_FOUND" } });
  });

  it("não expõe pedido direcionado quando a oportunidade pertence a outro profissional", async () => {
    const prisma = {
      preProposalConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "conversation-id", createdAt: new Date(), updatedAt: new Date(),
          customerProfileId: "customer-profile-id", professionalProfileId: "professional-profile-id",
          customerProfile: { userId: "customer-user-id" }, professionalProfile: { userId: "professional-user-id" },
          serviceOpportunity: { professionalProfileId: "professional-profile-id", serviceRequestId: "request-id", serviceRequest: { id: "request-id", title: "Pedido", status: "OPEN", deletedAt: null, customerProfileId: "customer-profile-id", targetProfessionalProfileId: "target-profile-id", contract: null } },
        }),
      },
    };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.findMessages("professional-user-id", "conversation-id")).rejects.toMatchObject({ response: { code: "PRE_PROPOSAL_CONVERSATION_NOT_FOUND" } });
  });

  it("não inicia contato quando o profissional não atende mais a categoria ativa", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      professionalProfile: { findFirst: jest.fn().mockResolvedValue({ id: "professional-profile-id", professionalCategories: [{ categoryId: "other-category-id" }] }) },
      serviceOpportunity: { findFirst: jest.fn().mockResolvedValue({ id: "opportunity-id", serviceRequestId: "request-id" }) },
      serviceRequest: { findFirst: jest.fn().mockResolvedValue({ id: "request-id", customerProfileId: "customer-profile-id", categoryId: "category-id", category: { isActive: true } }) },
      preProposalConversation: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      preProposalMessage: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.start("professional-user-id", "opportunity-id", "Posso tirar uma dúvida?")).rejects.toMatchObject({ response: { code: "PRE_PROPOSAL_CONVERSATION_NOT_FOUND" } });
    expect(tx.preProposalConversation.create).not.toHaveBeenCalled();
    expect(tx.preProposalMessage.create).not.toHaveBeenCalled();
  });
});

describe("PreProposalConversationsService.findForServiceRequest", () => {
  it("lista para o profissional somente os pedidos da própria oportunidade e assina fotos sem expor objectKey", async () => {
    const storage = { ...storageMock, createTemporaryReadUrl: jest.fn().mockResolvedValue("https://signed.example/photo") };
    const prisma = {
      serviceOpportunity: { findFirst: jest.fn().mockResolvedValue({ id: "opportunity-id" }) },
      preProposalConversation: { findMany: jest.fn().mockResolvedValue([{ id: "request-id", createdAt: new Date(), closedAt: new Date(), messages: [{ id: "message-id", senderUserId: "customer-user-id", content: "Resposta", sentAt: new Date(), responsePhotos: [{ id: "photo-id", objectKey: "private/key", originalName: "foto.jpg", mimeType: "image/jpeg", sizeBytes: 10, position: 0 }] }] }]) },
    };
    const service = new PreProposalConversationsService(prisma as unknown as PrismaService, storage);

    const result = await service.findForOpportunity("professional-user-id", "opportunity-id");
    expect(result).toEqual({ items: [expect.objectContaining({ id: "request-id", status: "CLOSED", messages: [expect.objectContaining({ responsePhotos: [expect.objectContaining({ url: "https://signed.example/photo" })] })] })] });
    expect(result.items[0]?.messages[0]?.responsePhotos[0]).not.toHaveProperty("objectKey");
    expect(prisma.serviceOpportunity.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "opportunity-id" }) }));
  });

  it("lista para o cliente proprietário somente as conversas consistentes e separadas por profissional", async () => {
    const prisma = {
      serviceRequest: { findFirst: jest.fn().mockResolvedValue({ id: "request-id", customerProfileId: "customer-profile-id", targetProfessionalProfileId: null }) },
      preProposalConversation: { findMany: jest.fn().mockResolvedValue([
        { id: "conversation-a", updatedAt: new Date(), customerProfileId: "customer-profile-id", professionalProfileId: "professional-a", professionalProfile: { displayName: "Profissional A" }, serviceOpportunity: { serviceRequestId: "request-id", professionalProfileId: "professional-a" } },
        { id: "conversation-b", updatedAt: new Date(), customerProfileId: "customer-profile-id", professionalProfileId: "professional-b", professionalProfile: { displayName: "Profissional B" }, serviceOpportunity: { serviceRequestId: "request-id", professionalProfileId: "professional-b" } },
        { id: "inconsistent", updatedAt: new Date(), customerProfileId: "customer-profile-id", professionalProfileId: "professional-c", professionalProfile: { displayName: "Ignorar" }, serviceOpportunity: { serviceRequestId: "request-id", professionalProfileId: "other-profile" } },
      ]) },
    };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.findForServiceRequest("customer-user-id", "request-id")).resolves.toMatchObject({
      items: [
        expect.objectContaining({ id: "conversation-a", professional: { id: "professional-a", displayName: "Profissional A" } }),
        expect.objectContaining({ id: "conversation-b", professional: { id: "professional-b", displayName: "Profissional B" } }),
      ],
    });
  });

  it("pagina a listagem consistente depois de confirmar a propriedade", async () => {
    const conversations = ["a", "b", "c"].map((id) => ({ id, updatedAt: new Date(), customerProfileId: "customer-profile-id", professionalProfileId: `professional-${id}`, professionalProfile: { displayName: id }, serviceOpportunity: { serviceRequestId: "request-id", professionalProfileId: `professional-${id}` } }));
    const prisma = {
      serviceRequest: { findFirst: jest.fn().mockResolvedValue({ id: "request-id", customerProfileId: "customer-profile-id", targetProfessionalProfileId: null }) },
      preProposalConversation: { findMany: jest.fn().mockResolvedValue(conversations) },
    };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.findForServiceRequest("customer-user-id", "request-id", 2, 1)).resolves.toMatchObject({ items: [expect.objectContaining({ id: "b" })], page: 2, limit: 1, total: 3 });
  });

  it("limita mensagens, retorna cursor e consulta itens somente após autorizar", async () => {
    const prisma = {
      preProposalConversation: { findFirst: jest.fn().mockResolvedValue({ id: "conversation-id", createdAt: new Date(), updatedAt: new Date(), customerProfileId: "customer-profile-id", professionalProfileId: "professional-id", customerProfile: { userId: "customer-user-id" }, professionalProfile: { userId: "professional-user-id" }, serviceOpportunity: { serviceRequestId: "request-id", professionalProfileId: "professional-id", serviceRequest: { id: "request-id", title: "Pedido", status: "OPEN", deletedAt: null, customerProfileId: "customer-profile-id", targetProfessionalProfileId: null, contract: null } } }) },
      preProposalMessage: { findMany: jest.fn().mockResolvedValue([{ id: "3", senderUserId: "professional-user-id", content: "três", sentAt: new Date(3) }, { id: "2", senderUserId: "customer-user-id", content: "dois", sentAt: new Date(2) }, { id: "1", senderUserId: "professional-user-id", content: "um", sentAt: new Date(1) }]), findFirst: jest.fn() },
    };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.findMessages("customer-user-id", "conversation-id", undefined, 2)).resolves.toMatchObject({ items: [expect.objectContaining({ id: "2" }), expect.objectContaining({ id: "3" })], nextCursor: "2", hasMore: true });
    expect(prisma.preProposalConversation.findFirst.mock.invocationCallOrder[0]).toBeLessThan(prisma.preProposalMessage.findMany.mock.invocationCallOrder[0] ?? Infinity);
  });

  it("recusa terceiro que não é proprietário da solicitação", async () => {
    const prisma = { serviceRequest: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.findForServiceRequest("third-user-id", "request-id")).rejects.toMatchObject({ response: { code: "PRE_PROPOSAL_CONVERSATION_NOT_FOUND" } });
  });

  it("em pedido direcionado não retorna conversa de profissional diferente do destinatário", async () => {
    const prisma = {
      serviceRequest: { findFirst: jest.fn().mockResolvedValue({ id: "request-id", customerProfileId: "customer-profile-id", targetProfessionalProfileId: "target-profile-id" }) },
      preProposalConversation: { findMany: jest.fn().mockResolvedValue([
        { id: "wrong-conversation", updatedAt: new Date(), customerProfileId: "customer-profile-id", professionalProfileId: "other-profile-id", professionalProfile: { displayName: "Outro" }, serviceOpportunity: { serviceRequestId: "request-id", professionalProfileId: "other-profile-id" } },
      ]) },
    };
    const service = createService(prisma as unknown as PrismaService);

    await expect(service.findForServiceRequest("customer-user-id", "request-id")).resolves.toMatchObject({ items: [] });
  });
});
