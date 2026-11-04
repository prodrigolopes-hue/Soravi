import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { Client } from "pg";

const EXPECTED_DATABASE = "soravi_migration_bootstrap_test";
const OPT_IN_VARIABLE = "RUN_MIGRATION_BOOTSTRAP_TEST";
const DATABASE_URL_VARIABLE = "MIGRATION_BOOTSTRAP_DATABASE_URL";
const MODERATION_MIGRATION =
  "20260814000100_add_public_category_suggestion_moderation";
const SUGGESTIONS_MIGRATION = "20260814171754_add_public_category_suggestions";
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const apiDirectory = resolve(currentDirectory, "..");
const migrationsDirectory = resolve(apiDirectory, "prisma/migrations");
let currentStage = "VALIDACAO_DO_OPT_IN";

class MigrationBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationBootstrapError";
  }
}

class PrismaCommandError extends MigrationBootstrapError {
  code: string;

  constructor(message: string, output: string) {
    super(message);
    this.code = output.match(/\bP\d{4}\b/)?.[0] ?? output.match(/\b\d{5}\b/)?.[0] ?? "N/A";
  }
}

type MigrationHistory = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  logs: string | null;
};

type DiagnosticError = {
  code?: unknown;
  message?: unknown;
};

function getSafeCode(error: unknown): string {
  const code = typeof (error as DiagnosticError | undefined)?.code === "string"
    ? (error as DiagnosticError).code
    : undefined;

  return code && /^(?:P\d{4}|[0-9A-Z]{5})$/.test(code) ? code : "N/A";
}

function sanitizeDiagnosticMessage(error: unknown): string {
  const message = typeof (error as DiagnosticError | undefined)?.message === "string"
    ? (error as DiagnosticError).message
    : "Erro sem mensagem segura disponível.";
  const compact = message.replace(/[\r\n\t]+/g, " ").trim();

  if (/\b(SELECT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|VALUES|WHERE)\b/i.test(compact)) {
    return "Mensagem omitida porque contém SQL.";
  }

  return compact
    .replace(/(?:postgres(?:ql)?:\/\/|https?:\/\/)[^\s'"`]+/gi, "[URL omitida]")
    .replace(/\b(password|secret|token|credential)\s*[=:]\s*[^\s,;]+/gi, "$1=[omitido]")
    .slice(0, 300) || "Erro sem mensagem segura disponível.";
}

function writeDiagnostic(stage: string, error: unknown): void {
  process.stderr.write(
    `Bootstrap interrompido. etapa=${stage}; codigo=${getSafeCode(error)}; mensagem=${sanitizeDiagnosticMessage(error)}\n`,
  );
}

function requireOptIn(value: string | undefined): void {
  if (value !== "true") {
    throw new MigrationBootstrapError(
      `Defina ${OPT_IN_VARIABLE}=true para executar o bootstrap controlado.`,
    );
  }
}

export function validateBootstrapDatabaseUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new MigrationBootstrapError(
      `Defina ${DATABASE_URL_VARIABLE}; DATABASE_URL não é usado como fallback.`,
    );
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new MigrationBootstrapError("A conexão do bootstrap deve ser PostgreSQL local autorizado.");
  }

  const supportedProtocol =
    databaseUrl.protocol === "postgres:" || databaseUrl.protocol === "postgresql:";
  const isLocalHost =
    databaseUrl.hostname === "localhost" || databaseUrl.hostname === "127.0.0.1";

  if (
    !supportedProtocol ||
    !isLocalHost ||
    databaseUrl.port !== "5432" ||
    databaseUrl.pathname !== `/${EXPECTED_DATABASE}` ||
    databaseUrl.hash
  ) {
    throw new MigrationBootstrapError(
      `O bootstrap aceita somente PostgreSQL em localhost/127.0.0.1:5432/${EXPECTED_DATABASE}.`,
    );
  }

  return value;
}

async function runPrisma(arguments_: string[]): Promise<{ code: number; output: string }> {
  const prismaCli = require.resolve("prisma/build/index.js", { paths: [apiDirectory] });

  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [prismaCli, ...arguments_], {
      cwd: apiDirectory,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => resolvePromise({ code: code ?? 1, output }));
  });
}

function assertPrismaSucceeded(
  result: { code: number; output: string },
  message: string,
): void {
  if (result.code !== 0) throw new PrismaCommandError(message, result.output);
}

