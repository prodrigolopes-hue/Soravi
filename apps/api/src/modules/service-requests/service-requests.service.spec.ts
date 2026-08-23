import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import { ServiceRequestStatus } from "../../generated/prisma/client";
import { StorageService } from "../../storage/storage.service";
import { CancelServiceRequestDto } from "./dto/cancel-service-request.dto";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestsMineQueryDto } from "./dto/service-requests-mine-query.dto";
import { UpdateServiceRequestDto } from "./dto/update-service-request.dto";
import { CustomerProfileNotFoundException } from "./errors/customer-profile-not-found.exception";
import { InvalidServiceRequestCategoryException } from "./errors/invalid-service-request-category.exception";
import { InvalidServiceRequestPhotoException } from "./errors/invalid-service-request-photo.exception";
import { ServiceRequestCancellationUnavailableException } from "./errors/service-request-cancellation-unavailable.exception";
import { ServiceRequestNotFoundException } from "./errors/service-request-not-found.exception";
import { ServiceRequestPhotoLimitException } from "./errors/service-request-photo-limit.exception";
import { ServiceRequestPhotoTooLargeException } from "./errors/service-request-photo-too-large.exception";
import { ServiceRequestPhotoUploadUnavailableException } from "./errors/service-request-photo-upload-unavailable.exception";
import { ServiceRequestUpdateUnavailableException } from "./errors/service-request-update-unavailable.exception";
import { SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES } from "./service-request-photo-type";
import { ServiceRequestsService } from "./service-requests.service";

