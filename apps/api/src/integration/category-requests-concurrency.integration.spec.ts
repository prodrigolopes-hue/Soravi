import { randomUUID } from "node:crypto";

import { ConflictException } from "@nestjs/common";

import { CategoryRequestStatus, Prisma, Role, UserStatus } from "../generated/prisma/client";
import { CategoryRequestsService } from "../modules/category-requests/category-requests.service";
import { createIntegrationPrismaService } from "./integration-database";

interface Fixture {
  professionalUserId: string;
  professionalProfileId: string;
  adminUserId: string;
}

describe("CategoryRequestsService concurrent operations", () => {
  const control = createIntegrationPrismaService();
  const first = createIntegrationPrismaService();
  const second = createIntegrationPrismaService();
  const userIds = new Set<string>();
  const categoryIds = new Set<string>();

  beforeAll(async () => {
    await Promise.all([control.$connect(), first.$connect(), second.$connect()]);
    const [database] = await control.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== "soravi_integration_test") throw new Error("A suíte recusou executar fora do banco de integração.");
  });

  afterEach(async () => {
    const profiles = await control.professionalProfile.findMany({ where: { userId: { in: [...userIds] } }, select: { id: true } });
    const profileIds = profiles.map(({ id }) => id);
    if (profileIds.length) {
      const resolved = await control.categoryRequest.findMany({ where: { professionalProfileId: { in: profileIds } }, select: { resolvedCategoryId: true } });
      for (const { resolvedCategoryId } of resolved) if (resolvedCategoryId) categoryIds.add(resolvedCategoryId);
      await control.categoryRequest.deleteMany({ where: { professionalProfileId: { in: profileIds } } });
      await control.professionalCategory.deleteMany({ where: { professionalProfileId: { in: profileIds } } });
    }
    if (categoryIds.size) await control.category.deleteMany({ where: { id: { in: [...categoryIds] } } });
    if (userIds.size) await control.user.deleteMany({ where: { id: { in: [...userIds] } } });
    userIds.clear();
    categoryIds.clear();
  });

  afterAll(async () => { await Promise.all([control.$disconnect(), first.$disconnect(), second.$disconnect()]); });

  it("mantém uma única decisão para repetição e concorrência", async () => {
    const fixture = await createFixture();
    const request = await createRequest(fixture, "Técnico solar");
    const input = { decision: "CREATE" as const, categorySlug: `solar-${randomUUID()}` };
    await expect(new CategoryRequestsService(control).decide(request.id, fixture.adminUserId, input)).resolves.toMatchObject({ status: CategoryRequestStatus.APPROVED });
    await expect(new CategoryRequestsService(control).decide(request.id, fixture.adminUserId, input)).rejects.toBeInstanceOf(ConflictException);

    const simultaneous = await createRequest(fixture, "Instalador de telhado");
    const simultaneousInput = { decision: "CREATE" as const, categorySlug: `telhado-${randomUUID()}` };
    const results = await Promise.allSettled([
      new CategoryRequestsService(first).decide(simultaneous.id, fixture.adminUserId, simultaneousInput),
      new CategoryRequestsService(second).decide(simultaneous.id, fixture.adminUserId, simultaneousInput),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const finalRequest = await control.categoryRequest.findUniqueOrThrow({ where: { id: simultaneous.id }, select: { status: true, resolvedCategoryId: true } });
    expect(finalRequest).toMatchObject({ status: CategoryRequestStatus.APPROVED });
    expect(await control.professionalCategory.count({ where: { professionalProfileId: fixture.professionalProfileId, categoryId: finalRequest.resolvedCategoryId! } })).toBe(1);
  });

  it("não cria solicitações pendentes duplicadas sob concorrência", async () => {
    const fixture = await createFixture();
    const input = { suggestedName: "  Manutenção   solar ", description: "Painéis" };
    const results = await Promise.allSettled([
      new CategoryRequestsService(first).createCategoryRequest(fixture.professionalUserId, input),
      new CategoryRequestsService(second).createCategoryRequest(fixture.professionalUserId, input),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await control.categoryRequest.count({ where: { professionalProfileId: fixture.professionalProfileId, status: CategoryRequestStatus.PENDING, suggestedNameNormalized: "manutencao solar" } })).toBe(1);
  });

  it("não ultrapassa três categorias com aprovações simultâneas", async () => {
    const fixture = await createFixture();
    await createOfficialAssociation(fixture, "elétrica");
    await createOfficialAssociation(fixture, "pintura");
    const gardening = await createRequest(fixture, "Jardinagem");
    const carpentry = await createRequest(fixture, "Marcenaria");
    const results = await Promise.allSettled([
      new CategoryRequestsService(first).decide(gardening.id, fixture.adminUserId, { decision: "CREATE", categorySlug: `jardinagem-${randomUUID()}` }),
      new CategoryRequestsService(second).decide(carpentry.id, fixture.adminUserId, { decision: "CREATE", categorySlug: `marcenaria-${randomUUID()}` }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await control.professionalCategory.count({ where: { professionalProfileId: fixture.professionalProfileId } })).toBe(3);
    expect(await control.categoryRequest.count({ where: { professionalProfileId: fixture.professionalProfileId, status: CategoryRequestStatus.APPROVED } })).toBe(1);
    expect(await control.categoryRequest.count({ where: { professionalProfileId: fixture.professionalProfileId, status: CategoryRequestStatus.PENDING } })).toBe(1);
  });

  async function createFixture(): Promise<Fixture> {
    const professionalUserId = randomUUID(), professionalProfileId = randomUUID(), adminUserId = randomUUID();
    const professionalEmail = `category-request-${professionalUserId}@example.test`, adminEmail = `category-admin-${adminUserId}@example.test`;
    await control.user.create({ data: { id: professionalUserId, name: "Category request professional", email: professionalEmail, emailNormalized: professionalEmail, passwordHash: "integration-only", status: UserStatus.ACTIVE, roles: { create: { role: Role.PROFESSIONAL } }, professionalProfile: { create: { id: professionalProfileId, displayName: "Category request professional" } } } });
    await control.user.create({ data: { id: adminUserId, name: "Category request admin", email: adminEmail, emailNormalized: adminEmail, passwordHash: "integration-only", status: UserStatus.ACTIVE, roles: { create: { role: Role.ADMIN } } } });
    userIds.add(professionalUserId); userIds.add(adminUserId);
    return { professionalUserId, professionalProfileId, adminUserId };
  }

  function createRequest(fixture: Fixture, suggestedName: string) {
    return control.categoryRequest.create({ data: { professionalProfileId: fixture.professionalProfileId, suggestedName, suggestedNameNormalized: normalize(suggestedName) }, select: { id: true } });
  }

  async function createOfficialAssociation(fixture: Fixture, name: string): Promise<void> {
    const category = await control.category.create({ data: { name, slug: `${normalize(name)}-${randomUUID()}`, isActive: true }, select: { id: true } });
    categoryIds.add(category.id);
    await control.professionalCategory.create({ data: { professionalProfileId: fixture.professionalProfileId, categoryId: category.id } });
  }

  function normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
});
