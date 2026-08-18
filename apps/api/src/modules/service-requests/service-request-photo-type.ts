export const SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const SERVICE_REQUEST_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ServiceRequestPhotoMimeType =
  (typeof SERVICE_REQUEST_PHOTO_MIME_TYPES)[number];

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
] as const;
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const;

export function detectServiceRequestPhotoMimeType(
  bytes: Uint8Array,
): ServiceRequestPhotoMimeType | null {
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "image/jpeg";
  }

  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }

  if (
    startsWith(bytes, RIFF_SIGNATURE) &&
    startsWith(bytes.subarray(8), WEBP_SIGNATURE)
  ) {
    return "image/webp";
  }

  return null;
}

function startsWith(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}