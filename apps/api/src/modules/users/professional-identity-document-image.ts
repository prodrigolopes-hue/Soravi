import type sharpFactory from "sharp";

const sharp: typeof sharpFactory = require("sharp");

export const PROFESSIONAL_IDENTITY_DOCUMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_DIMENSION = 8_000;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;

export type ProfessionalIdentityDocumentErrorCode =
  | "DOCUMENT_TOO_LARGE"
  | "INVALID_DOCUMENT"
  | "UNSUPPORTED_DOCUMENT_FORMAT"
  | "ANIMATED_DOCUMENT"
  | "DOCUMENT_DIMENSIONS_OUT_OF_RANGE";

export class ProfessionalIdentityDocumentError extends Error {
  constructor(readonly code: ProfessionalIdentityDocumentErrorCode) {
    super(code);
  }
}

export interface ProcessProfessionalIdentityDocumentInput {
  buffer: Buffer;
  declaredMimeType?: string;
}

export interface ProcessedProfessionalIdentityDocument {
  buffer: Buffer;
  mimeType: "image/webp";
  sizeBytes: number;
}

/** Validates an identity-document image and removes original metadata. */
export async function processProfessionalIdentityDocument(
  input: ProcessProfessionalIdentityDocumentInput,
): Promise<ProcessedProfessionalIdentityDocument> {
  if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
    throw new ProfessionalIdentityDocumentError("INVALID_DOCUMENT");
  }
  if (input.buffer.length > PROFESSIONAL_IDENTITY_DOCUMENT_MAX_SIZE_BYTES) {
    throw new ProfessionalIdentityDocumentError("DOCUMENT_TOO_LARGE");
  }

  const detectedMimeType = detectIdentityDocumentMimeType(input.buffer);
  if (!detectedMimeType) {
    throw new ProfessionalIdentityDocumentError("UNSUPPORTED_DOCUMENT_FORMAT");
  }
  if (input.declaredMimeType && input.declaredMimeType !== detectedMimeType) {
    throw new ProfessionalIdentityDocumentError("INVALID_DOCUMENT");
  }

  try {
    const metadata = await sharp(input.buffer, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
    if (!matchesDetectedFormat(detectedMimeType, metadata.format)) {
      throw new ProfessionalIdentityDocumentError("INVALID_DOCUMENT");
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new ProfessionalIdentityDocumentError("ANIMATED_DOCUMENT");
    }
    if (
      metadata.width === undefined ||
      metadata.height === undefined ||
      metadata.width < MIN_WIDTH ||
      metadata.height < MIN_HEIGHT ||
      metadata.width > MAX_DIMENSION ||
      metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_INPUT_PIXELS
    ) {
      throw new ProfessionalIdentityDocumentError(
        "DOCUMENT_DIMENSIONS_OUT_OF_RANGE",
      );
    }

    const { data, info } = await sharp(input.buffer, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .webp({ quality: 90, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (info.format !== "webp" || data.length === 0) {
      throw new ProfessionalIdentityDocumentError("INVALID_DOCUMENT");
    }
    return { buffer: data, mimeType: "image/webp", sizeBytes: data.length };
  } catch (error: unknown) {
    if (error instanceof ProfessionalIdentityDocumentError) throw error;
    throw new ProfessionalIdentityDocumentError("INVALID_DOCUMENT");
  }
}

function detectIdentityDocumentMimeType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}

function matchesDetectedFormat(mimeType: "image/jpeg" | "image/png", format: string | undefined): boolean {
  return (mimeType === "image/jpeg" && format === "jpeg") || (mimeType === "image/png" && format === "png");
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}
