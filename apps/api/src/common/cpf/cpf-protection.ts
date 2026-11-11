import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { normalizeCpf } from "./cpf";

const ENVELOPE_FORMAT_VERSION = 1;
const AES_256_KEY_LENGTH = 32;
const GCM_NONCE_LENGTH = 12;
const GCM_AUTH_TAG_LENGTH = 16;
const GCM_NONCE_BASE64URL_LENGTH = 16;
const CPF_CIPHERTEXT_LENGTH = 11;
const CPF_CIPHERTEXT_BASE64URL_LENGTH = 15;
const GCM_AUTH_TAG_BASE64URL_LENGTH = 22;
const MINIMUM_HMAC_KEY_LENGTH = 32;
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const CPF_HMAC_DOMAIN = "soravi:cpf:hmac:v1\0";
const CPF_HMAC_KEY_FINGERPRINT_DOMAIN =
  "soravi:cpf:hmac-key-fingerprint:v1\0";

export interface CpfProtectionKeys {
  encryptionKey: Uint8Array;
  hmacKey: Uint8Array;
  encryptionKeyId: string;
}

export interface EncryptedCpfEnvelope {
  formatVersion: typeof ENVELOPE_FORMAT_VERSION;
  encryptionKeyId: string;
  nonce: string;
  ciphertext: string;
  tag: string;
}

export interface CpfProtector {
  encrypt(cpf: string): EncryptedCpfEnvelope;
  decrypt(envelope: unknown): string;
  hmac(cpf: string): string;
  hmacKeyFingerprint(): string;
}

export class CpfProtectionConfigurationError extends Error {
  constructor() {
    super("Configuração de proteção de CPF inválida.");
    this.name = "CpfProtectionConfigurationError";
  }
}

export class CpfProtectionError extends Error {
  constructor() {
    super("Não foi possível processar o CPF com segurança.");
    this.name = "CpfProtectionError";
  }
}

/** Verifica o formato de identificadores de versões de chaves de CPF. */
export function isCpfProtectionKeyId(value: unknown): value is string {
  return typeof value === "string" && KEY_ID_PATTERN.test(value);
}

/**
 * Cria operações de proteção de CPF com material de chave fornecido pelo
 * chamador. Esta fábrica não lê configuração nem mantém chaves implícitas.
 */
export function createCpfProtector(keys: CpfProtectionKeys): CpfProtector {
  const validatedKeys = validateKeys(keys);

  return {
    encrypt(cpf: string): EncryptedCpfEnvelope {
      const canonicalCpf = normalizeCpf(cpf);
      const nonce = randomBytes(GCM_NONCE_LENGTH);
      const cipher = createCipheriv(
        "aes-256-gcm",
        validatedKeys.encryptionKey,
        nonce,
      );
      const metadata = envelopeMetadata(
        ENVELOPE_FORMAT_VERSION,
        validatedKeys.encryptionKeyId,
      );

      cipher.setAAD(metadata);

      const ciphertext = Buffer.concat([
        cipher.update(canonicalCpf, "utf8"),
        cipher.final(),
      ]);

      return {
        formatVersion: ENVELOPE_FORMAT_VERSION,
        encryptionKeyId: validatedKeys.encryptionKeyId,
        nonce: nonce.toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
      };
    },

    decrypt(envelope: unknown): string {
      try {
        const parsedEnvelope = parseEnvelope(
          envelope,
          validatedKeys.encryptionKeyId,
        );
        const decipher = createDecipheriv(
          "aes-256-gcm",
          validatedKeys.encryptionKey,
          parsedEnvelope.nonce,
        );

        decipher.setAAD(
          envelopeMetadata(
            parsedEnvelope.formatVersion,
            parsedEnvelope.encryptionKeyId,
          ),
        );
        decipher.setAuthTag(parsedEnvelope.tag);

        const canonicalCpf = Buffer.concat([
          decipher.update(parsedEnvelope.ciphertext),
          decipher.final(),
        ]).toString("utf8");

        return normalizeCpf(canonicalCpf);
      } catch {
        throw new CpfProtectionError();
      }
    },

    hmac(cpf: string): string {
      const canonicalCpf = normalizeCpf(cpf);

      return createHmac("sha256", validatedKeys.hmacKey)
        .update(CPF_HMAC_DOMAIN, "utf8")
        .update(canonicalCpf, "utf8")
        .digest("hex");
    },

    hmacKeyFingerprint(): string {
      return createHmac("sha256", validatedKeys.hmacKey)
        .update(CPF_HMAC_KEY_FINGERPRINT_DOMAIN, "utf8")
        .digest("hex");
    },
  };
}

