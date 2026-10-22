import type sharpFactory from "sharp";

const sharp: typeof sharpFactory = require("sharp");

import {
  PROFESSIONAL_PROFILE_PHOTO_MAX_INPUT_PIXELS,
  PROFESSIONAL_PROFILE_PHOTO_MAX_SIZE_BYTES,
  PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION,
  ProfessionalProfilePhotoProcessingError,
  processProfessionalProfilePhoto,
} from "./professional-profile-photo-image";

describe("processProfessionalProfilePhoto", () => {
  it.each([
    ["JPEG", "jpeg", "image/jpeg"],
    ["PNG", "png", "image/png"],
    ["WebP", "webp", "image/webp"],
  ] as const)("aceita %s pelo conteúdo e produz WebP normalizado", async (_name, format, declaredMimeType) => {
    const source = await syntheticImage(format);

    const result = await processProfessionalProfilePhoto({
      buffer: source,
      declaredMimeType,
    });

    expect(result.mimeType).toBe("image/webp");
    expect(result.width).toBe(PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION);
    expect(result.height).toBe(PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION);
    expect(result.sizeBytes).toBe(result.buffer.length);
    await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({
      format: "webp",
      width: PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION,
      height: PROFESSIONAL_PROFILE_PHOTO_OUTPUT_DIMENSION,
    });
  });

  it("rejeita MIME declarado diferente do formato detectado", async () => {
    await expect(
      processProfessionalProfilePhoto({
        buffer: await syntheticImage("jpeg"),
        declaredMimeType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PHOTO" });
  });

  it("rejeita imagem corrompida sem expor conteúdo", async () => {
    await expect(
      processProfessionalProfilePhoto({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      }),
    ).rejects.toEqual(
      new ProfessionalProfilePhotoProcessingError("INVALID_PHOTO"),
    );
  });

  it("rejeita formato não permitido", async () => {
    await expect(
      processProfessionalProfilePhoto({
        buffer: Buffer.from("GIF89a", "ascii"),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_PHOTO_FORMAT" });
  });

  it("rejeita imagens animadas ou multipágina", async () => {
    const firstFrame = await syntheticImage("png", 256, 256, "#0f766e");
    const secondFrame = await syntheticImage("png", 256, 256, "#be123c");
    const animatedWebp = await sharp([firstFrame, secondFrame], {
      join: { animated: true },
    }).webp().toBuffer();

    await expect(
      processProfessionalProfilePhoto({
        buffer: animatedWebp,
        declaredMimeType: "image/webp",
      }),
    ).rejects.toMatchObject({ code: "ANIMATED_PHOTO" });
  });

  it("rejeita tamanho real acima de 5 MiB antes de decodificar", async () => {
    await expect(
      processProfessionalProfilePhoto({
        buffer: Buffer.alloc(PROFESSIONAL_PROFILE_PHOTO_MAX_SIZE_BYTES + 1),
      }),
    ).rejects.toMatchObject({ code: "PHOTO_TOO_LARGE" });
  });

  it("rejeita dimensões menores que 128 pixels", async () => {
    await expect(
      processProfessionalProfilePhoto({
        buffer: await syntheticImage("png", 127, 128),
      }),
    ).rejects.toMatchObject({ code: "PHOTO_DIMENSIONS_OUT_OF_RANGE" });
  });

  it("rejeita dimensão acima de 8.000 pixels", async () => {
    await expect(
      processProfessionalProfilePhoto({
        buffer: await syntheticImage("png", 8_001, 128),
      }),
    ).rejects.toMatchObject({ code: "PHOTO_DIMENSIONS_OUT_OF_RANGE" });
  });

  it("fixa o limite de decodificação em 40 milhões de pixels", () => {
    expect(PROFESSIONAL_PROFILE_PHOTO_MAX_INPUT_PIXELS).toBe(40_000_000);
  });

  it("rejeita um cabeçalho PNG que excede o limite de pixels antes de alocar a imagem", async () => {
    const oversizedHeader = withPngDimensions(
      await syntheticImage("png", 1, 1),
      8_000,
      5_001,
    );

    await expect(
      processProfessionalProfilePhoto({ buffer: oversizedHeader }),
    ).rejects.toMatchObject({ code: "INVALID_PHOTO" });
  });

  it("remove EXIF, orientação e GPS ao reprocessar", async () => {
    const source = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: "#0369a1",
      },
    })
      .withMetadata({
        orientation: 6,
        exif: {
          IFD0: { Artist: "synthetic-fixture" },
          IFD3: {
            GPSLatitudeRef: "N",
            GPSLatitude: "1/1 2/1 3/1",
            GPSLongitudeRef: "E",
            GPSLongitude: "4/1 5/1 6/1",
          },
        },
      })
      .jpeg()
      .toBuffer();

    const result = await processProfessionalProfilePhoto({ buffer: source });
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(result.buffer.includes(Buffer.from("GPS", "ascii"))).toBe(false);
  });
});

async function syntheticImage(
  format: "jpeg" | "png" | "webp",
  width = 320,
  height = 192,
  background = "#1d4ed8",
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background },
  })
    .toFormat(format)
    .toBuffer();
}

function withPngDimensions(source: Buffer, width: number, height: number): Buffer {
  const copy = Buffer.from(source);
  copy.writeUInt32BE(width, 16);
  copy.writeUInt32BE(height, 20);
  copy.writeUInt32BE(crc32(copy.subarray(12, 29)), 29);
  return copy;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
