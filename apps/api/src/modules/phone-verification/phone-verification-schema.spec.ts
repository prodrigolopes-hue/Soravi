import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("PhoneVerificationChallenge schema and migration", () => {
  const apiRoot = join(__dirname, "../../..");
  const schema = readFileSync(join(apiRoot, "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(
      apiRoot,
      "prisma/migrations/20260827000100_create_phone_verification_challenges/migration.sql",
    ),
    "utf8",
  );

  it("define model, relação e campos seguros do challenge", () => {
    expect(schema).toContain("model PhoneVerificationChallenge {");
    expect(schema).toContain(
      "phoneVerificationChallenges       PhoneVerificationChallenge[]",
    );
    expect(schema).toContain("phoneNormalized String");
    expect(schema).toContain("codeHash        String");
    expect(schema).toContain('@db.VarChar(64)');
    expect(schema).toContain("attemptCount    Int       @default(0)");
    expect(schema).toContain("maxAttempts     Int       @default(5)");
    expect(schema).toContain("consumedAt      DateTime?");
    expect(schema).toContain("invalidatedAt   DateTime?");
    expect(schema).toContain("onDelete: Cascade");
  });

  it("define os índices esperados", () => {
    expect(schema).toContain("@@index([userId, createdAt]");
    expect(schema).toContain(
      "@@index([userId, consumedAt, invalidatedAt, expiresAt]",
    );
    expect(schema).toContain("@@index([expiresAt]");
  });

  it("migration cria somente a tabela, índices e foreign key", () => {
    expect(migration).toContain(
      'CREATE TABLE "phone_verification_challenges"',
    );
    expect(migration).toContain('"code_hash" VARCHAR(64) NOT NULL');
    expect(migration).toContain('"phone_normalized" VARCHAR(32) NOT NULL');
    expect(migration).toContain('"attempt_count" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('"max_attempts" INTEGER NOT NULL DEFAULT 5');
    expect(migration).toContain('FOREIGN KEY ("user_id")');
    expect(migration).not.toMatch(
      /ALTER TABLE "users"[\s\S]*(?:phone|phone_normalized|phone_verified_at)/,
    );
    expect(migration).not.toMatch(/CREATE (?:TRIGGER|FUNCTION)/);
  });
});
