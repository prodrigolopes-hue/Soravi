import { ContractStatus } from "../../../generated/prisma/client";

export interface ContractResponseDtoProperties {
  id: string;
  status: ContractStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

export class ContractResponseDto {
  readonly id: string;
  readonly status: ContractStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;

  constructor(properties: ContractResponseDtoProperties) {
    this.id = properties.id;
    this.status = properties.status;
    this.startedAt = properties.startedAt;
    this.completedAt = properties.completedAt;
  }
}
