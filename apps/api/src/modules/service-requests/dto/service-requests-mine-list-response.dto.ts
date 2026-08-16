import {
  ServiceRequestResponseDto,
  ServiceRequestResponseDtoProperties,
} from "./service-request-response.dto";

export class ServiceRequestsMinePaginationResponseDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class ServiceRequestsMineListResponseDto {
  items!: ServiceRequestResponseDto[];
  pagination!: ServiceRequestsMinePaginationResponseDto;

  constructor(
    items: ServiceRequestResponseDtoProperties[],
    page: number,
    limit: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new ServiceRequestResponseDto(item),
    );
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}