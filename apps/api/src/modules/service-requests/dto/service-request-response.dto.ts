import { ServiceRequestStatus } from "../../../generated/prisma/client";

export interface ServiceRequestLocationResponseDto {
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  postalCode: string;
  addressLine: string;
  addressNumber: string;
  addressComplement: string | null;
}

export interface ServiceRequestResponseDtoProperties {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  status: ServiceRequestStatus;
  location: ServiceRequestLocationResponseDto;
  editableUntil: Date;
  createdAt: Date;
}

export class ServiceRequestResponseDto {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: ServiceRequestStatus;
  readonly location: ServiceRequestLocationResponseDto;
  readonly editableUntil: Date;
  readonly createdAt: Date;

  constructor(properties: ServiceRequestResponseDtoProperties) {
    this.id = properties.id;
    this.categoryId = properties.categoryId;
    this.title = properties.title;
    this.description = properties.description;
    this.status = properties.status;
    this.location = properties.location;
    this.editableUntil = properties.editableUntil;
    this.createdAt = properties.createdAt;
  }
}