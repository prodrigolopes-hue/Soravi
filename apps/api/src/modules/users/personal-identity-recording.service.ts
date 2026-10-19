import { Injectable } from "@nestjs/common";

import { CpfProtector, isCpfProtectionKeyId } from "../../common/cpf/cpf-protection";
import { normalizeCpf } from "../../common/cpf/cpf";
import { lockUser } from "../../database/user-transaction-lock";
import { PrismaService } from "../../database/prisma.service";
import { Prisma, UserStatus } from "../../generated/prisma/client";
import { PersonalIdentityChangeUnavailableException } from "./errors/personal-identity-change-unavailable.exception";
import { PersonalIdentityCpfUnavailableException } from "./errors/personal-identity-cpf-unavailable.exception";
import { PersonalIdentityKeyUnavailableException } from "./errors/personal-identity-key-unavailable.exception";
import { PersonalIdentityPersistenceException } from "./errors/personal-identity-persistence.exception";
import { PersonalIdentityUnavailableException } from "./errors/personal-identity-unavailable.exception";

export interface PersonalIdentityRecordingResult { recorded: true; }

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
    try {
      await this.prisma.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const user = await transaction.user.findFirst({
          where: { id: userId, deletedAt: null, status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] } },
          select: { id: true, personalIdentity: { select: { cpfHmac: true, hmacKeyId: true } } },
        });
        if (!user) throw new PersonalIdentityUnavailableException();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
