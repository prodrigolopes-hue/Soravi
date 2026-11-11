import type sharpFactory from "sharp";
const sharp: typeof sharpFactory = require("sharp");

import {
  PROFESSIONAL_IDENTITY_DOCUMENT_MAX_SIZE_BYTES,
  processProfessionalIdentityDocument,
} from "./professional-identity-document-image";

describe("processProfessionalIdentityDocument", () => {
  it.each(["jpeg", "png"] as const)("aceita %s válido e remove metadados", async (format) => {
    const source = await sharp({ create: { width: 640, height: 400, channels: 3, background: "#1d4ed8" } })
      .withMetadata({ exif: { IFD0: { Artist: "private-fixture" } } })
      .toFormat(format).toBuffer();
    const result = await processProfessionalIdentityDocument({
      buffer: source,
      declaredMimeType: `image/${format === "jpeg" ? "jpeg" : "png"}`,
    });
    expect(result.mimeType).toBe("image/webp");
    expect(result.sizeBytes).toBe(result.buffer.length);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
  });

  it("rejeita conteúdo que não é imagem, MIME divergente e arquivo muito grande", async () => {
    await expect(processProfessionalIdentityDocument({ buffer: Buffer.from("not an image") }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_DOCUMENT_FORMAT" });
    const jpeg = await sharp({ create: { width: 640, height: 400, channels: 3, background: "#1d4ed8" } }).jpeg().toBuffer();
    await expect(processProfessionalIdentityDocument({ buffer: jpeg, declaredMimeType: "image/png" }))
      .rejects.toMatchObject({ code: "INVALID_DOCUMENT" });
    await expect(processProfessionalIdentityDocument({ buffer: Buffer.alloc(PROFESSIONAL_IDENTITY_DOCUMENT_MAX_SIZE_BYTES + 1) }))
      .rejects.toMatchObject({ code: "DOCUMENT_TOO_LARGE" });
  });
});
