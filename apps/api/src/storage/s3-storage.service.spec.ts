import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConfigService } from "@nestjs/config";

import { S3StorageService } from "./s3-storage.service";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

describe("S3StorageService", () => {
  const bucket = "soravi-private-test";
  const getSignedUrlMock = getSignedUrl as jest.MockedFunction<
    typeof getSignedUrl
  >;

  let sendMock: jest.Mock;
  let service: S3StorageService;

  beforeEach(() => {
    sendMock = jest.fn().mockResolvedValue({});

    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue(bucket),
    };

    service = new S3StorageService(
      { send: sendMock } as unknown as S3Client,
      configServiceMock as unknown as ConfigService,
    );

    getSignedUrlMock.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("envia o arquivo ao bucket privado com objectKey opaca", async () => {
    const body = new Uint8Array([1, 2, 3]);

    const result = await service.upload({
      body,
      contentType: "image/jpeg",
      sizeBytes: body.byteLength,
    });

    expect(result.objectKey).toMatch(
      /^objects\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  expect(result.objectKey).not.toContain("foto.jpg");
    expect(sendMock).toHaveBeenCalledTimes(1);

    const command = sendMock.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: result.objectKey,
      Body: body,
      ContentType: "image/jpeg",
      ContentLength: 3,
    });
    expect(command.input).not.toHaveProperty("ACL");
  });

  it("remove o objeto pela chave interna", async () => {
    await service.delete("objects/file-id");

    const command = sendMock.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: "objects/file-id",
    });
  });

  it("gera URL temporária de leitura sem tornar o objeto público", async () => {
    getSignedUrlMock.mockResolvedValue(
      "https://storage.example/signed-object",
    );

    const result = await service.createTemporaryReadUrl(
      "objects/file-id",
      300,
    );

    expect(result).toBe(
      "https://storage.example/signed-object",
    );
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);

    const [client, command, options] =
      getSignedUrlMock.mock.calls[0] ?? [];

    expect(client).toBeDefined();
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command?.input).toEqual({
      Bucket: bucket,
      Key: "objects/file-id",
    });
    expect(options).toEqual({ expiresIn: 300 });
  });
});
