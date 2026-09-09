import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ConfigService } from "@nestjs/config";
import { parse } from "dotenv";

import { PrismaService } from "../database/prisma.service";

const INTEGRATION_DATABASE_NAME = "soravi_integration_test";
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1"]);

function validateDatabaseUrl(rawUrl: string, expectedDatabase: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("A URL do banco de integração é inválida.");
  }

  if (
    url.protocol !== "postgresql:" ||
    !LOCAL_DATABASE_HOSTS.has(url.hostname) ||
    url.port !== "5432" ||
    decodeURIComponent(url.pathname) !== `/${expectedDatabase}`
  ) {
    throw new Error(
      `O banco de integração deve ser PostgreSQL local na porta 5432 e usar exclusivamente ${expectedDatabase}.`,
    );
  }

  return url;
}

function deriveIntegrationDatabaseUrl(): string {
  const environment = parse(
    readFileSync(resolve(__dirname, "../../../../.env")),
  );
  const sourceUrl = environment.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error("DATABASE_URL não foi encontrada no .env da raiz.");
  }

  const url = validateDatabaseUrl(sourceUrl, "soravi");
  url.pathname = `/${INTEGRATION_DATABASE_NAME}`;
  return url.toString();
}

export function getIntegrationDatabaseUrl(): string {
  const rawUrl =
    process.env.INTEGRATION_DATABASE_URL ?? deriveIntegrationDatabaseUrl();
  return validateDatabaseUrl(rawUrl, INTEGRATION_DATABASE_NAME).toString();
}

export function createIntegrationPrismaService(): PrismaService {
  return new PrismaService(
    new ConfigService({ DATABASE_URL: getIntegrationDatabaseUrl() }),
  );
}