describe("ServiceRequestsService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const customerProfileId = "625afb87-2b81-4de7-9606-8f382fff3341";
  const serviceRequestId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const createdAt = new Date("2026-08-16T12:00:00.000Z");
  const editableUntil = new Date("2026-08-16T12:10:00.000Z");

  let service: ServiceRequestsService;
  let prismaMock: {
    customerProfile: { findUnique: jest.Mock };
    category: { findFirst: jest.Mock };
    serviceRequest: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    serviceRequestFile: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let storageMock: {
    upload: jest.Mock;
    delete: jest.Mock;
    createTemporaryReadUrl: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      customerProfile: { findUnique: jest.fn() },
      category: { findFirst: jest.fn() },
      serviceRequest: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      serviceRequestFile: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    storageMock = {
      upload: jest.fn().mockResolvedValue({ objectKey: "objects/photo-id" }),
      delete: jest.fn().mockResolvedValue(undefined),
      createTemporaryReadUrl: jest.fn(),
    };
    service = new ServiceRequestsService(
      prismaMock as unknown as PrismaService,
      storageMock as unknown as StorageService,
    );
    prismaMock.customerProfile.findUnique.mockResolvedValue({
      id: customerProfileId,
    });
    prismaMock.category.findFirst.mockResolvedValue({
      id: createInput().categoryId,
    });
    prismaMock.$transaction.mockImplementation(async () => [
      await prismaMock.serviceRequest.count(),
      await prismaMock.serviceRequest.findMany(),
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("cria uma solicitação em OPEN com janela de edição de 10 minutos", async () => {
    const input = Object.assign(createInput(), {
      status: ServiceRequestStatus.DRAFT,
      editableUntil: new Date("2030-01-01T00:00:00.000Z"),
      opportunitiesDispatchedAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const beforeCreation = Date.now();
    prismaMock.serviceRequest.create.mockResolvedValue({
      id: serviceRequestId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      status: ServiceRequestStatus.OPEN,
      ...input.location,
      editableUntil,
      createdAt,
    });

    const result = await service.createServiceRequest(userId, input);
    const afterCreation = Date.now();

    expect(prismaMock.customerProfile.findUnique).toHaveBeenCalledWith({
      where: { userId },
      select: { id: true },
    });
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: input.categoryId,
        isActive: true,
      },
      select: { id: true },
    });
    expect(prismaMock.serviceRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerProfileId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        status: ServiceRequestStatus.OPEN,
        ...input.location,
        opportunitiesDispatchedAt: null,
      }),
      select: expect.any(Object),
    });
    const createData = prismaMock.serviceRequest.create.mock.calls[0]?.[0]
      ?.data as { editableUntil: Date };
    expect(createData.editableUntil.getTime()).toBeGreaterThanOrEqual(
      beforeCreation + 10 * 60 * 1000,
    );
    expect(createData.editableUntil.getTime()).toBeLessThanOrEqual(
      afterCreation + 10 * 60 * 1000,
    );
    expect(createData.editableUntil).not.toEqual(input.editableUntil);
    expect(result.status).toBe(ServiceRequestStatus.OPEN);
    expect(result.editableUntil).toEqual(editableUntil);
    expect(result.location).toEqual(input.location);
  });

  it("rejeita usuário sem CustomerProfile", async () => {
    prismaMock.customerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.createServiceRequest(userId, createInput()),
    ).rejects.toBeInstanceOf(CustomerProfileNotFoundException);

    expect(prismaMock.category.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.serviceRequest.create).not.toHaveBeenCalled();
  });

  it("rejeita categoria inexistente ou inativa", async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(
      service.createServiceRequest(userId, createInput()),
    ).rejects.toBeInstanceOf(InvalidServiceRequestCategoryException);

    expect(prismaMock.serviceRequest.create).not.toHaveBeenCalled();
  });

  it("lista somente solicitações do CustomerProfile autenticado", async () => {
    const input = createInput();
    const query: ServiceRequestsMineQueryDto = {
      status: ServiceRequestStatus.DRAFT,
      categoryId: input.categoryId,
      page: 2,
      limit: 10,
      sort: "asc",
    };
    prismaMock.serviceRequest.count.mockResolvedValue(11);
    prismaMock.serviceRequest.findMany.mockResolvedValue([
      {
        id: serviceRequestId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        status: ServiceRequestStatus.DRAFT,
        ...input.location,
        editableUntil,
        createdAt,
      },
    ]);

    const result = await service.findMine(userId, query);

    const where = {
      customerProfileId,
      deletedAt: null,
      status: ServiceRequestStatus.DRAFT,
      categoryId: input.categoryId,
    };
    expect(prismaMock.serviceRequest.count).toHaveBeenCalledWith({ where });
    expect(prismaMock.serviceRequest.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { createdAt: "asc" },
      skip: 10,
      take: 10,
      select: expect.any(Object),
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 11,
      totalPages: 2,
    });
    expect(result.items).toHaveLength(1);
  });

  it("rejeita listagem quando o CustomerProfile não existe", async () => {
    prismaMock.customerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.findMine(userId, new ServiceRequestsMineQueryDto()),
    ).rejects.toBeInstanceOf(CustomerProfileNotFoundException);

    expect(prismaMock.serviceRequest.count).not.toHaveBeenCalled();
    expect(prismaMock.serviceRequest.findMany).not.toHaveBeenCalled();
  });

  it("obtém somente solicitação ativa do CustomerProfile autenticado", async () => {
    const input = createInput();
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      id: serviceRequestId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      status: ServiceRequestStatus.DRAFT,
      ...input.location,
      editableUntil,
      createdAt,
      files: [],
      contract: {
        conversation: { id: "conversation-id" },
      },
    });

    const result = await service.findOneMine(userId, serviceRequestId);

    expect(prismaMock.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: serviceRequestId,
        customerProfileId,
        deletedAt: null,
      },
      select: expect.objectContaining({
        files: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            objectKey: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            position: true,
          },
        },
      }),
    });
    expect(result.id).toBe(serviceRequestId);
    expect(result.conversationId).toBe("conversation-id");
    expect(result.location).toEqual(input.location);
    expect(result.photos).toEqual([]);
  });

  it.each([
    ["sem Contract", null],
    ["com Contract sem Conversation", { conversation: null }],
  ])("retorna conversationId nulo quando a solicitação está %s", async (_description, contract) => {
    const input = createInput();
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      id: serviceRequestId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      status: ServiceRequestStatus.HIRED,
      ...input.location,
      editableUntil,
      createdAt,
      files: [],
      contract,
    });

    const result = await service.findOneMine(userId, serviceRequestId);

    expect(result.conversationId).toBeNull();
    expect(result).not.toHaveProperty("contractId");
    expect(result).not.toHaveProperty("professionalProfileId");
  });

  it("retorna fotos ordenadas com URL assinada no detalhe da própria solicitação", async () => {
    const input = createInput();
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      id: serviceRequestId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      status: ServiceRequestStatus.DRAFT,
      ...input.location,
      editableUntil,
      createdAt,
      files: [
        {
          id: "photo-1",
          objectKey: "objects/photo-1",
          originalName: "primeira.png",
          mimeType: "image/png",
          sizeBytes: 123,
          position: 1,
        },
        {
          id: "photo-2",
          objectKey: "objects/photo-2",
          originalName: "segunda.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 234,
          position: 2,
        },
      ],
    });
    storageMock.createTemporaryReadUrl.mockImplementation(
      async (objectKey: string) => `https://cdn.example/${objectKey}`,
    );

    const result = await service.findOneMine(userId, serviceRequestId);

    expect(storageMock.createTemporaryReadUrl).toHaveBeenCalledTimes(2);
    expect(storageMock.createTemporaryReadUrl).toHaveBeenNthCalledWith(
      1,
      "objects/photo-1",
      300,
    );
    expect(storageMock.createTemporaryReadUrl).toHaveBeenNthCalledWith(
      2,
      "objects/photo-2",
      300,
    );
    expect(result.photos).toEqual([
      {
        id: "photo-1",
        originalName: "primeira.png",
        mimeType: "image/png",
        sizeBytes: 123,
        position: 1,
        url: "https://cdn.example/objects/photo-1",
      },
      {
        id: "photo-2",
        originalName: "segunda.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 234,
        position: 2,
        url: "https://cdn.example/objects/photo-2",
      },
    ]);
  });

  it("retorna o mesmo not found quando a solicitação não é acessível", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.findOneMine(userId, serviceRequestId),
    ).rejects.toBeInstanceOf(ServiceRequestNotFoundException);
  });

  it("rejeita consulta quando o CustomerProfile não existe", async () => {
    prismaMock.customerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.findOneMine(userId, serviceRequestId),
    ).rejects.toBeInstanceOf(CustomerProfileNotFoundException);

    expect(prismaMock.serviceRequest.findFirst).not.toHaveBeenCalled();
  });

  it("edita solicitação própria OPEN dentro da janela inicial", async () => {
    const input = createUpdateInput();
    mockEditableServiceRequest();
    prismaMock.serviceRequest.update.mockResolvedValue({
      id: serviceRequestId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      status: ServiceRequestStatus.OPEN,
      ...input.location,
      editableUntil,
      createdAt,
    });

    const result = await service.updateMine(userId, serviceRequestId, input);

    expect(prismaMock.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: serviceRequestId,
        customerProfileId,
        deletedAt: null,
      },
      select: {
        status: true,
        editableUntil: true,
        opportunitiesDispatchedAt: true,
      },
    });
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
      where: { id: input.categoryId, isActive: true },
      select: { id: true },
    });
    expect(prismaMock.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: serviceRequestId },
      data: {
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        ...input.location,
      },
      select: expect.any(Object),
    });
    expect(result.title).toBe(input.title);
    expect(result.location).toEqual(input.location);
  });

  it("retorna 404 neutro para solicitação de outro CUSTOMER", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.updateMine(userId, serviceRequestId, { title: "Novo título" }),
    ).rejects.toBeInstanceOf(ServiceRequestNotFoundException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("retorna 404 neutro para solicitação inexistente", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.updateMine(userId, serviceRequestId, { title: "Novo título" }),
    ).rejects.toBeInstanceOf(ServiceRequestNotFoundException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("bloqueia edição após editableUntil", async () => {
    mockEditableServiceRequest({
      editableUntil: new Date(Date.now() - 1),
    });

    await expect(
      service.updateMine(userId, serviceRequestId, { title: "Novo título" }),
    ).rejects.toBeInstanceOf(ServiceRequestUpdateUnavailableException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("bloqueia edição após a distribuição de oportunidades", async () => {
    mockEditableServiceRequest({
      opportunitiesDispatchedAt: new Date(),
    });

    await expect(
      service.updateMine(userId, serviceRequestId, { title: "Novo título" }),
    ).rejects.toBeInstanceOf(ServiceRequestUpdateUnavailableException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("bloqueia edição quando o status é diferente de OPEN", async () => {
    mockEditableServiceRequest({ status: ServiceRequestStatus.CANCELLED });

    await expect(
      service.updateMine(userId, serviceRequestId, { title: "Novo título" }),
    ).rejects.toBeInstanceOf(ServiceRequestUpdateUnavailableException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it.each(["inexistente", "inativa"])(
    "rejeita categoria %s na edição",
    async () => {
      mockEditableServiceRequest();
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMine(userId, serviceRequestId, {
          categoryId: createUpdateInput().categoryId,
        }),
      ).rejects.toBeInstanceOf(InvalidServiceRequestCategoryException);

      expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
    },
  );

  it("ignora campos internos mesmo quando enviados ao service", async () => {
    mockEditableServiceRequest();
    prismaMock.serviceRequest.update.mockResolvedValue({
      id: serviceRequestId,
      categoryId: createInput().categoryId,
      title: "Novo título",
      description: null,
      status: ServiceRequestStatus.OPEN,
      ...createInput().location,
      editableUntil,
      createdAt,
    });
    const input = Object.assign(new UpdateServiceRequestDto(), {
      title: "Novo título",
      status: ServiceRequestStatus.CANCELLED,
      customerProfileId: "outro-customer-profile",
      editableUntil: new Date("2030-01-01T00:00:00.000Z"),
      opportunitiesDispatchedAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    await service.updateMine(userId, serviceRequestId, input);

    expect(prismaMock.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: serviceRequestId },
      data: { title: "Novo título" },
      select: expect.any(Object),
    });
  });

  it("cancela solicitação OPEN não distribuída e preserva as fotos", async () => {
    const reason = "Não preciso mais do serviço.";
    const input = Object.assign(new CancelServiceRequestDto(), {
      reason,
      status: ServiceRequestStatus.COMPLETED,
      cancelledAt: new Date("2030-01-01T00:00:00.000Z"),
      customerProfileId: "outro-customer-profile",
    });
    mockCancellableServiceRequest();
    prismaMock.serviceRequest.update.mockResolvedValue(
      createServiceRequestRecord(ServiceRequestStatus.CANCELLED),
    );
    const beforeCancellation = Date.now();

    const result = await service.cancelMine(userId, serviceRequestId, input);
    const afterCancellation = Date.now();

    expect(prismaMock.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: serviceRequestId,
        customerProfileId,
        deletedAt: null,
      },
      select: {
        status: true,
        opportunitiesDispatchedAt: true,
      },
    });
    expect(prismaMock.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: serviceRequestId },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancellationReason: reason,
      },
      select: expect.any(Object),
    });
    const cancelledAt = prismaMock.serviceRequest.update.mock.calls[0]?.[0]
      ?.data.cancelledAt as Date;
    expect(cancelledAt.getTime()).toBeGreaterThanOrEqual(beforeCancellation);
    expect(cancelledAt.getTime()).toBeLessThanOrEqual(afterCancellation);
    expect(result.status).toBe(ServiceRequestStatus.CANCELLED);
    expect(prismaMock.serviceRequestFile.create).not.toHaveBeenCalled();
    expect(storageMock.delete).not.toHaveBeenCalled();
  });

  it("cancela sem motivo mesmo depois de editableUntil", async () => {
    mockCancellableServiceRequest({
      editableUntil: new Date(Date.now() - 60_000),
    });
    prismaMock.serviceRequest.update.mockResolvedValue(
      createServiceRequestRecord(ServiceRequestStatus.CANCELLED),
    );

    await service.cancelMine(userId, serviceRequestId, {});

    expect(prismaMock.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: serviceRequestId },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancellationReason: null,
      },
      select: expect.any(Object),
    });
  });

  it("bloqueia cancelamento de solicitação já distribuída", async () => {
    mockCancellableServiceRequest({
      opportunitiesDispatchedAt: new Date(),
    });

    await expect(
      service.cancelMine(userId, serviceRequestId, {}),
    ).rejects.toBeInstanceOf(ServiceRequestCancellationUnavailableException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("retorna 404 neutro para cancelamento de outro CUSTOMER", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelMine(userId, serviceRequestId, {}),
    ).rejects.toBeInstanceOf(ServiceRequestNotFoundException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("retorna 404 neutro para cancelamento de solicitação inexistente", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelMine(userId, serviceRequestId, {}),
    ).rejects.toBeInstanceOf(ServiceRequestNotFoundException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it.each([
    ServiceRequestStatus.DRAFT,
    ServiceRequestStatus.RECEIVING_PROPOSALS,
    ServiceRequestStatus.IN_NEGOTIATION,
    ServiceRequestStatus.HIRED,
    ServiceRequestStatus.IN_PROGRESS,
    ServiceRequestStatus.COMPLETED,
    ServiceRequestStatus.CANCELLED,
  ])("bloqueia cancelamento direto no status %s", async (status) => {
    mockCancellableServiceRequest({ status });

    await expect(
      service.cancelMine(userId, serviceRequestId, {}),
    ).rejects.toBeInstanceOf(ServiceRequestCancellationUnavailableException);

    expect(prismaMock.serviceRequest.update).not.toHaveBeenCalled();
  });

  it.each([
    ["JPEG", "image/jpeg", [0xff, 0xd8, 0xff, 0x00]],
    [
      "PNG",
      "image/png",
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00],
    ],
    [
      "WebP",
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
    ],
  ])("envia e persiste uma foto %s válida", async (_name, mimeType, bytes) => {
    const file = createPhoto(mimeType, bytes);
    mockUploadableServiceRequest(2, 3);
    prismaMock.serviceRequestFile.create.mockResolvedValue({
      id: "photo-id",
      originalName: file.originalname,
      mimeType,
      sizeBytes: file.size,
      position: 4,
      createdAt,
    });

    const result = await service.uploadPhoto(userId, serviceRequestId, file);

    expect(storageMock.upload).toHaveBeenCalledWith({
      body: file.buffer,
      contentType: mimeType,
      sizeBytes: file.size,
    });
    expect(prismaMock.serviceRequestFile.create).toHaveBeenCalledWith({
      data: {
        serviceRequestId,
        objectKey: "objects/photo-id",
        originalName: file.originalname,
        mimeType,
        sizeBytes: file.size,
        position: 4,
      },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      id: "photo-id",
      originalName: file.originalname,
      mimeType,
      sizeBytes: file.size,
      position: 4,
      createdAt,
    });
  });

  it("rejeita arquivo com assinatura inválida", async () => {
    mockUploadableServiceRequest();

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0x47, 0x49, 0x46]),
      ),
    ).rejects.toBeInstanceOf(InvalidServiceRequestPhotoException);

    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("rejeita MIME incompatível com os magic bytes", async () => {
    mockUploadableServiceRequest();

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/png", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toBeInstanceOf(InvalidServiceRequestPhotoException);

    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("rejeita foto maior que 5 MB", async () => {
    mockUploadableServiceRequest();
    const file = createPhoto("image/jpeg", [0xff, 0xd8, 0xff]);
    file.size = SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES + 1;

    await expect(
      service.uploadPhoto(userId, serviceRequestId, file),
    ).rejects.toBeInstanceOf(ServiceRequestPhotoTooLargeException);

    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("rejeita a sexta foto", async () => {
    mockUploadableServiceRequest(5, 4);

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toBeInstanceOf(ServiceRequestPhotoLimitException);

    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("rejeita upload quando a solicitação não está em OPEN", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      status: ServiceRequestStatus.DRAFT,
      _count: { files: 0 },
      files: [],
    });

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toBeInstanceOf(ServiceRequestPhotoUploadUnavailableException);

    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("rejeita upload após editableUntil", async () => {
    mockUploadableServiceRequest(0, undefined, {
      editableUntil: new Date(Date.now() - 1),
    });

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toBeInstanceOf(ServiceRequestPhotoUploadUnavailableException);

    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("rejeita upload após distribuição de oportunidades", async () => {
    mockUploadableServiceRequest(0, undefined, {
      opportunitiesDispatchedAt: new Date(),
    });

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toBeInstanceOf(ServiceRequestPhotoUploadUnavailableException);

    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("retorna not found neutro para solicitação de outro cliente", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toBeInstanceOf(ServiceRequestNotFoundException);

    expect(prismaMock.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: serviceRequestId,
        customerProfileId,
        deletedAt: null,
      },
      select: expect.any(Object),
    });
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("não persiste metadata quando o storage falha", async () => {
    mockUploadableServiceRequest();
    storageMock.upload.mockRejectedValue(new Error("storage unavailable"));

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toThrow("storage unavailable");

    expect(prismaMock.serviceRequestFile.create).not.toHaveBeenCalled();
    expect(storageMock.delete).not.toHaveBeenCalled();
  });

  it("remove o objeto quando a persistência Prisma falha", async () => {
    mockUploadableServiceRequest();
    prismaMock.serviceRequestFile.create.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(
      service.uploadPhoto(
        userId,
        serviceRequestId,
        createPhoto("image/jpeg", [0xff, 0xd8, 0xff]),
      ),
    ).rejects.toThrow("database unavailable");

    expect(storageMock.delete).toHaveBeenCalledWith("objects/photo-id");
  });

  function mockUploadableServiceRequest(
    count = 0,
    lastPosition?: number,
    overrides: {
      editableUntil?: Date;
      opportunitiesDispatchedAt?: Date | null;
    } = {},
  ) {
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      status: ServiceRequestStatus.OPEN,
      editableUntil: overrides.editableUntil ?? new Date(Date.now() + 60_000),
      opportunitiesDispatchedAt: overrides.opportunitiesDispatchedAt ?? null,
      _count: { files: count },
      files: lastPosition === undefined ? [] : [{ position: lastPosition }],
    });
  }

  function mockEditableServiceRequest(
    overrides: {
      status?: ServiceRequestStatus;
      editableUntil?: Date;
      opportunitiesDispatchedAt?: Date | null;
    } = {},
  ) {
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      status: overrides.status ?? ServiceRequestStatus.OPEN,
      editableUntil: overrides.editableUntil ?? new Date(Date.now() + 60_000),
      opportunitiesDispatchedAt: overrides.opportunitiesDispatchedAt ?? null,
    });
  }

  function mockCancellableServiceRequest(
    overrides: {
      status?: ServiceRequestStatus;
      opportunitiesDispatchedAt?: Date | null;
      editableUntil?: Date;
    } = {},
  ) {
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      status: overrides.status ?? ServiceRequestStatus.OPEN,
      opportunitiesDispatchedAt: overrides.opportunitiesDispatchedAt ?? null,
      editableUntil: overrides.editableUntil ?? editableUntil,
    });
  }
});

function createPhoto(mimetype: string, bytes: number[]) {
  const buffer = Buffer.from(bytes);

  return {
    buffer,
    originalname: "foto.jpg",
    mimetype,
    size: buffer.byteLength,
  };
}

function createInput(): CreateServiceRequestDto {
  return {
    categoryId: "825afb87-2b81-4de7-9606-8f382fff3341",
    title: "Instalar uma tomada",
    description: "Instalação na sala.",
    location: {
      country: "BR",
      state: "SP",
      city: "Campinas",
      neighborhood: "Centro",
      postalCode: "13000-000",
      addressLine: "Rua Exemplo",
      addressNumber: "100",
      addressComplement: "Apartamento 10",
    },
  };
}

function createUpdateInput(): UpdateServiceRequestDto {
  return {
    categoryId: "925afb87-2b81-4de7-9606-8f382fff3341",
    title: "Instalar duas tomadas",
    description: "Instalação na sala e no quarto.",
    location: {
      country: "BR",
      state: "SP",
      city: "Campinas",
      neighborhood: "Cambuí",
      postalCode: "13000-001",
      addressLine: "Rua Atualizada",
      addressNumber: "200",
      addressComplement: "Apartamento 20",
    },
  };
}

function createServiceRequestRecord(status: ServiceRequestStatus) {
  const input = createInput();

  return {
    id: "725afb87-2b81-4de7-9606-8f382fff3341",
    categoryId: input.categoryId,
    title: input.title,
    description: input.description,
    status,
    ...input.location,
    editableUntil: new Date("2026-08-16T12:10:00.000Z"),
    createdAt: new Date("2026-08-16T12:00:00.000Z"),
  };
}
