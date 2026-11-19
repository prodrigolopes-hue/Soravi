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

  it("resolve categorias existente e nova, respeita dez e reverte a décima primeira", async () => {
    const testFixture = await createFixture("limit"); const existing = await category("existing"); const request = await requestFor(testFixture.profileId, "Solar"); const service = new CategoryRequestsService(control);
    const result = await service.decide(request.id, testFixture.adminId, { decision: "RESOLVE", categories: [{ categoryId: existing }, { create: { name: "Nova solar", slug: `new-${randomUUID()}` } }], reviewNotes: "Duas categorias." });
    const resolvedCategories = result.resolvedCategories;
    expect(result.status).toBe("APPROVED"); expect(resolvedCategories).toHaveLength(2);
    if (!resolvedCategories) throw new Error("A decisão aprovada deve retornar as categorias resolvidas.");
    resolvedCategories.forEach((item) => categories.add(item.id));
    expect(await control.professionalCategory.count({ where: { professionalProfileId: testFixture.profileId } })).toBe(3);
    for (let i = 0; i < 7; i++) { const id = await category(`limit-extra-${i}`); await control.professionalCategory.create({ data: { professionalProfileId: testFixture.profileId, categoryId: id } }); }
    const excess = await requestFor(testFixture.profileId, "Décima primeira"); const rollbackSlug = `rollback-${randomUUID()}`;
    await expect(service.decide(excess.id, testFixture.adminId, { decision: "RESOLVE", categories: [{ create: { name: "Não persiste", slug: rollbackSlug } }] })).rejects.toBeInstanceOf(ConflictException);
    const unchanged = await control.categoryRequest.findUniqueOrThrow({ where: { id: excess.id }, include: { resolvedCategories: true } });
    expect(unchanged.status).toBe("PENDING"); expect(unchanged.resolvedCategoryId).toBeNull(); expect(unchanged.resolvedCategories).toHaveLength(0);
    expect(await control.category.findUnique({ where: { slug: rollbackSlug } })).toBeNull();
  });

  it("serializa duas decisões sem associação parcial", async () => {
    const testFixture = await createFixture("race"); const one = await category("one"); const two = await category("two"); const three = await category("three"); const request = await requestFor(testFixture.profileId, "Concorrente");
    const acquired = deferred<void>(); const release = deferred<void>(); const blockedPid = deferred<number>();
    const locked = new CategoryRequestsService(wrapPrisma(first, { afterQueryRaw: async (args) => { if (queryRawSql(args).includes('FROM "users"')) { acquired.resolve(); await release.promise; } } }));
    const competing = new CategoryRequestsService(wrapPrisma(second, { transactionStarted: (pid) => blockedPid.resolve(pid) }));
    let left: Promise<unknown> | undefined; let right: Promise<unknown> | undefined;
    try {
      left = track(locked.decide(request.id, testFixture.adminId, { decision: "RESOLVE", categories: [{ categoryId: one }, { categoryId: two }] })); await acquired.promise;
      right = track(competing.decide(request.id, testFixture.adminId, { decision: "RESOLVE", categories: [{ categoryId: three }] })); await waitUntilPostgresConfirmsBlocking(control, await blockedPid.promise); release.resolve();
      const results = await Promise.allSettled([left, right]); expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1); expect(results.find((item) => item.status === "rejected")).toMatchObject({ reason: expect.any(ConflictException) });
      const persisted = await control.categoryRequest.findUniqueOrThrow({ where: { id: request.id }, include: { resolvedCategories: true } }); const ids = persisted.resolvedCategories.map((item) => item.categoryId).sort();
      expect([[one, two].sort(), [three]]).toContainEqual(ids); expect(await control.professionalCategory.count({ where: { professionalProfileId: testFixture.profileId } })).toBe(ids.length + 1);
    } finally { release.resolve(); await Promise.allSettled([left, right].filter((item): item is Promise<unknown> => item !== undefined)); }
  });

  it("atribui ordens consecutivas a duas categorias novas da mesma decisão", async () => {
    const testFixture = await createFixture("display-order-pair");
    const request = await requestFor(testFixture.profileId, "Duas novas");
    const firstSlug = `display-order-first-${randomUUID()}`;
    const secondSlug = `display-order-second-${randomUUID()}`;
    const [{ displayOrder: previousMaximum }] = await control.$queryRaw<Array<{ displayOrder: number | null }>>(Prisma.sql`SELECT MAX("display_order")::integer AS "displayOrder" FROM "categories"`);
    const service = new CategoryRequestsService(control);

    await service.decide(request.id, testFixture.adminId, {
      decision: "RESOLVE",
      categories: [
        { create: { name: "Primeira ordem", slug: firstSlug } },
        { create: { name: "Segunda ordem", slug: secondSlug } },
      ],
    });

    const created = await control.category.findMany({ where: { slug: { in: [firstSlug, secondSlug] } }, orderBy: { displayOrder: "asc" }, select: { id: true, displayOrder: true } });
    created.forEach((item) => categories.add(item.id));
    expect(created).toHaveLength(2);
    expect(created.map((item) => item.displayOrder)).toEqual([((previousMaximum ?? -1) + 1), ((previousMaximum ?? -1) + 2)]);
  });

  it("serializa criações concorrentes sem ordem duplicada nem persistência parcial", async () => {
    const leftFixture = await createFixture("display-order-race-left");
    const rightFixture = await createFixture("display-order-race-right");
    const leftRequest = await requestFor(leftFixture.profileId, "Nova concorrente esquerda");
    const rightRequest = await requestFor(rightFixture.profileId, "Nova concorrente direita");
    const leftSlug = `display-order-race-left-${randomUUID()}`;
    const rightSlug = `display-order-race-right-${randomUUID()}`;
    const acquired = deferred<void>(); const release = deferred<void>(); const blockedPid = deferred<number>();
    const leftService = new CategoryRequestsService(wrapPrisma(first, { afterExecuteRaw: async (args) => { if (queryRawSql(args).includes("pg_advisory_xact_lock")) { acquired.resolve(); await release.promise; } } }));
    const rightService = new CategoryRequestsService(wrapPrisma(second, { transactionStarted: (pid) => blockedPid.resolve(pid) }));
    let left: Promise<unknown> | undefined; let right: Promise<unknown> | undefined;
    try {
      left = track(leftService.decide(leftRequest.id, leftFixture.adminId, { decision: "RESOLVE", categories: [{ create: { name: "Nova concorrente esquerda", slug: leftSlug } }] }));
      await acquired.promise;
      right = track(rightService.decide(rightRequest.id, rightFixture.adminId, { decision: "RESOLVE", categories: [{ create: { name: "Nova concorrente direita", slug: rightSlug } }] }));
      await waitUntilPostgresConfirmsBlocking(control, await blockedPid.promise);
      release.resolve();
      const outcomes = await Promise.allSettled([left, right]);
      const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(fulfilled.length).toBeLessThanOrEqual(2);
      rejected.forEach((outcome) => {
        expect(outcome.reason).toBeInstanceOf(ConflictException);
        expect((outcome.reason as ConflictException).getResponse()).toMatchObject({ code: "CATEGORY_REQUEST_DECISION_CONFLICT" });
      });
      const created = await control.category.findMany({ where: { slug: { in: [leftSlug, rightSlug] } }, orderBy: { displayOrder: "asc" }, select: { id: true, displayOrder: true } });
      created.forEach((item) => categories.add(item.id));
      expect(created).toHaveLength(fulfilled.length);
      expect(new Set(created.map((item) => item.displayOrder)).size).toBe(created.length);
      if (created.length === 2) expect(created[1]!.displayOrder).toBe(created[0]!.displayOrder + 1);
      expect(await control.professionalCategory.count({ where: { professionalProfileId: { in: [leftFixture.profileId, rightFixture.profileId] }, categoryId: { in: created.map((item) => item.id) } } })).toBe(fulfilled.length);
      const persisted = await control.categoryRequest.findMany({ where: { id: { in: [leftRequest.id, rightRequest.id] } }, include: { resolvedCategories: true } });
      expect(persisted).toHaveLength(2);
      const outcomeByRequestId = new Map([[leftRequest.id, outcomes[0]!], [rightRequest.id, outcomes[1]!]]);
      persisted.forEach((request) => {
        if (outcomeByRequestId.get(request.id)?.status === "fulfilled") {
          expect(request.status).toBe("APPROVED");
          expect(request.resolvedCategories).toHaveLength(1);
        } else {
          expect(request.status).toBe("PENDING");
          expect(request.resolvedCategoryId).toBeNull();
          expect(request.resolvedCategories).toHaveLength(0);
        }
      });
    } finally { release.resolve(); await Promise.allSettled([left, right].filter((item): item is Promise<unknown> => item !== undefined)); }
  });

  it("reverte categoria, associação e decisão ao exceder o limite com criações novas", async () => {
    const testFixture = await createFixture("display-order-rollback");
    const second = await category("display-order-rollback-second");
    const third = await category("display-order-rollback-third");
    await control.professionalCategory.createMany({ data: [{ professionalProfileId: testFixture.profileId, categoryId: second }, { professionalProfileId: testFixture.profileId, categoryId: third }] });
    for (let i = 0; i < 7; i++) { const id = await category(`rollback-extra-${i}`); await control.professionalCategory.create({ data: { professionalProfileId: testFixture.profileId, categoryId: id } }); }
    const request = await requestFor(testFixture.profileId, "Décima primeira nova");
    const rollbackSlug = `display-order-rollback-${randomUUID()}`;
    const service = new CategoryRequestsService(control);

    await expect(service.decide(request.id, testFixture.adminId, { decision: "RESOLVE", categories: [{ create: { name: "Quarta nova", slug: rollbackSlug } }] })).rejects.toBeInstanceOf(ConflictException);

    expect(await control.category.findUnique({ where: { slug: rollbackSlug } })).toBeNull();
    expect(await control.professionalCategory.count({ where: { professionalProfileId: testFixture.profileId } })).toBe(10);
    const unchanged = await control.categoryRequest.findUniqueOrThrow({ where: { id: request.id }, include: { resolvedCategories: true } });
    expect(unchanged.status).toBe("PENDING");
    expect(unchanged.resolvedCategoryId).toBeNull();
    expect(unchanged.resolvedCategories).toHaveLength(0);
  });

  async function createFixture(label: string) { const adminId = randomUUID(); const userId = randomUUID(); const profileId = randomUUID(); users.add(adminId); users.add(userId); await control.user.createMany({ data: [{ id: adminId, name: "Admin", email: `admin-${adminId}@example.test`, emailNormalized: `admin-${adminId}@example.test`, passwordHash: "test" }, { id: userId, name: "Professional", email: `professional-${userId}@example.test`, emailNormalized: `professional-${userId}@example.test`, passwordHash: "test" }] }); await control.userRole.create({ data: { userId: adminId, role: "ADMIN" } }); await control.professionalProfile.create({ data: { id: profileId, userId, displayName: `Professional ${label}` } }); const base = await category(`base-${label}`); await control.professionalCategory.create({ data: { professionalProfileId: profileId, categoryId: base } }); return { adminId, profileId }; }
  async function category(name: string) { const id = randomUUID(); categories.add(id); await control.category.create({ data: { id, name, slug: `${name}-${id}`, isActive: true } }); return id; }
  async function requestFor(professionalProfileId: string, suggestedName: string) { const id = randomUUID(); requests.add(id); return control.categoryRequest.create({ data: { id, professionalProfileId, suggestedName, suggestedNameNormalized: `${suggestedName}-${id}`.toLowerCase() } }); }
  function track<T>(operation: Promise<T>) { pending.add(operation); operation.finally(() => pending.delete(operation)).catch(() => undefined); return operation; }
});
