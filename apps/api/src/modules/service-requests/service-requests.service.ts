import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  Prisma,
  ServiceRequestStatus,
} from "../../generated/prisma/client";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestResponseDto } from "./dto/service-request-response.dto";
import { ServiceRequestsMineListResponseDto } from "./dto/service-requests-mine-list-response.dto";
import { ServiceRequestsMineQueryDto } from "./dto/service-requests-mine-query.dto";
import { CustomerProfileNotFoundException } from "./errors/customer-profile-not-found.exception";
import { InvalidServiceRequestCategoryException } from "./errors/invalid-service-request-category.exception";

const SERVICE_REQUEST_RESPONSE_SELECT = {
  id: true,
  categoryId: true,
  title: true,
  description: true,
  status: true,
  country: true,
  state: true,
  city: true,
  neighborhood: true,
  postalCode: true,
  addressLine: true,
  addressNumber: true,
  addressComplement: true,
  createdAt: true,
} satisfies Prisma.ServiceRequestSelect;

@Injectable()
export class ServiceRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const serviceRequest = await this.prisma.serviceRequest.create({
      data: {
        customerProfileId: customerProfile.id,
        categoryId: category.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: ServiceRequestStatus.DRAFT,
        country: input.location.country,
        state: input.location.state,
        city: input.location.city,
        neighborhood: input.location.neighborhood,
        postalCode: input.location.postalCode,
        addressLine: input.location.addressLine,
        addressNumber: input.location.addressNumber,
        addressComplement: input.location.addressComplement?.trim() || null,
      },
      select: SERVICE_REQUEST_RESPONSE_SELECT,
    });

    return new ServiceRequestResponseDto(
      toServiceRequestResponseProperties(serviceRequest),
    );
  }
}

function toServiceRequestResponseProperties(
  serviceRequest: Prisma.ServiceRequestGetPayload<{
    select: typeof SERVICE_REQUEST_RESPONSE_SELECT;
  }>,
) {
  return {
    id: serviceRequest.id,
    categoryId: serviceRequest.categoryId,
    title: serviceRequest.title,
    description: serviceRequest.description,
    status: serviceRequest.status,
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
    createdAt: serviceRequest.createdAt,
  };
}