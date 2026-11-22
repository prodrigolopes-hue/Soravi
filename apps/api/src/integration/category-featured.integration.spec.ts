import { randomUUID } from "node:crypto";
import { CategoriesService } from "../modules/categories/categories.service";
import { createIntegrationPrismaService } from "./integration-database";

describe("destaques da página inicial", () => {
  const control = createIntegrationPrismaService();
  const first = createIntegrationPrismaService();
  const second = createIntegrationPrismaService();
  const prefix = `featured-test-${randomUUID()}`;
  let originalIds: string[] = [];

  beforeAll(async () => {
    await Promise.all([control.$connect(), first.$connect(), second.$connect()]);
    originalIds = (await control.category.findMany({ where: { isFeatured: true }, select: { id: true } })).map(({ id }) => id);
    await control.category.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } });
  });

  afterAll(async () => {
    try {
      await control.category.deleteMany({ where: { slug: { startsWith: prefix } } });
      if (originalIds.length) await control.category.updateMany({ where: { id: { in: originalIds } }, data: { isFeatured: true } });
    } finally { await Promise.all([control.$disconnect(), first.$disconnect(), second.$disconnect()]); }
  });

  it("permite apenas uma de duas inclusões concorrentes quando já existem sete destaques", async () => {
    const items = await Promise.all(Array.from({ length: 9 }, (_, i) => control.category.create({ data: { name: `Teste ${i}`, slug: `${prefix}-${i}`, isFeatured: i < 7 }, select: { id: true } })));
    const outcomes = await Promise.allSettled([new CategoriesService(first).setFeatured(items[7]!.id, true), new CategoriesService(second).setFeatured(items[8]!.id, true)]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(await control.category.count({ where: { isFeatured: true } })).toBe(8);
    const winner = await control.category.findFirstOrThrow({ where: { id: { in: [items[7]!.id, items[8]!.id] }, isFeatured: true }, select: { id: true } });
    await new CategoriesService(control).setFeatured(winner.id, false);
    expect(await control.category.findUniqueOrThrow({ where: { id: winner.id }, select: { isActive: true, isFeatured: true } })).toEqual({ isActive: true, isFeatured: false });
  });
});
