import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma, ServiceRequestStatus } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";
import { CancelServiceRequestDto } from "./dto/cancel-service-request.dto";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestPhotoResponseDto } from "./dto/service-request-photo-response.dto";
import {
  ServiceRequestPhotoDetailResponseDto,
  ServiceRequestResponseDto,
} from "./dto/service-request-response.dto";
import { ServiceRequestsMineListResponseDto } from "./dto/service-requests-mine-list-response.dto";
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
import { ServiceOpportunityDistributionService } from "./service-opportunity-distribution.service";
import {
  detectServiceRequestPhotoMimeType,
  SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES,
} from "./service-request-photo-type";

interface UploadedPhoto {
  buffer: Uint8Array;
  originalname: string;
  mimetype: string;
  size: number;
}

const SERVICE_REQUEST_RESPONSE_SELECT = {
  id: true,
  categoryId: true,
  title: true,
  description: true,
  status: true,
  visibleProposalLimit: true,
  country: true,
  state: true,
  city: true,
  neighborhood: true,
  postalCode: true,
  addressLine: true,
  addressNumber: true,
  addressComplement: true,
  editableUntil: true,
  createdAt: true,
} satisfies Prisma.ServiceRequestSelect;

const SERVICE_REQUEST_PHOTO_SIGNED_URL_TTL_SECONDS = 300;

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
    private readonly distributionService: ServiceOpportunityDistributionService,
  ) {}

  async findMine(
    userId: string,
    query: ServiceRequestsMineQueryDto,
  ): Promise<ServiceRequestsMineListResponseDto> {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!customerProfile) {
      throw new CustomerProfileNotFoundException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort = query.sort ?? "desc";
    const where: Prisma.ServiceRequestWhereInput = {
      customerProfileId: customerProfile.id,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };

    const [total, serviceRequests] = await this.prisma.$transaction([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({
        where,
        orderBy: {
          createdAt: sort,
        },
        skip: (page - 1) * limit,
        take: limit,
        select: SERVICE_REQUEST_RESPONSE_SELECT,
      }),
    ]);

    return new ServiceRequestsMineListResponseDto(
      serviceRequests.map(toServiceRequestResponseProperties),
      page,
      limit,
      total,
    );
  }

  async createServiceRequest(
    userId: string,
    input: CreateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!customerProfile) {
      throw new CustomerProfileNotFoundException();
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: input.categoryId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new InvalidServiceRequestCategoryException();
    }

    const publishedAt = new Date();

    const serviceRequest = await this.prisma.serviceRequest.create({
      data: {
        customerProfileId: customerProfile.id,
        categoryId: category.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: ServiceRequestStatus.OPEN,
        visibleProposalLimit: input.visibleProposalLimit ?? 3,
        country: input.location.country,
        state: input.location.state,
        city: input.location.city,
        neighborhood: input.location.neighborhood,
        postalCode: input.location.postalCode,
        addressLine: input.location.addressLine,
        addressNumber: input.location.addressNumber,
        addressComplement: input.location.addressComplement?.trim() || null,
        publishedAt,
        // Campo legado mantido até a remoção em migration; não controla publicação nem despacho.
        editableUntil: publishedAt,
        opportunitiesDispatchedAt: null,
      },
      select: SERVICE_REQUEST_RESPONSE_SELECT,
    });

    await this.distributionService.distribute(serviceRequest.id).catch(() => undefined);

    return new ServiceRequestResponseDto(
      toServiceRequestResponseProperties(serviceRequest),
    );
  }

  async findOneMine(
    userId: string,
    serviceRequestId: string,
  ): Promise<ServiceRequestResponseDto> {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!customerProfile) {
      throw new CustomerProfileNotFoundException();
    }

    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: {
        id: serviceRequestId,
        customerProfileId: customerProfile.id,
        deletedAt: null,
      },
      select: {
        ...SERVICE_REQUEST_RESPONSE_SELECT,
        files: {
          orderBy: {
            position: "asc",
          },
          select: {
            id: true,
            objectKey: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            position: true,
          },
        },
        contract: {
          select: {
            id: true,
            status: true,
            conversation: {
              select: {
                id: true,
              },
            },
            review: { select: { id: true, rating: true, comment: true } },
          },
        },
      },
    });

    if (!serviceRequest) {
      throw new ServiceRequestNotFoundException();
    }

    const photos = await Promise.all(
      serviceRequest.files.map(async (file) => {
        const url = await this.storage.createTemporaryReadUrl(
          file.objectKey,
          SERVICE_REQUEST_PHOTO_SIGNED_URL_TTL_SECONDS,
        );

        return new ServiceRequestPhotoDetailResponseDto({
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          position: file.position,
          url,
        });
      }),
    );

    return new ServiceRequestResponseDto({
      ...toServiceRequestResponseProperties(serviceRequest),
      photos,
    });
  }

  async updateMine(
    userId: string,
    serviceRequestId: string,
    input: UpdateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customerProfile) {
      throw new CustomerProfileNotFoundException();
    }

    const existingServiceRequest = await this.prisma.serviceRequest.findFirst({
      where: {
        id: serviceRequestId,
        customerProfileId: customerProfile.id,
        deletedAt: null,
      },
      select: {
        status: true,
        visibleProposalLimit: true,
      },
    });

    if (!existingServiceRequest) {
      throw new ServiceRequestNotFoundException();
    }

    if (
      existingServiceRequest.status !== ServiceRequestStatus.DRAFT
    ) {
      throw new ServiceRequestUpdateUnavailableException();
    }

    if (input.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: input.categoryId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!category) {
        throw new InvalidServiceRequestCategoryException();
      }
    }

    const serviceRequest = await this.prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
        ...(input.location
          ? {
              country: input.location.country,
              state: input.location.state,
              city: input.location.city,
              neighborhood: input.location.neighborhood,
              postalCode: input.location.postalCode,
              addressLine: input.location.addressLine,
              addressNumber: input.location.addressNumber,
              addressComplement:
                input.location.addressComplement?.trim() || null,
            }
          : {}),
      },
      select: SERVICE_REQUEST_RESPONSE_SELECT,
    });

    return new ServiceRequestResponseDto(
      toServiceRequestResponseProperties(serviceRequest),
    );
  }

  async cancelMine(
    userId: string,
    serviceRequestId: string,
    input: CancelServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customerProfile) {
      throw new CustomerProfileNotFoundException();
    }

    const existingServiceRequest = await this.prisma.serviceRequest.findFirst({
      where: {
        id: serviceRequestId,
        customerProfileId: customerProfile.id,
        deletedAt: null,
      },
      select: {
        status: true,
        opportunitiesDispatchedAt: true,
      },
    });

    if (!existingServiceRequest) {
      throw new ServiceRequestNotFoundException();
    }

    if (
      existingServiceRequest.status !== ServiceRequestStatus.OPEN ||
      existingServiceRequest.opportunitiesDispatchedAt !== null
    ) {
      throw new ServiceRequestCancellationUnavailableException();
    }

    const serviceRequest = await this.prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: input.reason?.trim() || null,
      },
      select: SERVICE_REQUEST_RESPONSE_SELECT,
    });

    return new ServiceRequestResponseDto(
      toServiceRequestResponseProperties(serviceRequest),
    );
  }

  async uploadPhoto(
    userId: string,
    serviceRequestId: string,
    file: UploadedPhoto | undefined,
  ): Promise<ServiceRequestPhotoResponseDto> {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customerProfile) {
      throw new CustomerProfileNotFoundException();
    }

    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: {
        id: serviceRequestId,
        customerProfileId: customerProfile.id,
        deletedAt: null,
      },
      select: {
        status: true,
        _count: { select: { files: true } },
        files: {
          orderBy: { position: "desc" },
          take: 1,
          select: { position: true },
        },
      },
    });

    if (!serviceRequest) {
      throw new ServiceRequestNotFoundException();
    }

    if (
      serviceRequest.status !== ServiceRequestStatus.OPEN
    ) {
      throw new ServiceRequestPhotoUploadUnavailableException();
    }

    if (serviceRequest._count.files >= 5) {
      throw new ServiceRequestPhotoLimitException();
    }

    const validatedPhoto = validatePhoto(file);
    const position = (serviceRequest.files[0]?.position ?? -1) + 1;
    const storedObject = await this.storage.upload({
      body: validatedPhoto.file.buffer,
      contentType: validatedPhoto.mimeType,
      sizeBytes: validatedPhoto.file.size,
    });

    try {
      const photo = await this.prisma.serviceRequestFile.create({
        data: {
          serviceRequestId,
          objectKey: storedObject.objectKey,
          originalName: validatedPhoto.file.originalname,
          mimeType: validatedPhoto.mimeType,
          sizeBytes: validatedPhoto.file.size,
          position,
        },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          position: true,
          createdAt: true,
        },
      });

      return new ServiceRequestPhotoResponseDto(photo);
    } catch (error: unknown) {
      await this.storage.delete(storedObject.objectKey).catch(() => undefined);
      throw error;
    }
  }
}

