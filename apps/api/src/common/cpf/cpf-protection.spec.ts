import {
  type CpfProtectionKeys,
  CpfProtectionConfigurationError,
  CpfProtectionError,
  createCpfProtector,
} from "./cpf-protection";

const encryptionKey = Buffer.alloc(32, 1);
const hmacKey = Buffer.alloc(32, 2);

function createProtector() {
  return createCpfProtector({
    encryptionKey,
    hmacKey,
    encryptionKeyId: "cpf-test-v1",
  });
}

describe("createCpfProtector", () => {
  it("cifra e decifra o CPF canônico", () => {
    const protector = createProtector();
    const envelope = protector.encrypt("529.982.247-25");

    expect(envelope).toMatchObject({
      formatVersion: 1,
      encryptionKeyId: "cpf-test-v1",
    });
    expect(protector.decrypt(envelope)).toBe("52998224725");
  });

  it("usa um nonce novo para cada cifragem do mesmo CPF", () => {
    const protector = createProtector();
    const firstEnvelope = protector.encrypt("52998224725");
    const secondEnvelope = protector.encrypt("52998224725");

    expect(secondEnvelope.nonce).not.toBe(firstEnvelope.nonce);
    expect(secondEnvelope.ciphertext).not.toBe(firstEnvelope.ciphertext);
  });

  it("rejeita envelope adulterado", () => {
    const protector = createProtector();
    const envelope = protector.encrypt("52998224725");

    expect(() =>
      protector.decrypt({ ...envelope, tag: "AAAAAAAAAAAAAAAAAAAAAA" }),
    ).toThrow(CpfProtectionError);
  });

  it.each([
    ["nonce", "A".repeat(15)],
    ["ciphertext", "A".repeat(14)],
    ["tag", "A".repeat(21)],
  ])("rejeita %s com comprimento Base64URL incorreto", (field, value) => {
    const protector = createProtector();
    const envelope = protector.encrypt("52998224725");

    expect(() => protector.decrypt({ ...envelope, [field]: value })).toThrow(
      CpfProtectionError,
    );
  });

  it("rejeita um campo do envelope excessivamente longo antes da decodificação", () => {
    const protector = createProtector();
    const envelope = protector.encrypt("52998224725");

    expect(() =>
      protector.decrypt({ ...envelope, nonce: "A".repeat(100_000) }),
    ).toThrow(CpfProtectionError);
  });

  it("rejeita Base64URL não canônico", () => {
    const protector = createProtector();
    const envelope = protector.encrypt("52998224725");
    const nonCanonicalTag = replaceLastBase64UrlCharacter(envelope.tag);

    expect(
      Buffer.from(nonCanonicalTag, "base64url").equals(
        Buffer.from(envelope.tag, "base64url"),
      ),
    ).toBe(true);
    expect(() =>
      protector.decrypt({ ...envelope, tag: nonCanonicalTag }),
    ).toThrow(CpfProtectionError);
  });

  it("rejeita a decifragem com chave de cifra incorreta", () => {
    const envelope = createProtector().encrypt("52998224725");
    const protectorWithWrongKey = createCpfProtector({
      encryptionKey: Buffer.alloc(32, 3),
      hmacKey,
      encryptionKeyId: "cpf-test-v1",
    });

    expect(() => protectorWithWrongKey.decrypt(envelope)).toThrow(
      CpfProtectionError,
    );
  });

  it("calcula o mesmo HMAC para formatos equivalentes", () => {
    const protector = createProtector();

    expect(protector.hmac("52998224725")).toBe(protector.hmac("529.982.247-25"));
  });

  it.each([
    {
      encryptionKey: Buffer.alloc(31, 1),
      hmacKey,
      encryptionKeyId: "cpf-test-v1",
    },
    {
      encryptionKey,
      hmacKey: Buffer.alloc(31, 2),
      encryptionKeyId: "cpf-test-v1",
    },
    {
      encryptionKey,
      hmacKey: Buffer.alloc(32, 1),
      encryptionKeyId: "cpf-test-v1",
    },
    {
      encryptionKey,
      hmacKey,
      encryptionKeyId: "",
    },
  ])("rejeita material de chave inválido ou reutilizado", (keys) => {
    expect(() => createCpfProtector(keys)).toThrow(CpfProtectionConfigurationError);
  });

  it("rejeita encryptionKeyId ausente", () => {
    const keys = { encryptionKey, hmacKey } as unknown as CpfProtectionKeys;

    expect(() => createCpfProtector(keys)).toThrow(
      CpfProtectionConfigurationError,
    );
  });

  it.each([undefined, 1, {}, []])(
    "rejeita encryptionKeyId de outro tipo",
    (encryptionKeyId) => {
      const keys = {
        encryptionKey,
        hmacKey,
        encryptionKeyId,
      } as unknown as CpfProtectionKeys;

      expect(() => createCpfProtector(keys)).toThrow(
        CpfProtectionConfigurationError,
      );
    },
  );
});

function replaceLastBase64UrlCharacter(value: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const lastCharacterIndex = alphabet.indexOf(value.at(-1) ?? "");
  const nonCanonicalCharacter = alphabet[(lastCharacterIndex & 0b110000) | 1];

  return value.slice(0, -1) + nonCanonicalCharacter;
}
