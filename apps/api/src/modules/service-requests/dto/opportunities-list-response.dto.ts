import { ServiceRequestStatus } from "../../../generated/prisma/client";

export interface OpportunityListItemProperties {
  id: string;
  createdAt: Date;
  viewedAt: Date | null;
  customerFirstName: string | null;
  serviceRequest: {
    id: string;
    title: string;
    description: string | null;
    status: ServiceRequestStatus;
    state: string;
    city: string;
    neighborhood: string;
    category: {
      id: string;
      name: string;
    };
  };
}

export class OpportunityListItemResponseDto {
  id!: string;
  createdAt!: Date;
  viewedAt!: Date | null;
  customerFirstName!: string | null;
  serviceRequest!: {
    id: string;
    title: string;
    description: string | null;
    status: ServiceRequestStatus;
    category: {
      id: string;
      name: string;
    };
    location: {
      state: string;
      city: string;
      neighborhood: string;
    };
  };

  constructor(properties: OpportunityListItemProperties) {
    this.id = properties.id;
    this.createdAt = properties.createdAt;
    this.viewedAt = properties.viewedAt;
    this.customerFirstName = properties.customerFirstName;
    this.serviceRequest = {
      id: properties.serviceRequest.id,
      title: properties.serviceRequest.title,
      description: properties.serviceRequest.description,
      status: properties.serviceRequest.status,
      category: properties.serviceRequest.category,
      location: {
        state: properties.serviceRequest.state,
        city: properties.serviceRequest.city,
        neighborhood: properties.serviceRequest.neighborhood,
      },
    };
  }
}

export class OpportunitiesPaginationResponseDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class OpportunitiesListResponseDto {
  items!: OpportunityListItemResponseDto[];
  pagination!: OpportunitiesPaginationResponseDto;

  constructor(
    items: OpportunityListItemProperties[],
    page: number,
    limit: number,
    total: number,
  ) {
    this.items = items.map((item) => new OpportunityListItemResponseDto(item));
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
