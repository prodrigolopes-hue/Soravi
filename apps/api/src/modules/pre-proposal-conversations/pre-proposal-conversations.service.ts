import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma, ProfessionalVerificationStatus, Role, ServiceRequestStatus, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PreProposalConversationNotFoundException } from "./errors/pre-proposal-conversation-not-found.exception";
import { STORAGE_SERVICE, type StorageService } from "../../storage/storage.service";
import { detectServiceRequestPhotoMimeType, SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES } from "../service-requests/service-request-photo-type";

const WRITABLE_STATUSES: ServiceRequestStatus[] = [ServiceRequestStatus.OPEN, ServiceRequestStatus.RECEIVING_PROPOSALS];
const RESPONSE_PHOTO_SELECT = { id: true, objectKey: true, originalName: true, mimeType: true, sizeBytes: true, position: true } satisfies Prisma.PreProposalResponsePhotoSelect;
const MESSAGE_SELECT = { id: true, senderUserId: true, content: true, sentAt: true, responsePhotos: { select: RESPONSE_PHOTO_SELECT, orderBy: { position: "asc" } } } satisfies Prisma.PreProposalMessageSelect;
interface UploadedPhoto { buffer: Buffer; originalname: string; mimetype: string; size: number; }

@Injectable()
export class PreProposalConversationsService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async start(userId: string, opportunityId: string, content: string) {
    return this.prisma.$transaction(async (tx) => {
      const professional = await this.findEligibleProfessional(tx, userId);
      const opportunity = await tx.serviceOpportunity.findFirst({
        where: { id: opportunityId, professionalProfileId: professional.id },
        select: { id: true, serviceRequestId: true },
      });
      if (!opportunity) throw new PreProposalConversationNotFoundException();

      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "service_requests" WHERE "id" = ${opportunity.serviceRequestId}::uuid FOR UPDATE`);
      const request = await this.findWritableRequestForOpportunity(tx, opportunity.id, professional.id, userId);
      if (!request) throw new PreProposalConversationNotFoundException();
      if (!request.category.isActive || !professional.professionalCategories.some((item) => item.categoryId === request.categoryId)) {
        throw new PreProposalConversationNotFoundException();
      }

      const conversation = await tx.preProposalConversation.create({
        data: { serviceOpportunityId: opportunity.id, customerProfileId: request.customerProfileId, professionalProfileId: professional.id },
        select: { id: true },
      });
      const message = await tx.preProposalMessage.create({
        data: { preProposalConversationId: conversation.id, senderUserId: userId, content }, select: MESSAGE_SELECT,
      });
      await tx.preProposalConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      return { conversationId: conversation.id, message };
    });
  }

  async respond(userId: string, conversationId: string, content: string, files: UploadedPhoto[] = []) {
    if (files.length > 5) throw new ConflictException({ code: "PRE_PROPOSAL_RESPONSE_PHOTO_LIMIT_REACHED", message: "A resposta aceita no máximo 5 fotos." });
    const validatedFiles = files.map((file) => ({ file, mimeType: validateResponsePhoto(file), objectKey: `pre-proposal-response-photos/${randomUUID()}` }));
    const storedKeys: string[] = [];
    try {
      for (const candidate of validatedFiles) await this.prisma.preProposalResponsePhotoUploadCandidate.create({ data: { objectKey: candidate.objectKey } });
      return await this.prisma.$transaction(async (tx) => {
      const conversation = await this.participantConversation(tx, userId, conversationId);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "service_requests" WHERE "id" = ${conversation.serviceOpportunity.serviceRequestId}::uuid FOR UPDATE`);
      const request = await tx.serviceRequest.findFirst({
        where: {
          id: conversation.serviceOpportunity.serviceRequestId,
          deletedAt: null,
          status: { in: WRITABLE_STATUSES },
          contract: null,
        },
        select: { id: true, categoryId: true, targetProfessionalProfileId: true, category: { select: { isActive: true } } },
      });
      if (!request || conversation.closedAt) {
        throw new ConflictException({ code: "PRE_PROPOSAL_CONVERSATION_CLOSED", message: "Esta conversa não aceita novas mensagens." });
      }
      if (userId !== conversation.customerProfile.userId) {
        throw new PreProposalConversationNotFoundException();
      }
      const messageCount = await tx.preProposalMessage.count({ where: { preProposalConversationId: conversationId } });
      if (messageCount !== 1) throw new ConflictException({ code: "PRE_PROPOSAL_CONVERSATION_CLOSED", message: "Este pedido de esclarecimento já foi encerrado." });
      const message = await tx.preProposalMessage.create({ data: { preProposalConversationId: conversationId, senderUserId: userId, content }, select: MESSAGE_SELECT });
        for (const [position, { file, mimeType, objectKey }] of validatedFiles.entries()) {
          const [candidate] = await tx.$queryRaw<{ id: string; status: "PENDING" | "PROCESSING"; attemptCount: number }[]>(Prisma.sql`
            SELECT "id", "status", "attempt_count" AS "attemptCount" FROM "pre_proposal_response_photo_upload_candidates"
            WHERE "object_key" = ${objectKey} FOR UPDATE
          `);
          if (!candidate || candidate.status !== "PENDING" || candidate.attemptCount !== 0) throw new ConflictException({ code: "PRE_PROPOSAL_RESPONSE_PHOTO_CANDIDATE_UNAVAILABLE", message: "Não foi possível associar a foto." });
          await this.storage.upload({ objectKey, body: file.buffer, contentType: mimeType, sizeBytes: file.size });
          storedKeys.push(objectKey);
          await tx.preProposalResponsePhoto.create({ data: { preProposalMessageId: message.id, objectKey, originalName: file.originalname, mimeType, sizeBytes: file.size, position } });
          await tx.preProposalResponsePhotoUploadCandidate.delete({ where: { id: candidate.id } });
        }
      await tx.preProposalConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date(), closedAt: new Date() } });
      return { conversationId, message };
      });
    } catch (error) {
      await Promise.all(storedKeys.map((key) => this.storage.delete(key).catch(() => undefined)));
      throw error;
    }
  }

  async findOne(userId: string, conversationId: string) {
    const conversation = await this.participantConversation(this.prisma, userId, conversationId);
    return { id: conversation.id, serviceRequest: { id: conversation.serviceOpportunity.serviceRequest.id, title: conversation.serviceOpportunity.serviceRequest.title, status: conversation.serviceOpportunity.serviceRequest.status }, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt, closedAt: conversation.closedAt };
  }

  async findMessages(userId: string, conversationId: string, before?: string, limit = 30) {
    await this.participantConversation(this.prisma, userId, conversationId);
    const cursor = before
      ? await this.prisma.preProposalMessage.findFirst({ where: { id: before, preProposalConversationId: conversationId }, select: { id: true, sentAt: true } })
      : null;
    if (before && !cursor) throw new PreProposalConversationNotFoundException();
    const messages = await this.prisma.preProposalMessage.findMany({
      where: {
        preProposalConversationId: conversationId,
        ...(cursor ? { OR: [{ sentAt: { lt: cursor.sentAt } }, { sentAt: cursor.sentAt, id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: MESSAGE_SELECT,
    });
    const hasMore = messages.length > limit;
    const pageItems = hasMore ? messages.slice(0, limit) : messages;
    const items = await Promise.all([...pageItems].reverse().map(async (message) => ({
      ...message,
      responsePhotos: await Promise.all((message.responsePhotos ?? []).map(async ({ objectKey, ...photo }) => ({
        ...photo,
        url: await this.storage.createTemporaryReadUrl(objectKey, 300),
      }))),
    })));
    return { items, nextCursor: hasMore ? items[0]?.id ?? null : null, hasMore };
  }

  async findForOpportunity(userId: string, opportunityId: string) {
    const opportunity = await this.prisma.serviceOpportunity.findFirst({
      where: { id: opportunityId, professionalProfile: { userId, user: { deletedAt: null } } },
      select: { id: true },
    });
    if (!opportunity) throw new PreProposalConversationNotFoundException();
    const requests = await this.prisma.preProposalConversation.findMany({
      where: { serviceOpportunityId: opportunity.id, professionalProfile: { userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, createdAt: true, closedAt: true, messages: { orderBy: [{ sentAt: "asc" }, { id: "asc" }], select: MESSAGE_SELECT } },
    });
    return { items: await Promise.all(requests.map(async (request) => ({
      id: request.id,
      createdAt: request.createdAt,
      status: request.closedAt ? "CLOSED" : "AWAITING_RESPONSE",
      messages: await Promise.all(request.messages.map(async (message) => ({
        ...message,
        responsePhotos: await Promise.all(message.responsePhotos.map(async ({ objectKey, ...photo }) => ({
          ...photo,
          url: await this.storage.createTemporaryReadUrl(objectKey, 300),
        }))),
      }))),
    }))) };
  }

  async findForServiceRequest(userId: string, serviceRequestId: string, page = 1, limit = 20) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id: serviceRequestId, deletedAt: null, customerProfile: { userId, user: { deletedAt: null } } },
      select: { id: true, customerProfileId: true, targetProfessionalProfileId: true },
    });
    if (!request) throw new PreProposalConversationNotFoundException();

    const conversations = await this.prisma.preProposalConversation.findMany({
      where: { customerProfileId: request.customerProfileId, serviceOpportunity: { serviceRequestId } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true, updatedAt: true, customerProfileId: true, professionalProfileId: true,
        professionalProfile: { select: { displayName: true } },
        serviceOpportunity: { select: { professionalProfileId: true, serviceRequestId: true } },
      },
    });

    const consistentConversations = conversations
        .filter((conversation) =>
          conversation.customerProfileId === request.customerProfileId &&
          conversation.serviceOpportunity.serviceRequestId === request.id &&
          conversation.professionalProfileId === conversation.serviceOpportunity.professionalProfileId &&
          (request.targetProfessionalProfileId === null || request.targetProfessionalProfileId === conversation.professionalProfileId),
        )
        .map((conversation) => ({
          id: conversation.id,
          updatedAt: conversation.updatedAt,
          professional: { id: conversation.professionalProfileId, displayName: conversation.professionalProfile.displayName },
        }));
    const total = consistentConversations.length;
    return { items: consistentConversations.slice((page - 1) * limit, page * limit), page, limit, total };
  }

  private async findEligibleProfessional(tx: Prisma.TransactionClient, userId: string) {
    const professional = await tx.professionalProfile.findFirst({
      where: { userId, verificationStatus: ProfessionalVerificationStatus.APPROVED, isAvailable: true, deletedAt: null, user: { deletedAt: null, status: UserStatus.ACTIVE, roles: { some: { role: Role.PROFESSIONAL } } } },
      select: { id: true, professionalCategories: { select: { categoryId: true } } },
    });
    if (!professional) throw new PreProposalConversationNotFoundException();
    return professional;
  }

  private async findWritableRequestForOpportunity(tx: Prisma.TransactionClient, opportunityId: string, professionalProfileId: string, userId: string) {
    return tx.serviceRequest.findFirst({
      where: { deletedAt: null, status: { in: WRITABLE_STATUSES }, contract: null, serviceOpportunities: { some: { id: opportunityId, professionalProfileId } }, customerProfile: { userId: { not: userId }, user: { deletedAt: null, status: UserStatus.ACTIVE } }, OR: [{ targetProfessionalProfileId: null }, { targetProfessionalProfileId: professionalProfileId }] },
      select: { id: true, customerProfileId: true, categoryId: true, category: { select: { isActive: true } } },
    });
  }

  private async participantConversation(client: PrismaService | Prisma.TransactionClient, userId: string, conversationId: string) {
    const conversation = await client.preProposalConversation.findFirst({
      where: { id: conversationId, OR: [{ customerProfile: { userId, user: { deletedAt: null } } }, { professionalProfile: { userId, user: { deletedAt: null } } }] },
      select: {
        id: true, createdAt: true, updatedAt: true, closedAt: true, customerProfileId: true, professionalProfileId: true,
        customerProfile: { select: { userId: true } },
        professionalProfile: { select: { userId: true } },
        serviceOpportunity: {
          select: {
            serviceRequestId: true, professionalProfileId: true,
            serviceRequest: {
              select: {
                id: true, title: true, status: true, deletedAt: true, customerProfileId: true,
                targetProfessionalProfileId: true,
                contract: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!conversation) throw new PreProposalConversationNotFoundException();
    const request = conversation.serviceOpportunity.serviceRequest;
    const target = request.targetProfessionalProfileId;
    if (
      conversation.customerProfileId !== request.customerProfileId ||
      conversation.professionalProfileId !== conversation.serviceOpportunity.professionalProfileId ||
      (target !== null && target !== conversation.professionalProfileId)
    ) {
      throw new PreProposalConversationNotFoundException();
    }
    return conversation;
  }

}

function validateResponsePhoto(file: UploadedPhoto): "image/jpeg" | "image/png" | "image/webp" {
  if (file.size > SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES || file.buffer.byteLength > SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES) {
    throw new ConflictException({ code: "PRE_PROPOSAL_RESPONSE_PHOTO_TOO_LARGE", message: "Cada foto deve ter no máximo 5 MB." });
  }
  const detected = detectServiceRequestPhotoMimeType(file.buffer);
  if (!detected || detected !== file.mimetype) {
    throw new ConflictException({ code: "INVALID_PRE_PROPOSAL_RESPONSE_PHOTO", message: "A foto enviada é inválida." });
  }
  return detected;
}
