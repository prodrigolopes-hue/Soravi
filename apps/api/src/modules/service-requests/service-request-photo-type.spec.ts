import { detectServiceRequestPhotoMimeType } from "./service-request-photo-type";

describe("detectServiceRequestPhotoMimeType", () => {
  it.each([
    ["JPEG", [0xff, 0xd8, 0xff, 0x00], "image/jpeg"],
    [
      "PNG",
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00],
      "image/png",
    ],
    [
      "WebP",
      [
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45,
        0x42, 0x50,
      ],
      "image/webp",
    ],
  ])("detecta %s pelos magic bytes", (_name, bytes, expectedMimeType) => {
    expect(detectServiceRequestPhotoMimeType(Uint8Array.from(bytes))).toBe(
      expectedMimeType,
    );
  });

  it("rejeita assinatura desconhecida", () => {
    expect(
      detectServiceRequestPhotoMimeType(
        Uint8Array.from([0x47, 0x49, 0x46, 0x38]),
      ),
    ).toBeNull();
  });
});