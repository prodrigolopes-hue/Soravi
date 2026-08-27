import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("CommunicationPreference schema and migration", () => {
  const apiRoot = join(__dirname, "../../..");
  const schema = readFileSync(join(apiRoot, "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(
      apiRoot,
      "prisma/migrations/20260826000200_add_event_type_to_communication_preferences/migration.sql",
    ),
    "utf8",
  );

  it("substitui a unique antiga pela identidade de canal e evento", () => {
    expect(schema).toContain("eventType      NotificationType");
    expect(schema).toContain("@@unique([userId, channel, eventType]");
    expect(schema).not.toContain("@@unique([userId, channel],");
    expect(migration).toContain(
      'DROP INDEX "communication_preferences_user_channel_key"',
    );
    expect(migration).toContain(
      '"communication_preferences_user_channel_event_type_key"',
    );
  });

  it("cria indice coerente com user, canal, evento e enabled", () => {
    expect(schema).toContain("@@index([userId, channel, eventType, enabled]");
    expect(migration).toContain(
      '("user_id", "channel", "event_type", "enabled")',
    );
  });

  it("remove preferencias legadas antes de exigir eventType", () => {
    const deletePosition = migration.indexOf(
      'DELETE FROM "communication_preferences"',
    );
    const addEventTypePosition = migration.indexOf(
      'ADD COLUMN "event_type" "NotificationType" NOT NULL',
    );

    expect(deletePosition).toBeGreaterThanOrEqual(0);
    expect(addEventTypePosition).toBeGreaterThan(deletePosition);
    expect(migration).not.toMatch(
      /\b(?:INSERT INTO|UPDATE)\s+"communication_preferences"/,
    );
  });
});
