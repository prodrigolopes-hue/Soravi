import { ServiceRequestStatus } from "../../../generated/prisma/client";

export interface OpportunityDetailResponseProperties {
  id: string;
  createdAt: Date;
  viewedAt: Date | null;
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

export class OpportunityDetailResponseDto {
  opportunityId!: string;
  createdAt!: Date;
  viewedAt!: Date | null;
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

  constructor(properties: OpportunityDetailResponseProperties) {
    this.opportunityId = properties.id;
    this.createdAt = properties.createdAt;
    this.viewedAt = properties.viewedAt;
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