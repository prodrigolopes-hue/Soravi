import type sharpFactory from "sharp";

const sharp: typeof sharpFactory = require("sharp");

export const PROFESSIONAL_PROFILE_PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PROFESSIONAL_PROFILE_PHOTO_MAX_INPUT_PIXELS = 40_000_000;
export const PROFESSIONAL_PROFILE_PHOTO_MAX_DIMENSION = 8_000;
export const PROFESSIONAL_PROFILE_PHOTO_MIN_DIMENSION = 128;
export const PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION = 512;

const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export type ProfessionalProfilePhotoProcessingErrorCode =
  | "PHOTO_TOO_LARGE"
  | "INVALID_PHOTO"
  | "UNSUPPORTED_PHOTO_FORMAT"
  | "ANIMATED_PHOTO"
  | "PHOTO_DIMENSIONS_OUT_OF_RANGE";

export class ProfessionalProfilePhotoProcessingError extends Error {
  constructor(readonly code: ProfessionalProfilePhotoProcessingErrorCode) {
    super(messageFor(code));
    this.name = "ProfessionalProfilePhotoProcessingError";
  }
}

export interface ProcessProfessionalProfilePhotoInput {
  buffer: Buffer;
  declaredMimeType?: string;
}

export interface ProcessedProfessionalProfilePhoto {
  buffer: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
}

export async function processProfessionalProfilePhoto(
  input: ProcessProfessionalProfilePhotoInput,
): Promise<ProcessedProfessionalProfilePhoto> {
  if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
    throw new ProfessionalProfilePhotoProcessingError("INVALID_PHOTO");
  }

  if (input.buffer.length > PROFESSIONAL_PROFILE_PHOTO_MAX_SIZE_BYTES) {
    throw new ProfessionalProfilePhotoProcessingError("PHOTO_TOO_LARGE");
  }

  const detectedMimeType = detectProfessionalProfilePhotoMimeType(input.buffer);
  if (!detectedMimeType) {
    throw new ProfessionalProfilePhotoProcessingError("UNSUPPORTED_PHOTO_FORMAT");
  }

  if (
    input.declaredMimeType !== undefined &&
    input.declaredMimeType !== detectedMimeType
  ) {
    throw new ProfessionalProfilePhotoProcessingError("INVALID_PHOTO");
  }

  try {
    const metadata = await sharp(input.buffer, {
      animated: false,
      failOn: "error",
      limitInputPixels: PROFESSIONAL_PROFILE_PHOTO_MAX_INPUT_PIXELS,
    }).metadata();

    if (!matchesDetectedFormat(detectedMimeType, metadata.format)) {
      throw new ProfessionalProfilePhotoProcessingError("INVALID_PHOTO");
    }

    if ((metadata.pages ?? 1) > 1) {
      throw new ProfessionalProfilePhotoProcessingError("ANIMATED_PHOTO");
    }

    if (metadata.width === undefined || metadata.height === undefined) {
      throw new ProfessionalProfilePhotoProcessingError("INVALID_PHOTO");
    }

    if (
      metadata.width < PROFESSIONAL_PROFILE_PHOTO_MIN_DIMENSION ||
      metadata.height < PROFESSIONAL_PROFILE_PHOTO_MIN_DIMENSION ||
      metadata.width > PROFESSIONAL_PROFILE_PHOTO_MAX_DIMENSION ||
      metadata.height > PROFESSIONAL_PROFILE_PHOTO_MAX_DIMENSION ||
      metadata.width * metadata.height > PROFESSIONAL_PROFILE_PHOTO_MAX_INPUT_PIXELS
    ) {
      throw new ProfessionalProfilePhotoProcessingError(
        "PHOTO_DIMENSIONS_OUT_OF_RANGE",
      );
    }

    const { data, info } = await sharp(input.buffer, {
      animated: false,
      failOn: "error",
      limitInputPixels: PROFESSIONAL_PROFILE_PHOTO_MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize(
        PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION,
        PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION,
        { fit: "cover", position: "centre" },
      )
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (
      info.format !== "webp" ||
      info.width !== PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION ||
      info.height !== PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION
    ) {
      throw new ProfessionalProfilePhotoProcessingError("INVALID_PHOTO");
    }

    return {
      buffer: data,
      mimeType: "image/webp",
      width: info.width,
      height: info.height,
      sizeBytes: data.length,
    };
  } catch (error: unknown) {
    if (error instanceof ProfessionalProfilePhotoProcessingError) {
      throw error;
    }

    throw new ProfessionalProfilePhotoProcessingError("INVALID_PHOTO");
  }
}

export function detectProfessionalProfilePhotoMimeType(
  bytes: Uint8Array,
): AcceptedMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  return null;
}

function matchesDetectedFormat(
  mimeType: AcceptedMimeType,
  format: string | undefined,
): boolean {
  return (
    (mimeType === "image/jpeg" && format === "jpeg") ||
    (mimeType === "image/png" && format === "png") ||
    (mimeType === "image/webp" && format === "webp")
  );
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function messageFor(code: ProfessionalProfilePhotoProcessingErrorCode): string {
  switch (code) {
    case "PHOTO_TOO_LARGE":
      return "A foto excede o tamanho permitido.";
    case "UNSUPPORTED_PHOTO_FORMAT":
      return "Envie uma imagem JPEG, PNG ou WebP válida.";
    case "ANIMATED_PHOTO":
      return "A foto não pode ser animada.";
    case "PHOTO_DIMENSIONS_OUT_OF_RANGE":
      return "A foto deve ter dimensões entre os limites permitidos.";
    case "INVALID_PHOTO":
      return "Não foi possível processar a foto enviada.";
  }
}