async function assertInitiallyEmpty(client: Client): Promise<void> {
  const history = await client.query<{ exists: boolean }>(
    "SELECT to_regclass('public.\"_prisma_migrations\"') IS NOT NULL AS exists",
  );
  const objects = await client.query<{ count: string }>(
    `SELECT (
         (SELECT count(*)
          FROM pg_class r
          JOIN pg_namespace ns ON ns.oid = r.relnamespace
          WHERE ns.nspname = 'public')
         +
         (SELECT count(*)
          FROM pg_type t
          JOIN pg_namespace ns ON ns.oid = t.typnamespace
          WHERE ns.nspname = 'public')
         +
         (SELECT count(*)
          FROM pg_proc p
          JOIN pg_namespace ns ON ns.oid = p.pronamespace
          WHERE ns.nspname = 'public')
       )::text AS count`,
  );

  if (history.rows[0]?.exists || objects.rows[0]?.count !== "0") {
    throw new MigrationBootstrapError(
      "O bootstrap exige banco sem objetos de aplicação e sem histórico Prisma antes da primeira execução.",
    );
  }
}

async function getHistory(client: Client): Promise<MigrationHistory[]> {
  const result = await client.query<MigrationHistory>(
    `SELECT migration_name, finished_at, rolled_back_at
     FROM "_prisma_migrations"
     ORDER BY started_at ASC`,
  );
  return result.rows;
}

async function assertExpectedInitialFailure(client: Client): Promise<void> {
  const history = await getHistory(client);
  const incomplete = history.filter(
    (migration) => migration.finished_at === null && migration.rolled_back_at === null,
  );
  const unexpectedIncomplete = incomplete.filter(
    (migration) => migration.migration_name !== MODERATION_MIGRATION);
  const laterMigrations = history.filter(
    (migration) => migration.migration_name > MODERATION_MIGRATION,
  );
  const moderation = incomplete.find(
    (migration) => migration.migration_name === MODERATION_MIGRATION,
  );
  const invalidCompleted = history.some(
    (migration) =>
      migration.migration_name < MODERATION_MIGRATION &&
      (migration.finished_at === null || migration.rolled_back_at !== null),
  );

  if (
    incomplete.length !== 1 ||
    unexpectedIncomplete.length !== 0 ||
    !moderation ||
    laterMigrations.length !== 0 ||
    invalidCompleted
  ) {
    throw new MigrationBootstrapError(
      "A falha inicial não corresponde exclusivamente à migration de moderação esperada; interrompido sem resolver migrations.",
    );
  }
}

async function assertBootstrapPrerequisites(client: Client): Promise<void> {
  const result = await client.query<{
    enum_exists: boolean;
    table_exists: boolean;
  }>(
    `SELECT
       to_regtype('"PublicCategorySuggestionStatus"') IS NOT NULL AS enum_exists,
       to_regclass('public."public_category_suggestions"') IS NOT NULL AS table_exists`,
  );
  const state = result.rows[0];
  if (!state || state.enum_exists || state.table_exists) {
    throw new MigrationBootstrapError(
      "O enum ou a tabela de sugestões já existe; a recuperação exige análise manual e não será retomada automaticamente.",
    );
  }
}

async function readOriginalMigration(name: string): Promise<string> {
  return readFile(resolve(migrationsDirectory, name, "migration.sql"), "utf8");
}

async function assertEffects(client: Client): Promise<void> {
  const enumValues = await client.query<{ enumlabel: string }>(
    `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace ns ON ns.oid = t.typnamespace
       WHERE ns.nspname = 'public'
         AND t.typname = 'PublicCategorySuggestionStatus'
       ORDER BY e.enumsortorder`,
  );
  const columns = await client.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'public_category_suggestions'
       ORDER BY column_name`,
  );
  const indexes = await client.query<{ indexname: string }>(
    `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'public_category_suggestions'
       ORDER BY indexname`,
  );
  const foreignKey = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
         SELECT 1
         FROM pg_constraint c
         JOIN pg_class tr ON tr.oid = c.conrelid
         JOIN pg_namespace ns ON ns.oid = tr.relnamespace
         JOIN pg_class rr ON rr.oid = c.confrelid
         WHERE ns.nspname = 'public'
           AND tr.relname = 'public_category_suggestions'
           AND c.conname = 'public_category_suggestions_reviewed_by_user_id_fkey'
           AND c.contype = 'f'
           AND rr.relname = 'users'
           AND c.confdeltype = 'n'
           AND c.confupdtype = 'c'
       ) AS exists`,
  );

  const values = enumValues.rows.map(({ enumlabel }) => enumlabel);
  const expectedValues = ["PENDING", "APPROVED", "REJECTED"];
  const requiredColumns = [
    "id",
    "status",
    "review_notes",
    "reviewed_at",
    "reviewed_by_user_id",
  ];
  const columnNames = new Set(columns.rows.map(({ column_name }) => column_name));
  const indexNames = new Set(indexes.rows.map(({ indexname }) => indexname));

  if (
    values.length !== expectedValues.length ||
    values.some((value, index) => value !== expectedValues[index]) ||
    requiredColumns.some((column) => !columnNames.has(column)) ||
    !indexNames.has("public_category_suggestions_status_created_at_idx") ||
    !indexNames.has("public_category_suggestions_reviewer_idx") ||
    !foreignKey.rows[0]?.exists
  ) {
    throw new MigrationBootstrapError(
      "Os efeitos estruturais do bootstrap não conferem; migrations não serão marcadas como aplicadas.",
    );
  }
}

