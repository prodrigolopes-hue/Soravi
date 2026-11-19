import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { CategoryRequestStatus, Prisma } from "../generated/prisma/client";
import { CategoriesService } from "../modules/categories/categories.service";
import { createIntegrationPrismaService } from "./integration-database";

describe("Admin category separation", () => {
  const db = createIntegrationPrismaService();
  const service = new CategoriesService(db);
  const users = new Set<string>();
  const categories = new Set<string>();
  const requests = new Set<string>();
  beforeAll(async () => {
    await db.$connect();
    const [database] = await db.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database.current_database !== "soravi_integration_test") throw new Error("Banco de integração incorreto.");
  });
  afterEach(async () => {
    await db.categoryRequest.deleteMany({ where: { id: { in: [...requests] } } });
    const profiles = await db.professionalProfile.findMany({ where: { userId: { in: [...users] } }, select: { id: true } });
    await db.professionalCategory.deleteMany({ where: { professionalProfileId: { in: profiles.map((profile) => profile.id) } } });
    await db.user.deleteMany({ where: { id: { in: [...users] } } });
    await db.category.deleteMany({ where: { id: { in: [...categories] } } });
    users.clear(); categories.clear(); requests.clear();
  });
  afterAll(async () => { await db.$disconnect(); });
  async function fixture() {
    const userId = randomUUID(), profileId = randomUUID(), categoryId = randomUUID(), requestId = randomUUID();
    users.add(userId); categories.add(categoryId); requests.add(requestId);
    await db.user.create({ data: { id: userId, name: "Profissional de teste", email: `${userId}@example.test`, emailNormalized: `${userId}@example.test`, passwordHash: "test", professionalProfile: { create: { id: profileId, displayName: "Profissional de teste" } } } });
    await db.category.create({ data: { id: categoryId, name: "Categoria combinada", slug: `combined-${categoryId}`, isActive: true } });
    await db.professionalCategory.create({ data: { professionalProfileId: profileId, categoryId } });
    await db.categoryRequest.create({ data: { id: requestId, professionalProfileId: profileId, suggestedName: "Categoria combinada", suggestedNameNormalized: "categoria combinada", status: CategoryRequestStatus.APPROVED, resolvedCategoryId: categoryId, resolvedCategories: { create: { categoryId } } } });
    return { userId, profileId, categoryId, requestId };
  }
  it("edita o nome sem alterar endereço, vínculos ou histórico", async () => {
    const f = await fixture();
    const updated = await service.editName(f.categoryId, "Categoria ajustada", "Categoria combinada");
    expect(updated.name).toBe("Categoria ajustada");
    expect(updated.slug).toBe(`combined-${f.categoryId}`);
    expect(await db.professionalCategory.count({ where: { professionalProfileId: f.profileId, categoryId: f.categoryId } })).toBe(1);
    expect((await db.categoryRequest.findUniqueOrThrow({ where: { id: f.requestId } })).resolvedCategoryId).toBe(f.categoryId);
  });
  it("preserva endereço, histórico e vínculo original e associa a nova categoria escolhida", async () => {
    const f = await fixture(); const newName = `Nova categoria ${randomUUID()}`;
    const preview = await service.splitPreview(f.categoryId);
    expect(preview.professionals).toEqual([expect.objectContaining({ id: f.profileId })]);
    const result = await service.split(f.categoryId, { expectedName: "Categoria combinada", originalName: "Categoria corrigida", newName, professionalProfileIds: [f.profileId] });
    categories.add(result.created.id);
    expect(result.original.slug).toBe(`combined-${f.categoryId}`);
    expect(await db.professionalCategory.count({ where: { professionalProfileId: f.profileId, categoryId: { in: [f.categoryId, result.created.id] } } })).toBe(2);
    const request = await db.categoryRequest.findUniqueOrThrow({ where: { id: f.requestId }, include: { resolvedCategories: true } });
    expect(request.resolvedCategoryId).toBe(f.categoryId);
    expect(request.resolvedCategories.map((item) => item.categoryId)).toEqual([f.categoryId]);
  });
  it("recusa substituir um nome que mudou desde a consulta", async () => {
    const f = await fixture();
    await expect(service.editName(f.categoryId, "Nome pretendido", "Nome desatualizado")).rejects.toBeInstanceOf(ConflictException);
    await expect(service.split(f.categoryId, { expectedName: "Nome desatualizado", originalName: "Nome pretendido", newName: `Nova ${randomUUID()}`, professionalProfileIds: [f.profileId] })).rejects.toBeInstanceOf(ConflictException);
    expect((await db.category.findUniqueOrThrow({ where: { id: f.categoryId } })).name).toBe("Categoria combinada");
  });
  it("recusa selecionar um profissional não vinculado à categoria", async () => {
    const f = await fixture();
    const newName = `Sem vínculo ${randomUUID()}`;
    await expect(service.split(f.categoryId, { expectedName: "Categoria combinada", originalName: "Não deve salvar", newName, professionalProfileIds: [randomUUID()] })).rejects.toBeInstanceOf(ConflictException);
    expect((await db.category.findUniqueOrThrow({ where: { id: f.categoryId } })).name).toBe("Categoria combinada");
    expect(await db.category.count({ where: { name: newName } })).toBe(0);
  });
  it("não altera nada quando o profissional já atingiu o limite", async () => {
    const f = await fixture();
    for (let i = 0; i < 9; i++) { const id = randomUUID(); categories.add(id); await db.category.create({ data: { id, name: `Extra ${i}`, slug: `extra-${id}` } }); await db.professionalCategory.create({ data: { categoryId: id, professionalProfileId: f.profileId } }); }
    const newName = `Limit category ${randomUUID()}`;
    await expect(service.split(f.categoryId, { expectedName: "Categoria combinada", originalName: "Não deve salvar", newName, professionalProfileIds: [f.profileId] })).rejects.toBeInstanceOf(ConflictException);
    expect((await db.category.findUniqueOrThrow({ where: { id: f.categoryId } })).name).toBe("Categoria combinada");
    expect(await db.category.count({ where: { name: newName } })).toBe(0);
  });
});
