export interface UploadObjectInput {
  body: Uint8Array;
  contentType: string;
  sizeBytes: number;
}

export interface StoredObject {
  objectKey: string;
}

export interface StorageService {
  upload(input: UploadObjectInput): Promise<StoredObject>;
  delete(objectKey: string): Promise<void>;
  createTemporaryReadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string>;
}

export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");
