import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  Role,
  UserStatus,
} from "../src/generated/prisma/client";

const LOCAL_DATABASE_NAME = "soravi";
const INITIAL_ADMIN_ACTIVATION_ACTION = "INITIAL_ADMIN_ACTIVATED";
const INITIAL_ADMIN_ACTIVATION_CONFIRMATION = "ACTIVATE_INITIAL_ADMIN";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InitialAdminActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitialAdminActivationError";
  }
}

interface InitialAdminUserRecord {
  id: string;
  deletedAt: Date | null;
  status: UserStatus;
  roles: Array<{ role: Role }>;
}

interface InitialAdminActivationTransaction {
  user: {
    findFirst(args: {
      where: { id: string; emailNormalized: string };
      select: {
        id: true;
        deletedAt: true;
        status: true;
        roles: { select: { role: true } };
      };
    }): Promise<InitialAdminUserRecord | null>;
    updateMany(args: {
      where: { id: string; status: typeof UserStatus.PENDING };
      data: { status: typeof UserStatus.ACTIVE };
    }): Promise<{ count: number }>;
  };
  adminActivationAudit: {
    findUnique(args: {
      where: { userId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        userId: string;
        action: string;
        previousStatus: typeof UserStatus.PENDING;
        newStatus: typeof UserStatus.ACTIVE;
        justification: string;
        executionId: string;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
}

export interface InitialAdminActivationPrismaClient {
  $transaction<T>(
    operation: (transaction: InitialAdminActivationTransaction) => Promise<T>,
  ): Promise<T>;
  $disconnect(): Promise<void>;
}

export interface InitialAdminActivationInput {
  emailNormalized: string;
  userId: string;
  justification: string;
  executionId: string;
}

interface CommandDependencies {
  createPrisma: () => InitialAdminActivationPrismaClient;
  createExecutionId: () => string;
  log: (message: string) => void;
  logError: (message: string) => void;
}

export function normalizeInitialAdminEmail(value: string | undefined): string {
  const emailNormalized = value?.trim().toLowerCase() ?? "";

  if (!emailNormalized) {
    throw new InitialAdminActivationError(
      "Defina ADMIN_EMAIL com o e-mail da conta ADMIN inicial.",
    );
  }

  return emailNormalized;
}

export function validateInitialAdminUserId(value: string | undefined): string {
  const userId = value?.trim() ?? "";

  if (!UUID_PATTERN.test(userId)) {
    throw new InitialAdminActivationError(
      "Defina ADMIN_USER_ID com o ID UUID confirmado da conta ADMIN inicial.",
    );
  }

  return userId;
}

export function validateActivationJustification(
  value: string | undefined,
): string {
  const justification = value?.trim() ?? "";

  if (!justification || justification.length > 1000) {
    throw new InitialAdminActivationError(
      "Defina ADMIN_ACTIVATION_JUSTIFICATION com 1 a 1000 caracteres.",
    );
  }

  return justification;
}

export function validateActivationConfirmation(value: string | undefined): void {
  if (value !== INITIAL_ADMIN_ACTIVATION_CONFIRMATION) {
    throw new InitialAdminActivationError(
      `Defina ADMIN_ACTIVATION_CONFIRMATION como ${INITIAL_ADMIN_ACTIVATION_CONFIRMATION}.`,
    );
  }
}

export function validateActivationEnvironment(value: string | undefined): void {
  const environment = value?.trim().toLowerCase();

  if (environment === "production" || environment === "staging") {
    throw new InitialAdminActivationError(
      "A ativação inicial de ADMIN não pode ser executada em production ou staging.",
    );
  }
}

export function validateLocalDatabaseUrl(
  value: string | undefined,
  databaseConfirmation: string | undefined,
): string {
  if (!value?.trim() || databaseConfirmation !== LOCAL_DATABASE_NAME) {
    throw new InitialAdminActivationError(
      "A ativação só pode usar o banco local explicitamente confirmado.",
    );
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(value);
  } catch {
    throw new InitialAdminActivationError(
      "A ativação só pode usar o banco local explicitamente confirmado.",
    );
  }

  const databaseName = databaseUrl.pathname.replace(/^\//, "");
  const isLocalHost =
    databaseUrl.hostname === "localhost" || databaseUrl.hostname === "127.0.0.1";
  const usesPostgres =
    databaseUrl.protocol === "postgresql:" || databaseUrl.protocol === "postgres:";
  const usesLocalPort = databaseUrl.port === "" || databaseUrl.port === "5432";

  if (
    !usesPostgres ||
    !isLocalHost ||
    !usesLocalPort ||
    databaseName !== LOCAL_DATABASE_NAME
  ) {
    throw new InitialAdminActivationError(
      "A ativação só pode usar o banco local explicitamente confirmado.",
    );
  }

  return value;
}

export async function activateInitialAdmin(
  prisma: InitialAdminActivationPrismaClient,
  input: InitialAdminActivationInput,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findFirst({
      where: {
        id: input.userId,
        emailNormalized: input.emailNormalized,
      },
      select: {
        id: true,
        deletedAt: true,
        status: true,
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new InitialAdminActivationError(
        "Conta ADMIN inicial não encontrada para o e-mail e ID informados.",
      );
    }

    if (user.deletedAt !== null) {
      throw new InitialAdminActivationError(
        "A conta ADMIN inicial está excluída e não pode ser ativada.",
      );
    }

    if (!user.roles.some(({ role }) => role === Role.ADMIN)) {
      throw new InitialAdminActivationError(
        "A conta informada não possui o papel ADMIN.",
      );
    }

    if (user.status !== UserStatus.PENDING) {
      throw new InitialAdminActivationError(
        "A conta ADMIN inicial deve estar com status PENDING.",
      );
    }

    const existingAudit = await transaction.adminActivationAudit.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (existingAudit) {
      throw new InitialAdminActivationError(
        "A conta ADMIN inicial já possui registro de ativação.",
      );
    }

    const updateResult = await transaction.user.updateMany({
      where: { id: user.id, status: UserStatus.PENDING },
      data: { status: UserStatus.ACTIVE },
    });

    if (updateResult.count !== 1) {
      throw new InitialAdminActivationError(
        "A conta ADMIN inicial não estava mais PENDING para ativação.",
      );
    }

    await transaction.adminActivationAudit.create({
      data: {
        userId: user.id,
        action: INITIAL_ADMIN_ACTIVATION_ACTION,
        previousStatus: UserStatus.PENDING,
        newStatus: UserStatus.ACTIVE,
        justification: input.justification,
        executionId: input.executionId,
      },
      select: { id: true },
    });
  });
}

function createProductionPrisma(): InitialAdminActivationPrismaClient {
  const connectionString = validateLocalDatabaseUrl(
    process.env.DATABASE_URL,
    process.env.ADMIN_ACTIVATION_DATABASE,
  );

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  }) as unknown as InitialAdminActivationPrismaClient;
}

export async function runActivateInitialAdminCommand(
  dependencies: CommandDependencies = {
    createPrisma: createProductionPrisma,
    createExecutionId: randomUUID,
    log: console.log,
    logError: console.error,
  },
): Promise<number> {
  let prisma: InitialAdminActivationPrismaClient | null = null;

  try {
    const emailNormalized = normalizeInitialAdminEmail(process.env.ADMIN_EMAIL);
    const userId = validateInitialAdminUserId(process.env.ADMIN_USER_ID);
    const justification = validateActivationJustification(
      process.env.ADMIN_ACTIVATION_JUSTIFICATION,
    );
    validateActivationConfirmation(process.env.ADMIN_ACTIVATION_CONFIRMATION);
    validateActivationEnvironment(process.env.NODE_ENV);
    validateLocalDatabaseUrl(
      process.env.DATABASE_URL,
      process.env.ADMIN_ACTIVATION_DATABASE,
    );
    prisma = dependencies.createPrisma();

    await activateInitialAdmin(prisma, {
      emailNormalized,
      userId,
      justification,
      executionId: dependencies.createExecutionId(),
    });

    dependencies.log("Conta ADMIN inicial ativada com auditoria registrada.");
    return 0;
  } catch (error) {
    const message =
      error instanceof InitialAdminActivationError
        ? error.message
        : "Não foi possível ativar a conta ADMIN inicial.";
    dependencies.logError(message);
    return 1;
  } finally {
    await prisma?.$disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  void runActivateInitialAdminCommand().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
