import { stdin, stdout } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import { argon2id, hash as argon2Hash } from "argon2";

import {
  PrismaClient,
  Role,
} from "../src/generated/prisma/client";

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

export class AdminPasswordOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPasswordOperationError";
  }
}

interface AdminUserRecord {
  id: string;
  deletedAt: Date | null;
  roles: Array<{ role: Role }>;
}

interface AdminPasswordTransaction {
  user: {
    findUnique(args: {
      where: { emailNormalized: string };
      select: {
        id: true;
        deletedAt: true;
        roles: { select: { role: true } };
      };
    }): Promise<AdminUserRecord | null>;
    update(args: {
      where: { id: string };
      data: { passwordHash: string };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  authSession: {
    updateMany(args: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
  };
  passwordResetToken: {
    updateMany(args: {
      where: { userId: string; usedAt: null };
      data: { usedAt: Date };
    }): Promise<{ count: number }>;
  };
}

export interface AdminPasswordPrismaClient {
  $transaction<T>(
    operation: (transaction: AdminPasswordTransaction) => Promise<T>,
  ): Promise<T>;
  $disconnect(): Promise<void>;
}

type PasswordHashFunction = (
  password: string,
  options: { type: typeof argon2id },
) => Promise<string>;

export function normalizeAdminEmail(value: string | undefined): string {
  const normalizedEmail = value?.trim().toLowerCase() ?? "";

  if (!normalizedEmail) {
    throw new AdminPasswordOperationError(
      "Defina ADMIN_EMAIL com o e-mail da conta ADMIN.",
    );
  }

  return normalizedEmail;
}

export function validateDatabaseUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new AdminPasswordOperationError(
      "DATABASE_URL não está definida no ambiente.",
    );
  }

  return value;
}

export function validateAdminPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AdminPasswordOperationError(
      "A nova senha deve ter pelo menos 12 caracteres.",
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new AdminPasswordOperationError(
      "A nova senha deve ter no máximo 128 caracteres.",
    );
  }

  if (!/[A-Za-zÀ-ÿ]/u.test(password)) {
    throw new AdminPasswordOperationError(
      "A nova senha deve possuir pelo menos uma letra.",
    );
  }

  if (!/[0-9]/u.test(password)) {
    throw new AdminPasswordOperationError(
      "A nova senha deve possuir pelo menos um número.",
    );
  }
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): void {
  if (password !== confirmation) {
    throw new AdminPasswordOperationError(
      "A confirmação da nova senha não coincide.",
    );
  }
}

export async function setAdminPassword(
  prisma: AdminPasswordPrismaClient,
  emailNormalized: string,
  password: string,
  hashPassword: PasswordHashFunction = argon2Hash,
): Promise<void> {
  validateAdminPassword(password);

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { emailNormalized },
      select: {
        id: true,
        deletedAt: true,
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new AdminPasswordOperationError(
        "Conta ADMIN não encontrada.",
      );
    }

    if (user.deletedAt !== null) {
      throw new AdminPasswordOperationError(
        "A conta ADMIN está excluída e não pode ser alterada.",
      );
    }

    if (!user.roles.some(({ role }) => role === Role.ADMIN)) {
      throw new AdminPasswordOperationError(
        "A conta informada não possui o papel ADMIN.",
      );
    }

    const passwordHash = await hashPassword(password, {
      type: argon2id,
    });
    const now = new Date();

    await transaction.user.update({
      where: { id: user.id },
      data: { passwordHash },
      select: { id: true },
    });

    await transaction.authSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    await transaction.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });
  });
}

export async function readHiddenLine(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    throw new AdminPasswordOperationError(
      "Execute o script em um terminal interativo com suporte a entrada oculta.",
    );
  }

  stdout.write(prompt);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise<string>((resolve, reject) => {
    let value = "";

    const cleanup = (): void => {
      stdin.removeListener("data", handleData);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      stdout.write("\n");
    };

    const handleData = (chunk: string | Buffer): void => {
      const characters = chunk.toString();

      for (const character of characters) {
        if (character === "\u0003") {
          value = "";
          cleanup();
          reject(new AdminPasswordOperationError("Operação cancelada."));
          return;
        }

        if (character === "\r" || character === "\n") {
          const completedValue = value;
          value = "";
          cleanup();
          resolve(completedValue);
          return;
        }

        if (character === "\u0008" || character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }

        if (character >= " ") {
          value += character;
        }
      }
    };

    stdin.on("data", handleData);
  });
}

interface CommandDependencies {
  createPrisma: () => AdminPasswordPrismaClient;
  promptHidden: (prompt: string) => Promise<string>;
  log: (message: string) => void;
  logError: (message: string) => void;
}

function createProductionPrisma(): AdminPasswordPrismaClient {
  const connectionString = validateDatabaseUrl(process.env.DATABASE_URL);

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  }) as unknown as AdminPasswordPrismaClient;
}

export async function runSetAdminPasswordCommand(
  dependencies: CommandDependencies = {
    createPrisma: createProductionPrisma,
    promptHidden: readHiddenLine,
    log: console.log,
    logError: console.error,
  },
): Promise<number> {
  let prisma: AdminPasswordPrismaClient | null = null;
  let password = "";
  let confirmation = "";

  try {
    const emailNormalized = normalizeAdminEmail(process.env.ADMIN_EMAIL);
    validateDatabaseUrl(process.env.DATABASE_URL);
    password = await dependencies.promptHidden("Nova senha: ");
    confirmation = await dependencies.promptHidden("Confirme a nova senha: ");
    validatePasswordConfirmation(password, confirmation);
    prisma = dependencies.createPrisma();

    await setAdminPassword(prisma, emailNormalized, password);

    dependencies.log("Senha da conta ADMIN atualizada com sucesso.");
    dependencies.log("Sessões existentes revogadas.");
    return 0;
  } catch (error) {
    const message =
      error instanceof AdminPasswordOperationError
        ? error.message
        : "Não foi possível atualizar a senha da conta ADMIN.";
    dependencies.logError(message);
    return 1;
  } finally {
    password = "";
    confirmation = "";
    await prisma?.$disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  void runSetAdminPasswordCommand().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
