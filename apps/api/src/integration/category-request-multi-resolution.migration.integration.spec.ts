import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CategoryRequestsService } from "../modules/category-requests/category-requests.service";
import { deferred, queryRawSql, waitUntilPostgresConfirmsBlocking, wrapPrisma } from "./integration-concurrency";

const databaseName = "soravi_migration_bootstrap_test";
const backfillRequestId = "00000000-0000-0000-0000-000000000301";
const backfillCategoryId = "00000000-0000-0000-0000-000000000201";

function createPrisma(): PrismaService {
  const raw = process.env.MIGRATION_VALIDATION_DATABASE_URL;
  if (!raw) throw new Error("MIGRATION_VALIDATION_DATABASE_URL is required.");
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432' || decodeURIComponent(url.pathname) !== `/${databaseName}`) throw new Error(`Migration validation only accepts localhost:55432/${databaseName}.`);
  return new PrismaService(new ConfigService({ DATABASE_URL: raw }));
}

describe("Category request multi-resolution migration", () => {
  const control = createPrisma(); const first = createPrisma(); const second = createPrisma();
  const users = new Set<string>(); const categories = new Set<string>(); const requests = new Set<string>(); const pending = new Set<Promise<unknown>>();

  beforeAll(async () => {
    await Promise.all([control.$connect(), first.$connect(), second.$connect()]);
    const [database] = await control.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== databaseName) throw new Error("The suite refuses to run outside its disposable migration database.");
    const migrations = await control.$queryRaw<Array<{ finished_at: Date | null }>>(Prisma.sql`SELECT "finished_at" FROM "_prisma_migrations" WHERE "migration_name" = '20261116000100_add_category_request_multi_resolution'`);
    if (migrations.length !== 1 || !migrations[0]?.finished_at) throw new Error("The target migration must be applied before this suite runs.");
  });
  afterEach(async () => { await Promise.allSettled([...pending]); await control.categoryRequest.deleteMany({ where: { id: { in: [...requests] } } }); await control.user.deleteMany({ where: { id: { in: [...users] } } }); await control.category.deleteMany({ where: { id: { in: [...categories] } } }); users.clear(); categories.clear(); requests.clear(); });
  afterAll(async () => { await Promise.all([control.$disconnect(), first.$disconnect(), second.$disconnect()]); });

  it("preserva a resolução criada antes da migration", async () => {
    const request = await control.categoryRequest.findUnique({ where: { id: backfillRequestId }, include: { resolvedCategories: true } });
    expect(request?.resolvedCategoryId).toBe(backfillCategoryId);
    expect(request?.resolvedCategories).toEqual(expect.arrayContaining([expect.objectContaining({ categoryId: backfillCategoryId })]));
  });

  it("resolve categorias existente e nova, respeita três e reverte a quarta", async () => {
    const fixture = await fixture("limit"); const existing = await category("existing"); const request = await requestFor(fixture.profileId, "Solar"); const service = new CategoryRequestsService(control);
    const result = await service.decide(request.id, fixture.adminId, { decision: "RESOLVE", categories: [{ categoryId: existing }, { create: { name: "Nova solar", slug: `new-${randomUUID()}` } }], reviewNotes: "Duas categorias." });
    result.resolvedCategories.forEach((item) => categories.add(item.id));
    expect(result.status).toBe("APPROVED"); expect(result.resolvedCategories).toHaveLength(2);
    expect(await control.professionalCategory.count({ where: { professionalProfileId: fixture.profileId } })).toBe(3);
    const excess = await requestFor(fixture.profileId, "Quarta"); const rollbackSlug = `rollback-${randomUUID()}`;
    await expect(service.decide(excess.id, fixture.adminId, { decision: "RESOLVE", categories: [{ create: { name: "Não persiste", slug: rollbackSlug } }] })).rejects.toBeInstanceOf(ConflictException);
    const unchanged = await control.categoryRequest.findUniqueOrThrow({ where: { id: excess.id }, include: { resolvedCategories: true } });
    expect(unchanged.status).toBe("PENDING"); expect(unchanged.resolvedCategoryId).toBeNull(); expect(unchanged.resolvedCategories).toHaveLength(0);
    expect(await control.category.findUnique({ where: { slug: rollbackSlug } })).toBeNull();
  });

  it("serializa duas decisões sem associação parcial", async () => {
    const fixture = await fixture("race"); const one = await category("one"); const two = await category("two"); const three = await category("three"); const request = await requestFor(fixture.profileId, "Concorrente");
    const acquired = deferred<void>(); const release = deferred<void>(); const blockedPid = deferred<number>();
    const locked = new CategoryRequestsService(wrapPrisma(first, { afterQueryRaw: async (args) => { if (queryRawSql(args).includes('FROM "users"')) { acquired.resolve(); await release.promise; } } }));
    const competing = new CategoryRequestsService(wrapPrisma(second, { transactionStarted: (pid) => blockedPid.resolve(pid) }));
    let left: Promise<unknown> | undefined; let right: Promise<unknown> | undefined;
    try {
      left = track(locked.decide(request.id, fixture.adminId, { decision: "RESOLVE", categories: [{ categoryId: one }, { categoryId: two }] })); await acquired.promise;
      right = track(competing.decide(request.id, fixture.adminId, { decision: "RESOLVE", categories: [{ categoryId: three }] })); await waitUntilPostgresConfirmsBlocking(control, await blockedPid.promise); release.resolve();
      const results = await Promise.allSettled([left, right]); expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1); expect(results.find((item) => item.status === "rejected")).toMatchObject({ reason: expect.any(ConflictException) });
      const persisted = await control.categoryRequest.findUniqueOrThrow({ where: { id: request.id }, include: { resolvedCategories: true } }); const ids = persisted.resolvedCategories.map((item) => item.categoryId).sort();
      expect([[one, two].sort(), [three]]).toContainEqual(ids); expect(await control.professionalCategory.count({ where: { professionalProfileId: fixture.profileId } })).toBe(ids.length + 1);
    } finally { release.resolve(); await Promise.allSettled([left, right].filter((item): item is Promise<unknown> => item !== undefined)); }
  });

  async function fixture(label: string) { const adminId = randomUUID(); const userId = randomUUID(); const profileId = randomUUID(); users.add(adminId); users.add(userId); await control.user.createMany({ data: [{ id: adminId, name: "Admin", email: `admin-${adminId}@example.test`, emailNormalized: `admin-${adminId}@example.test`, passwordHash: "test" }, { id: userId, name: "Professional", email: `professional-${userId}@example.test`, emailNormalized: `professional-${userId}@example.test`, passwordHash: "test" }] }); await control.userRole.create({ data: { userId: adminId, role: "ADMIN" } }); await control.professionalProfile.create({ data: { id: profileId, userId, displayName: `Professional ${label}` } }); const base = await category(`base-${label}`); await control.professionalCategory.create({ data: { professionalProfileId: profileId, categoryId: base } }); return { adminId, profileId }; }
  async function category(name: string) { const id = randomUUID(); categories.add(id); await control.category.create({ data: { id, name, slug: `${name}-${id}`, isActive: true } }); return id; }
  async function requestFor(professionalProfileId: string, suggestedName: string) { const id = randomUUID(); requests.add(id); return control.categoryRequest.create({ data: { id, professionalProfileId, suggestedName, suggestedNameNormalized: `${suggestedName}-${id}`.toLowerCase() } }); }
  function track<T>(operation: Promise<T>) { pending.add(operation); operation.finally(() => pending.delete(operation)).catch(() => undefined); return operation; }
});
