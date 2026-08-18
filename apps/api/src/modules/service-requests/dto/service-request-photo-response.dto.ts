export interface ServiceRequestPhotoResponseProperties {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  createdAt: Date;
}

export class ServiceRequestPhotoResponseDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  createdAt: Date;

  constructor(properties: ServiceRequestPhotoResponseProperties) {
    this.id = properties.id;
    this.originalName = properties.originalName;
    this.mimeType = properties.mimeType;
    this.sizeBytes = properties.sizeBytes;
    this.position = properties.position;
    this.createdAt = properties.createdAt;
  }
}