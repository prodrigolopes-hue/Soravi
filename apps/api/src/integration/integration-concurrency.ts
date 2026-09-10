import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

export interface PrismaGates {
  transactionStarted?: (backendPid: number) => void;
  afterUserUpdate?: () => Promise<void>;
  beforeUserUpdate?: () => void;
  afterUserFindFirst?: (result: unknown) => void;
  beforeQueryRaw?: (args: readonly unknown[]) => void;
  afterQueryRaw?: (
    args: readonly unknown[],
    result: unknown,
  ) => Promise<void>;
}

interface BackendPidRow {
  backendPid: number;
}

interface BlockingPidsRow {
  blockingPids: number[];
}

export function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

export function queryRawSql(args: readonly unknown[]): string {
  const query = args[0];
  if (typeof query !== "object" || query === null || !("strings" in query)) {
    return "";
  }
  const strings = query.strings;
  return Array.isArray(strings) ? strings.join(" ") : "";
}

function wrapDelegate(
  delegate: object,
  operation: "findFirst" | "update",
  gates: PrismaGates,
): object {
  return new Proxy(delegate, {
    get(target, property, receiver) {
      const original = Reflect.get(target, property, receiver);
      if (property !== operation || typeof original !== "function") {
        return typeof original === "function" ? original.bind(target) : original;
      }
      return async (...args: unknown[]) => {
        if (operation === "update") gates.beforeUserUpdate?.();
        const result: unknown = await Reflect.apply(original, target, args);
        if (operation === "findFirst") gates.afterUserFindFirst?.(result);
        else await gates.afterUserUpdate?.();
        return result;
      };
    },
  });
}

function wrapTransaction(
  transaction: Prisma.TransactionClient,
  gates: PrismaGates,
): Prisma.TransactionClient {
  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property === "user") return wrapDelegate(target.user, "update", gates);
      if (property === "$queryRaw") {
        return async (...args: unknown[]) => {
          gates.beforeQueryRaw?.(args);
          const original = Reflect.get(target, property, receiver);
          const result: unknown = await Reflect.apply(original, target, args);
          await gates.afterQueryRaw?.(args, result);
          return result;
        };
      }
      const original = Reflect.get(target, property, receiver);
      return typeof original === "function" ? original.bind(target) : original;
    },
  }) as Prisma.TransactionClient;
}

export function wrapPrisma(
  prisma: PrismaService,
  gates: PrismaGates,
): PrismaService {
  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property === "user" && gates.afterUserFindFirst) {
        return wrapDelegate(target.user, "findFirst", gates);
      }
      if (property === "$transaction") {
        return async (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
          options?: {
            maxWait?: number;
            timeout?: number;
            isolationLevel?: Prisma.TransactionIsolationLevel;
          },
        ) => target.$transaction(async (transaction) => {
          if (gates.transactionStarted) {
            const [row] = await transaction.$queryRaw<BackendPidRow[]>(
              Prisma.sql`SELECT pg_backend_pid() AS "backendPid"`,
            );
            if (!row) {
              throw new Error("Não foi possível identificar a transação concorrente.");
            }
            gates.transactionStarted(row.backendPid);
          }
          return callback(wrapTransaction(transaction, gates));
        }, options);
      }
      const original = Reflect.get(target, property, receiver);
      return typeof original === "function" ? original.bind(target) : original;
    },
  });
}

export async function waitUntilPostgresConfirmsBlocking(
  controlPrisma: PrismaService,
  blockedBackendPid: number,
): Promise<void> {
  const maximumChecks = 10_000;
  for (let check = 0; check < maximumChecks; check += 1) {
    const [row] = await controlPrisma.$queryRaw<BlockingPidsRow[]>(
      Prisma.sql`
        SELECT pg_blocking_pids(${blockedBackendPid}) AS "blockingPids"
      `,
    );
    if (row && row.blockingPids.length > 0) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(
    "PostgreSQL não confirmou a contenção esperada via pg_blocking_pids.",
  );
}