async function assertMigrationDirectories(): Promise<void> {
  const migrationDirectories = await readdir(migrationsDirectory, { withFileTypes: true });
  const names = new Set(
    migrationDirectories.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  );
  if (!names.has(MODERATION_MIGRATION) || !names.has(SUGGESTIONS_MIGRATION)) {
    throw new MigrationBootstrapError("As migrations publicadas esperadas não estão disponíveis.");
  }
}

async function main(): Promise<void> {
  currentStage = "VALIDACAO_DO_OPT_IN";
  requireOptIn(process.env[OPT_IN_VARIABLE]);
  currentStage = "VALIDACAO_DA_CONEXAO";
  const databaseUrl = validateBootstrapDatabaseUrl(process.env[DATABASE_URL_VARIABLE]);
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  let client: Client | undefined;

  try {
    currentStage = "VALIDACAO_DOS_ARQUIVOS";
    await assertMigrationDirectories();
    currentStage = "CONEXAO_LOCAL";
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    currentStage = "VALIDACAO_DO_BANCO_VAZIO";
    await assertInitiallyEmpty(client);

    currentStage = "MIGRATE_DEPLOY_INICIAL";
    const initialDeploy = await runPrisma(["migrate", "deploy", "--config", "prisma.config.ts"]);
    if (initialDeploy.code === 0) {
      throw new MigrationBootstrapError("A instalação inicial não falhou na migration conhecida; bootstrap recusado.");
    }
    currentStage = "CONFIRMACAO_DA_FALHA_INICIAL";
    await assertExpectedInitialFailure(client);
    currentStage = "PRE_REQUISITOS_DO_BOOTSTRAP";
    await assertBootstrapPrerequisites(client);

    currentStage = "MIGRATE_RESOLVE_ROLLED_BACK";
    const rollback = await runPrisma([
      "migrate",
      "resolve",
      "--rolled-back",
      MODERATION_MIGRATION,
      "--config",
      "prisma.config.ts",
    ]);
    assertPrismaSucceeded(
      rollback,
      "Não foi possível registrar a falha esperada como rolled back.",
    );

    // ALTER TYPE ... ADD VALUE não é combinado com uso dos novos valores na mesma transação.
    // Cada arquivo é executado em uma chamada autônoma, sem BEGIN/COMMIT explícito.
    currentStage = "SQL_ORIGINAL_DE_CRIACAO";
    await client.query(await readOriginalMigration(SUGGESTIONS_MIGRATION));
    currentStage = "SQL_ORIGINAL_DE_MODERACAO";
    await client.query(await readOriginalMigration(MODERATION_MIGRATION));
    currentStage = "VALIDACAO_ESTRUTURAL";
    await assertEffects(client);

    for (const migration of [MODERATION_MIGRATION, SUGGESTIONS_MIGRATION]) {
      currentStage = `MIGRATE_RESOLVE_APPLIED_${migration}`;
      const resolved = await runPrisma([
        "migrate",
        "resolve",
        "--applied",
        migration,
        "--config",
        "prisma.config.ts",
      ]);
      assertPrismaSucceeded(
        resolved,
        `Não foi possível registrar a migration ${migration} após confirmar seus efeitos.`,
      );
    }

    currentStage = "MIGRATE_DEPLOY_FINAL";
    const deploy = await runPrisma(["migrate", "deploy", "--config", "prisma.config.ts"]);
    assertPrismaSucceeded(deploy, "A aplicação das migrations posteriores falhou.");
    currentStage = "MIGRATE_STATUS_FINAL";
    const status = await runPrisma(["migrate", "status", "--config", "prisma.config.ts"]);
    assertPrismaSucceeded(status, "O status final das migrations não está atualizado.");
    currentStage = "VALIDACAO_ESTRUTURAL_FINAL";
    await assertEffects(client);
    process.stdout.write("Bootstrap concluído para o banco local autorizado.\n");
  } finally {
    try {
      await client?.end();
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
}

void main().catch((error: unknown) => {
  writeDiagnostic(currentStage, error);
  process.exitCode = 1;
});
