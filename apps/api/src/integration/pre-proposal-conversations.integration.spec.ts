import { randomUUID } from "node:crypto";

import {
  ProfessionalVerificationStatus,
  Role,
  ServiceRequestStatus,
  UserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { createIntegrationPrismaService } from "./integration-database";
import { PreProposalConversationsService } from "../modules/pre-proposal-conversations/pre-proposal-conversations.service";
import type { StorageService } from "../storage/storage.service";
import { PreProposalPhotoMaintenanceService } from "../modules/pre-proposal-conversations/pre-proposal-photo-maintenance.service";

describe("PreProposalConversationsService (PostgreSQL integration)", () => {
  let prisma: PrismaService;
  let service: PreProposalConversationsService;
  let ids: { customerUserId: string; professionalUserId: string; customerProfileId: string; professionalProfileId: string; serviceRequestId: string; opportunityId: string; categoryId: string };
  const storageMock: StorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
    createTemporaryReadUrl: jest.fn(),
  };

  beforeAll(async () => {
    prisma = createIntegrationPrismaService();
    await prisma.$connect();
    service = new PreProposalConversationsService(prisma, storageMock);
  });

  beforeEach(async () => {
    const suffix = randomUUID();
    const category = await prisma.category.create({ data: { name: `Categoria ${suffix}`, slug: `categoria-${suffix}`, isActive: true, displayOrder: 0 } });
    const customer = await prisma.user.create({
      data: { name: "Cliente Integração", email: `customer-${suffix}@example.test`, emailNormalized: `customer-${suffix}@example.test`, passwordHash: "hash", status: UserStatus.ACTIVE, roles: { create: { role: Role.CUSTOMER } }, customerProfile: { create: {} } },
      include: { customerProfile: true },
    });
    const professional = await prisma.user.create({
      data: { name: "Profissional Integração", email: `professional-${suffix}@example.test`, emailNormalized: `professional-${suffix}@example.test`, passwordHash: "hash", status: UserStatus.ACTIVE, roles: { create: { role: Role.PROFESSIONAL } }, professionalProfile: { create: { displayName: "Profissional Integração", verificationStatus: ProfessionalVerificationStatus.APPROVED, isAvailable: true, professionalCategories: { create: { categoryId: category.id } } } } },
      include: { professionalProfile: true },
    });
    const request = await prisma.serviceRequest.create({ data: { customerProfileId: customer.customerProfile!.id, categoryId: category.id, title: "Pedido de integração", status: ServiceRequestStatus.OPEN, country: "BR", state: "SP", city: "São Paulo", neighborhood: "Centro", postalCode: "01000-000", addressLine: "Rua privada", addressNumber: "1", editableUntil: new Date(), publishedAt: new Date() } });
    const opportunity = await prisma.serviceOpportunity.create({ data: { serviceRequestId: request.id, professionalProfileId: professional.professionalProfile!.id } });
    ids = { customerUserId: customer.id, professionalUserId: professional.id, customerProfileId: customer.customerProfile!.id, professionalProfileId: professional.professionalProfile!.id, serviceRequestId: request.id, opportunityId: opportunity.id, categoryId: category.id };
  });

  afterEach(async () => {
    await prisma.preProposalResponsePhotoUploadCandidate.deleteMany({ where: { objectKey: { startsWith: "pre-proposal-response-photos/" } } });
    await prisma.preProposalResponsePhoto.deleteMany({ where: { preProposalMessage: { preProposalConversation: { serviceOpportunity: { serviceRequestId: ids.serviceRequestId } } } } });
    await prisma.preProposalMessage.deleteMany({ where: { preProposalConversation: { serviceOpportunity: { serviceRequestId: ids.serviceRequestId } } } });
    await prisma.preProposalConversation.deleteMany({ where: { serviceOpportunity: { serviceRequestId: ids.serviceRequestId } } });
    await prisma.serviceOpportunity.deleteMany({ where: { serviceRequestId: ids.serviceRequestId } });
    await prisma.serviceRequest.delete({ where: { id: ids.serviceRequestId } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.customerUserId, ids.professionalUserId] } } });
    await prisma.category.delete({ where: { id: ids.categoryId } });
  });

  afterAll(async () => prisma.$disconnect());

  it("cria dois pedidos separados, cada um com sua pergunta inicial, em criações concorrentes", async () => {
    const [first, second] = await Promise.all([
      service.start(ids.professionalUserId, ids.opportunityId, "Preciso de mais detalhes."),
      service.start(ids.professionalUserId, ids.opportunityId, "Preciso de mais detalhes."),
    ]);
    expect(first.conversationId).not.toBe(second.conversationId);
    expect(await prisma.preProposalConversation.count({ where: { serviceOpportunityId: ids.opportunityId } })).toBe(2);
    expect(await prisma.preProposalMessage.count({ where: { preProposalConversationId: first.conversationId } })).toBe(1);
    expect(await prisma.preProposalMessage.count({ where: { preProposalConversationId: second.conversationId } })).toBe(1);
  });

  it("não grava mensagem quando o encerramento concorre e obtém o lock da solicitação antes do envio", async () => {
    const started = await service.start(ids.professionalUserId, ids.opportunityId, "Mensagem inicial.");
    let signalLocked: () => void;
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    let releaseClosing: () => void;
    const release = new Promise<void>((resolve) => { releaseClosing = resolve; });
    const closing = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "service_requests" WHERE "id" = ${ids.serviceRequestId}::uuid FOR UPDATE`;
      signalLocked!();
      await release;
      await tx.serviceRequest.update({ where: { id: ids.serviceRequestId }, data: { status: ServiceRequestStatus.CANCELLED, cancelledAt: new Date() } });
    });
    await locked;
    const sending = service.respond(ids.customerUserId, started.conversationId, "Resposta após encerramento.");
    releaseClosing!();
    await closing;
    await expect(sending).rejects.toMatchObject({ response: { code: "PRE_PROPOSAL_CONVERSATION_CLOSED" } });
    expect(await prisma.preProposalMessage.count({ where: { preProposalConversationId: started.conversationId } })).toBe(1);
  });

  it("aceita somente uma resposta concorrente e a mantém privada na oportunidade", async () => {
    const started = await service.start(ids.professionalUserId, ids.opportunityId, "Qual é o prazo?");
    const [first, second] = await Promise.allSettled([
      service.respond(ids.customerUserId, started.conversationId, "Até sexta-feira."),
      service.respond(ids.customerUserId, started.conversationId, "Resposta repetida."),
    ]);

    expect([first, second].filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect([first, second].filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.preProposalMessage.count({ where: { preProposalConversationId: started.conversationId } })).toBe(2);
    await expect(service.findForOpportunity(ids.professionalUserId, ids.opportunityId)).resolves.toMatchObject({ items: [expect.objectContaining({ id: started.conversationId, status: "CLOSED" })] });
    await expect(service.findForOpportunity(ids.customerUserId, ids.opportunityId)).rejects.toMatchObject({ response: { code: "PRE_PROPOSAL_CONVERSATION_NOT_FOUND" } });
  });

  it("mantém a exclusão de candidato serializada entre dois processadores PostgreSQL", async () => {
    const objectKey = `pre-proposal-response-photos/${randomUUID()}`;
    await prisma.preProposalResponsePhotoUploadCandidate.create({ data: { objectKey } });
    const deleted: string[] = [];
    const storage: StorageService = { ...storageMock, delete: jest.fn(async (key: string) => { deleted.push(key); }) };
    const first = new PreProposalPhotoMaintenanceService(prisma, storage);
    const second = new PreProposalPhotoMaintenanceService(prisma, storage);
    await Promise.all([first.processBatch(new Date(), 25), second.processBatch(new Date(), 25)]);
    expect(deleted).toEqual([objectKey]);
  });

  it("recupera lease expirado e mantém candidato inelegível para associação", async () => {
    const objectKey = `pre-proposal-response-photos/${randomUUID()}`;
    await prisma.preProposalResponsePhotoUploadCandidate.create({ data: { objectKey, status: "PROCESSING", attemptCount: 1, leaseExpiresAt: new Date(Date.now() - 1_000) } });
    const storage: StorageService = { ...storageMock, delete: jest.fn().mockResolvedValue(undefined) };
    await new PreProposalPhotoMaintenanceService(prisma, storage).processBatch(new Date(), 25);
    const candidate = await prisma.preProposalResponsePhotoUploadCandidate.findUniqueOrThrow({ where: { objectKey } });
    expect(candidate.status).toBe("PENDING");
    expect(candidate.attemptCount).toBeGreaterThan(1);
    expect(storage.delete).toHaveBeenCalledWith(objectKey);
  });

  it("remove upload tardio na reconciliação posterior", async () => {
    const objectKey = `pre-proposal-response-photos/${randomUUID()}`;
    await prisma.preProposalResponsePhotoUploadCandidate.create({ data: { objectKey } });
    const deleted: string[] = [];
    const storage: StorageService = { ...storageMock, delete: jest.fn(async (key: string) => { deleted.push(key); }) };
    const maintenance = new PreProposalPhotoMaintenanceService(prisma, storage);
    const firstNow = new Date();
    await maintenance.processBatch(firstNow, 25);
    // Simula upload que termina somente depois da primeira limpeza.
    await maintenance.processBatch(new Date(firstNow.getTime() + 24 * 60 * 60 * 1000 + 1), 25);
    expect(deleted).toEqual([objectKey, objectKey]);
  });

  it("serializa associação e limpeza com barreiras explícitas", async () => {
    const objectKey = `pre-proposal-response-photos/${randomUUID()}`;
    const started = await service.start(ids.professionalUserId, ids.opportunityId, "Pergunta com foto.");
    const question = await prisma.preProposalMessage.findFirstOrThrow({ where: { preProposalConversationId: started.conversationId }, select: { id: true } });
    await prisma.preProposalResponsePhotoUploadCandidate.create({ data: { objectKey } });

    let associationLocked!: () => void;
    let releaseAssociation!: () => void;
    const locked = new Promise<void>((resolve) => { associationLocked = resolve; });
    const release = new Promise<void>((resolve) => { releaseAssociation = resolve; });
    const association = prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; attemptCount: number }[]>`SELECT "id", "attempt_count" AS "attemptCount" FROM "pre_proposal_response_photo_upload_candidates" WHERE "object_key" = ${objectKey} FOR UPDATE`;
      associationLocked();
      await release;
      if (!rows[0] || rows[0].attemptCount !== 0) throw new Error("candidate unavailable");
      await tx.preProposalResponsePhoto.create({ data: { preProposalMessageId: question.id, objectKey, originalName: "foto.jpg", mimeType: "image/jpeg", sizeBytes: 1, position: 0 } });
      await tx.preProposalResponsePhotoUploadCandidate.delete({ where: { id: rows[0].id } });
    });
    await locked;
    const deleted: string[] = [];
    const maintenance = new PreProposalPhotoMaintenanceService(prisma, { ...storageMock, delete: jest.fn(async (key: string) => { deleted.push(key); }) });
    const cleaning = maintenance.processBatch(new Date(), 25);
    releaseAssociation();
    await Promise.all([association, cleaning]);
    expect(await prisma.preProposalResponsePhoto.findUnique({ where: { objectKey } })).not.toBeNull();
    expect(deleted).not.toContain(objectKey);
  });

  it("recusa associação quando a limpeza já reivindicou o candidato", async () => {
    const objectKey = `pre-proposal-response-photos/${randomUUID()}`;
    await prisma.preProposalResponsePhotoUploadCandidate.create({ data: { objectKey, status: "PROCESSING", attemptCount: 1, leaseExpiresAt: new Date(Date.now() + 60_000) } });
    await expect(prisma.$transaction(async (tx) => {
      const [candidate] = await tx.$queryRaw<{ status: string; attemptCount: number }[]>`SELECT "status", "attempt_count" AS "attemptCount" FROM "pre_proposal_response_photo_upload_candidates" WHERE "object_key" = ${objectKey} FOR UPDATE`;
      if (!candidate || candidate.status !== "PENDING" || candidate.attemptCount !== 0) throw new Error("candidate unavailable");
    })).rejects.toThrow("candidate unavailable");
  });

  it("recusa o fluxo real de resposta quando a limpeza reivindica o candidato antes da associação", async () => {
    const started = await service.start(ids.professionalUserId, ids.opportunityId, "Envio com foto.");
    const storage = { ...storageMock, upload: jest.fn(), delete: jest.fn() };
    const guardedPrisma = prisma.$extends({
      query: {
        preProposalResponsePhotoUploadCandidate: {
          async create({ args, query }) {
            const candidate = await query(args);
            await prisma.preProposalResponsePhotoUploadCandidate.update({ where: { id: candidate.id }, data: { status: "PROCESSING", attemptCount: 1, leaseExpiresAt: new Date(Date.now() + 60_000) } });
            return candidate;
          },
        },
      },
    });
    const guardedService = new PreProposalConversationsService(guardedPrisma as unknown as PrismaService, storage);
    const photo = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), originalname: "foto.jpg", mimetype: "image/jpeg", size: 4 };

    await expect(guardedService.respond(ids.customerUserId, started.conversationId, "Resposta", [photo])).rejects.toMatchObject({ response: { code: "PRE_PROPOSAL_RESPONSE_PHOTO_CANDIDATE_UNAVAILABLE" } });
    expect(await prisma.preProposalResponsePhoto.count({ where: { preProposalMessage: { preProposalConversationId: started.conversationId } } })).toBe(0);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
