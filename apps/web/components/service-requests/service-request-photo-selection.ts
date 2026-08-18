export const MAX_SERVICE_REQUEST_PHOTOS = 5;
export const MAX_SERVICE_REQUEST_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const SERVICE_REQUEST_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp";

const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface PhotoSelectionResult {
  photos: File[];
  errorMessage: string | null;
}

export function appendServiceRequestPhotos(
  currentPhotos: readonly File[],
  selectedFiles: readonly File[],
): PhotoSelectionResult {
  const photos = [...currentPhotos];
  let invalidTypeCount = 0;
  let oversizedCount = 0;
  let limitExceeded = false;

  for (const file of selectedFiles) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      invalidTypeCount += 1;
      continue;
    }

    if (file.size > MAX_SERVICE_REQUEST_PHOTO_SIZE_BYTES) {
      oversizedCount += 1;
      continue;
    }

    if (photos.length >= MAX_SERVICE_REQUEST_PHOTOS) {
      limitExceeded = true;
      continue;
    }

    photos.push(file);
  }

  const errors = [
    invalidTypeCount > 0
      ? "Selecione apenas imagens JPEG, PNG ou WebP."
      : null,
    oversizedCount > 0
      ? "Cada foto deve ter no máximo 5 MB."
      : null,
    limitExceeded ? "Você pode adicionar no máximo 5 fotos." : null,
  ].filter((message): message is string => message !== null);

  return {
    photos,
    errorMessage: errors.length > 0 ? errors.join(" ") : null,
  };
}

export function removeServiceRequestPhoto(
  photos: readonly File[],
  photoIndex: number,
): File[] {
  return photos.filter((_, index) => index !== photoIndex);
}

export async function uploadServiceRequestPhotos(
  photos: readonly File[],
  uploadPhoto: (photo: File) => Promise<void>,
  onProgress: (current: number, total: number) => void,
): Promise<number> {
  let failedUploads = 0;

  for (const [index, photo] of photos.entries()) {
    onProgress(index + 1, photos.length);

    try {
      await uploadPhoto(photo);
    } catch {
      failedUploads += 1;
    }
  }

  return failedUploads;
}