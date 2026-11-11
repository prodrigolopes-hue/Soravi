import { ConflictException } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";

export function serviceRequestPublicCodeYear(createdAt: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(createdAt));
}

export function formatServiceRequestPublicCode(year: number, sequence: number): string {
  return `SO${year}${String(sequence).padStart(3, "0")}`;
}

export function backfillServiceRequestPublicCodes(records: ReadonlyArray<{ id: string; createdAt: Date }>): Map<string, string> {
  const ordered = [...records].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
  const sequences = new Map<number, number>();
  return new Map(ordered.map((record) => {
    const year = serviceRequestPublicCodeYear(record.createdAt);
    const sequence = (sequences.get(year) ?? 0) + 1;
    sequences.set(year, sequence);
    return [record.id, formatServiceRequestPublicCode(year, sequence)];
  }));
}

export async function reserveServiceRequestPublicCode(transaction: Prisma.TransactionClient, createdAt: Date): Promise<string> {
  const year = serviceRequestPublicCodeYear(createdAt);
  const [counter] = await transaction.$queryRaw<{ lastSequence: number }[]>(Prisma.sql`
    INSERT INTO "service_request_public_code_counters" ("year", "last_sequence", "updated_at")
    VALUES (${year}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("year") DO UPDATE
    SET "last_sequence" = "service_request_public_code_counters"."last_sequence" + 1,
        "updated_at" = CURRENT_TIMESTAMP
    RETURNING "last_sequence" AS "lastSequence"
  `);
  if (!counter) throw new ConflictException("Não foi possível reservar o código público da solicitação.");
  return formatServiceRequestPublicCode(year, counter.lastSequence);
}
