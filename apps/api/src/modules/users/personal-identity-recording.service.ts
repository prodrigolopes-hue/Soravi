import { Injectable } from "@nestjs/common";

import { CpfProtector, isCpfProtectionKeyId } from "../../common/cpf/cpf-protection";
import { normalizeCpf } from "../../common/cpf/cpf";
import { lockUser } from "../../database/user-transaction-lock";
import { PrismaService } from "../../database/prisma.service";
import {
  CpfHmacKeyBindingState,
  Prisma,
  UserStatus,
} from "../../generated/prisma/client";
import { PersonalIdentityChangeUnavailableException } from "./errors/personal-identity-change-unavailable.exception";
import { PersonalIdentityCpfUnavailableException } from "./errors/personal-identity-cpf-unavailable.exception";
import { PersonalIdentityKeyUnavailableException } from "./errors/personal-identity-key-unavailable.exception";
import { PersonalIdentityPersistenceException } from "./errors/personal-identity-persistence.exception";
import { PersonalIdentityUnavailableException } from "./errors/personal-identity-unavailable.exception";

export interface PersonalIdentityRecordingResult { recorded: true; }

const CPF_HMAC_KEY_BINDING_SCOPE = "personal_identity_cpf";

@Injectable()
export class PersonalIdentityRecordingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cpfProtector: CpfProtector,
    private readonly hmacKeyId: string,
  ) {
    if (!isCpfProtectionKeyId(hmacKeyId)) throw new Error("Invalid CPF HMAC key identifier.");
  }

  async recordInitial(userId: string, cpf: string): Promise<PersonalIdentityRecordingResult> {
    const normalizedCpf = normalizeCpf(cpf);
    const cpfHmac = this.cpfProtector.hmac(normalizedCpf);
    const hmacKeyFingerprint = this.cpfProtector.hmacKeyFingerprint();
    try {
      await this.prisma.$transaction(async (transaction) => {
        await lockCpfHmacKeyBinding(transaction);
        const binding = await transaction.cpfHmacKeyBinding.findUnique({
          where: { scope: CPF_HMAC_KEY_BINDING_SCOPE },
          select: { state: true, hmacKeyId: true, hmacKeyFingerprint: true },
        });
        if (!binding) throw new PersonalIdentityKeyUnavailableException();

        await lockUser(transaction, userId);
        const user = await transaction.user.findFirst({
          where: { id: userId, deletedAt: null, status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] } },
          select: { id: true, personalIdentity: { select: { cpfHmac: true, hmacKeyId: true } } },
        });
        if (!user) throw new PersonalIdentityUnavailableException();

        if (binding.state === CpfHmacKeyBindingState.BOUND) {
          if (
            binding.hmacKeyId !== this.hmacKeyId ||
            binding.hmacKeyFingerprint !== hmacKeyFingerprint
          ) {
            throw new PersonalIdentityKeyUnavailableException();
          }
        } else if (binding.state === CpfHmacKeyBindingState.ADOPTION_REQUIRED) {
          throw new PersonalIdentityKeyUnavailableException();
        } else if (binding.state === CpfHmacKeyBindingState.UNINITIALIZED) {
          const identityExists = await transaction.personalIdentity.count();
          if (identityExists > 0) throw new PersonalIdentityKeyUnavailableException();

          await transaction.cpfHmacKeyBinding.update({
            where: { scope: CPF_HMAC_KEY_BINDING_SCOPE },
            data: {
              state: CpfHmacKeyBindingState.BOUND,
              hmacKeyId: this.hmacKeyId,
              hmacKeyFingerprint,
            },
          });
        } else {
          throw new PersonalIdentityKeyUnavailableException();
        }

        if (user.personalIdentity) {
          if (user.personalIdentity.hmacKeyId !== this.hmacKeyId) throw new PersonalIdentityKeyUnavailableException();
          if (user.personalIdentity.cpfHmac !== cpfHmac) throw new PersonalIdentityChangeUnavailableException();
          return;
        }
        const usedByAnotherAccount = await transaction.personalIdentity.findFirst({ where: { cpfHmac }, select: { userId: true } });
        if (usedByAnotherAccount) throw new PersonalIdentityCpfUnavailableException();
        const encryptedCpf = this.cpfProtector.encrypt(normalizedCpf);
        const cpfEnvelope = {
          formatVersion: encryptedCpf.formatVersion,
          encryptionKeyId: encryptedCpf.encryptionKeyId,
          nonce: encryptedCpf.nonce,
          ciphertext: encryptedCpf.ciphertext,
          tag: encryptedCpf.tag,
        } satisfies Prisma.InputJsonObject;
        await transaction.personalIdentity.create({
          data: { userId, cpfEnvelope, cpfHmac, hmacKeyId: this.hmacKeyId },
        });
      });
    } catch (error: unknown) {
      if (this.isCpfHmacUniqueConstraintError(error)) throw new PersonalIdentityCpfUnavailableException();
      if (error instanceof Prisma.PrismaClientKnownRequestError) throw new PersonalIdentityPersistenceException();
      throw error;
    }
    return { recorded: true };
  }

  private isCpfHmacUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
    const meta = error.meta;
    if (!isRecord(meta) || meta.modelName !== "PersonalIdentity") return false;
    const driverAdapterError = meta.driverAdapterError;
    if (!isRecord(driverAdapterError) || !isRecord(driverAdapterError.cause)) return false;
    const cause = driverAdapterError.cause;
    if (cause.kind !== "UniqueConstraintViolation" || !isRecord(cause.constraint)) return false;
    const fields = cause.constraint.fields;
    return Array.isArray(fields) && fields.length === 1 && fields[0] === "cpf_hmac";
  }
}

async function lockCpfHmacKeyBinding(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT "scope"
    FROM "cpf_hmac_key_bindings"
    WHERE "scope" = ${CPF_HMAC_KEY_BINDING_SCOPE}
    FOR UPDATE
  `);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