function validateKeys(keys: CpfProtectionKeys): {
  encryptionKey: Buffer;
  hmacKey: Buffer;
  encryptionKeyId: string;
} {
  if (
    !keys ||
    typeof keys !== "object" ||
    !isCpfProtectionKeyId(keys.encryptionKeyId)
  ) {
    throw new CpfProtectionConfigurationError();
  }

  const encryptionKey = toKeyBuffer(keys.encryptionKey);
  const hmacKey = toKeyBuffer(keys.hmacKey);

  if (
    encryptionKey.length !== AES_256_KEY_LENGTH ||
    hmacKey.length < MINIMUM_HMAC_KEY_LENGTH ||
    areEqualKeys(encryptionKey, hmacKey)
  ) {
    throw new CpfProtectionConfigurationError();
  }

  return {
    encryptionKey,
    hmacKey,
    encryptionKeyId: keys.encryptionKeyId,
  };
}

function toKeyBuffer(key: unknown): Buffer {
  if (!(key instanceof Uint8Array)) {
    throw new CpfProtectionConfigurationError();
  }

  return Buffer.from(key);
}

function areEqualKeys(firstKey: Buffer, secondKey: Buffer): boolean {
  return firstKey.length === secondKey.length && timingSafeEqual(firstKey, secondKey);
}

function parseEnvelope(
  envelope: unknown,
  expectedKeyId: string,
): {
  formatVersion: typeof ENVELOPE_FORMAT_VERSION;
  encryptionKeyId: string;
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
} {
  if (
    !isEncryptedCpfEnvelope(envelope) ||
    envelope.encryptionKeyId !== expectedKeyId
  ) {
    throw new CpfProtectionError();
  }

  const nonce = decodeBase64Url(
    envelope.nonce,
    GCM_NONCE_BASE64URL_LENGTH,
    GCM_NONCE_LENGTH,
  );
  const ciphertext = decodeBase64Url(
    envelope.ciphertext,
    CPF_CIPHERTEXT_BASE64URL_LENGTH,
    CPF_CIPHERTEXT_LENGTH,
  );
  const tag = decodeBase64Url(
    envelope.tag,
    GCM_AUTH_TAG_BASE64URL_LENGTH,
    GCM_AUTH_TAG_LENGTH,
  );

  return { ...envelope, nonce, ciphertext, tag };
}

function isEncryptedCpfEnvelope(value: unknown): value is EncryptedCpfEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const envelope = value as Record<string, unknown>;

  return (
    envelope.formatVersion === ENVELOPE_FORMAT_VERSION &&
    typeof envelope.encryptionKeyId === "string" &&
    isCpfProtectionKeyId(envelope.encryptionKeyId) &&
    typeof envelope.nonce === "string" &&
    typeof envelope.ciphertext === "string" &&
    typeof envelope.tag === "string"
  );
}

function decodeBase64Url(
  value: string,
  expectedEncodedLength: number,
  expectedDecodedLength: number,
): Buffer {
  if (
    value.length !== expectedEncodedLength ||
    !BASE64URL_PATTERN.test(value)
  ) {
    throw new CpfProtectionError();
  }

  const decoded = Buffer.from(value, "base64url");

  if (
    decoded.length !== expectedDecodedLength ||
    decoded.toString("base64url") !== value
  ) {
    throw new CpfProtectionError();
  }

  return decoded;
}

function envelopeMetadata(formatVersion: number, encryptionKeyId: string): Buffer {
  return Buffer.from(
    JSON.stringify({ formatVersion, encryptionKeyId }),
    "utf8",
  );
}