function validatePhoto(file: UploadedPhoto | undefined): {
  file: UploadedPhoto;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
} {
  if (!file) {
    throw new InvalidServiceRequestPhotoException(
      "Envie uma foto no campo file.",
    );
  }

  if (
    file.size > SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES ||
    file.buffer.byteLength > SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES
  ) {
    throw new ServiceRequestPhotoTooLargeException();
  }

  const detectedMimeType = detectServiceRequestPhotoMimeType(file.buffer);

  if (!detectedMimeType) {
    throw new InvalidServiceRequestPhotoException(
      "A assinatura do arquivo não corresponde a uma imagem permitida.",
    );
  }

  if (file.mimetype !== detectedMimeType) {
    throw new InvalidServiceRequestPhotoException(
      "O MIME declarado não corresponde ao tipo detectado.",
    );
  }

  return { file, mimeType: detectedMimeType };
}

function toServiceRequestResponseProperties(
  serviceRequest: Prisma.ServiceRequestGetPayload<{
    select: typeof SERVICE_REQUEST_RESPONSE_SELECT;
  }> & {
  contract?: {
      id: string;
      status: import("../../generated/prisma/client").ContractStatus;
      conversation: { id: string } | null;
      review?: { id: string; rating: number; comment: string | null } | null;
    } | null;
  },
) {
  return {
    id: serviceRequest.id,
    categoryId: serviceRequest.categoryId,
    title: serviceRequest.title,
    description: serviceRequest.description,
    status: serviceRequest.status,
    visibleProposalLimit: serviceRequest.visibleProposalLimit,
    location: {
      country: serviceRequest.country,
      state: serviceRequest.state,
      city: serviceRequest.city,
      neighborhood: serviceRequest.neighborhood,
      postalCode: serviceRequest.postalCode,
      addressLine: serviceRequest.addressLine,
      addressNumber: serviceRequest.addressNumber,
      addressComplement: serviceRequest.addressComplement,
    },
    editableUntil: serviceRequest.editableUntil,
    createdAt: serviceRequest.createdAt,
    conversationId: serviceRequest.contract?.conversation?.id ?? null,
    contract: serviceRequest.contract ? { id: serviceRequest.contract.id, status: serviceRequest.contract.status, review: serviceRequest.contract.review ?? null } : null,
  };
}
