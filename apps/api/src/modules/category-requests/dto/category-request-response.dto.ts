import { CategoryRequestStatus } from "../../../generated/prisma/client";

export interface CategoryRequestResponseDtoProperties {
  id: string;
  suggestedName: string;
  description: string | null;
  status: CategoryRequestStatus;
  createdAt: Date;
}

export class CategoryRequestResponseDto {
  readonly id: string;
  readonly suggestedName: string;
  readonly description: string | null;
  readonly status: CategoryRequestStatus;
  readonly createdAt: Date;

  constructor(properties: CategoryRequestResponseDtoProperties) {
    this.id = properties.id;
    this.suggestedName = properties.suggestedName;
    this.description = properties.description;
    this.status = properties.status;
    this.createdAt = properties.createdAt;
  }
}
