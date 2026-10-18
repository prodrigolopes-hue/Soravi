import { randomUUID } from "node:crypto";
import { Prisma, Role, UserStatus } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ProfessionalProfileActivationService } from "../modules/users/professional-profile-activation.service";
import { ProfessionalCategoryOpenServiceRequestException } from "../modules/users/errors/professional-category-open-service-request.exception";
import { ServiceRequestOwnProfessionalCategoryException } from "../modules/service-requests/errors/service-request-own-professional-category.exception";
import { ServiceRequestsService } from "../modules/service-requests/service-requests.service";
import { UsersService } from "../modules/users/users.service";
import { createIntegrationPrismaService } from "./integration-database";
import { deferred, queryRawSql, waitUntilPostgresConfirmsBlocking, wrapPrisma } from "./integration-concurrency";

describe("Ativação concorrente de perfil profissional", () => {
  const controlPrisma = createIntegrationPrismaService();
  const firstPrisma = createIntegrationPrismaService();
  const secondPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdCategoryIds = new Set<string>();
  const pendingOperations = new Set<Promise<unknown>>();

  beforeAll(async () => { await Promise.all([controlPrisma.$connect(), firstPrisma.$connect(), secondPrisma.$connect()]); const [database] = await controlPrisma.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`); if (database?.current_database !== "soravi_integration_test") throw new Error("A suíte recusou executar fora do banco de integração."); });
  afterEach(async () => { await Promise.allSettled([...pendingOperations]); for (const userId of createdUserIds) { await controlPrisma.serviceRequest.deleteMany({ where: { customerProfile: { userId } } }); await controlPrisma.user.deleteMany({ where: { id: userId } }); createdUserIds.delete(userId); } for (const id of createdCategoryIds) { await controlPrisma.category.deleteMany({ where: { id } }); createdCategoryIds.delete(id); } });
  afterAll(async () => { await Promise.all([controlPrisma.$disconnect(), firstPrisma.$disconnect(), secondPrisma.$disconnect()]); });

  it("não duplica perfil, categorias ou papel em ativações simultâneas", async () => {
    const fixture = await createFixture();
    const first = activationService(firstPrisma); const second = activationService(secondPrisma);
    const results = await Promise.allSettled([track(first.activateCurrentCustomer(fixture.userId, fixture.input)), track(second.activateCurrentCustomer(fixture.userId, fixture.input))]);
    expect(results).toEqual([expect.objectContaining({ status: "fulfilled" }), expect.objectContaining({ status: "fulfilled" })]);
    const user = await controlPrisma.user.findUniqueOrThrow({ where: { id: fixture.userId }, select: { professionalProfile: { select: { verificationStatus: true, isAvailable: true, professionalCategories: { select: { categoryId: true } } } }, roles: { select: { role: true } } } });
    expect(user.professionalProfile?.professionalCategories).toHaveLength(1);
    expect(user.professionalProfile).toMatchObject({ verificationStatus: "NOT_STARTED", isAvailable: true });
    expect(user.roles.filter(({ role }) => role === Role.PROFESSIONAL)).toHaveLength(1);
  });

  it("rejeita ativação quando a publicação vence a corrida", async () => {
    const fixture = await createFixture(); const acquired = deferred<void>(); const release = deferred<void>(); const blockedPid = deferred<number>();
    const publishing = requestService(wrapPrisma(firstPrisma, { afterQueryRaw: async (args) => { if (queryRawSql(args).includes('FROM "users"')) { acquired.resolve(); await release.promise; } } }));
    const activation = activationService(wrapPrisma(secondPrisma, { transactionStarted: (pid) => blockedPid.resolve(pid) }));
    let publish: Promise<unknown> | undefined; let activate: Promise<unknown> | undefined;
    try { publish = track(createRequest(publishing, fixture)); await acquired.promise; activate = track(activation.activateCurrentCustomer(fixture.userId, fixture.input)); await waitUntilPostgresConfirmsBlocking(controlPrisma, await blockedPid.promise); release.resolve(); await expect(publish).resolves.toBeDefined(); await expect(activate).rejects.toBeInstanceOf(ProfessionalCategoryOpenServiceRequestException); await Promise.allSettled([publish, activate].filter((item): item is Promise<unknown> => item !== undefined));
      const user = await controlPrisma.user.findUniqueOrThrow({ where: { id: fixture.userId }, select: { professionalProfile: { select: { id: true } }, roles: { select: { role: true } } } });
      await expect(controlPrisma.serviceRequest.count({ where: { customerProfile: { userId: fixture.userId }, deletedAt: null } })).resolves.toBe(1);
      expect(user.professionalProfile).toBeNull();
      expect(user.roles.some(({ role }) => role === Role.PROFESSIONAL)).toBe(false);
    } finally { release.resolve(); await Promise.allSettled([publish, activate].filter((item): item is Promise<unknown> => item !== undefined)); }
  });

  it("rejeita publicação quando a ativação vence a corrida", async () => {
    const fixture = await createFixture(); const acquired = deferred<void>(); const release = deferred<void>(); const blockedPid = deferred<number>();
    const activation = activationService(wrapPrisma(firstPrisma, { afterQueryRaw: async (args) => { if (queryRawSql(args).includes('FROM "users"')) { acquired.resolve(); await release.promise; } } }));
    const publishing = requestService(wrapPrisma(secondPrisma, { transactionStarted: (pid) => blockedPid.resolve(pid) }));
    let activate: Promise<unknown> | undefined; let publish: Promise<unknown> | undefined;
    try { activate = track(activation.activateCurrentCustomer(fixture.userId, fixture.input)); await acquired.promise; publish = track(createRequest(publishing, fixture)); await waitUntilPostgresConfirmsBlocking(controlPrisma, await blockedPid.promise); release.resolve(); await expect(activate).resolves.toBeDefined(); await expect(publish).rejects.toBeInstanceOf(ServiceRequestOwnProfessionalCategoryException); await Promise.allSettled([activate, publish].filter((item): item is Promise<unknown> => item !== undefined));
      const user = await controlPrisma.user.findUniqueOrThrow({ where: { id: fixture.userId }, select: { professionalProfile: { select: { professionalCategories: { select: { categoryId: true } } } }, roles: { select: { role: true } } } });
      expect(user.professionalProfile?.professionalCategories).toEqual([{ categoryId: fixture.categoryId }]);
      expect(user.roles.some(({ role }) => role === Role.PROFESSIONAL)).toBe(true);
      await expect(controlPrisma.serviceRequest.count({ where: { customerProfile: { userId: fixture.userId }, deletedAt: null } })).resolves.toBe(0);
    } finally { release.resolve(); await Promise.allSettled([activate, publish].filter((item): item is Promise<unknown> => item !== undefined)); }
  });

  async function createFixture() { const userId = randomUUID(); const categoryId = randomUUID(); const slug = `activation-${randomUUID()}`; const email = `activation-${randomUUID()}@example.test`; createdUserIds.add(userId); createdCategoryIds.add(categoryId); await controlPrisma.category.create({ data: { id: categoryId, name: "Elétrica", slug, isActive: true, displayOrder: 0 } }); await controlPrisma.user.create({ data: { id: userId, name: "Cliente", email, emailNormalized: email, passwordHash: "integration-only", status: UserStatus.ACTIVE, roles: { create: { role: Role.CUSTOMER } }, customerProfile: { create: {} } } }); return { userId, categoryId, input: { professionalTitle: "Eletricista", serviceArea: "São Paulo", bio: "Descrição profissional com mais de trinta caracteres.", categorySlugs: [slug] } }; }
  function activationService(prisma: PrismaService) { return new ProfessionalProfileActivationService(prisma, new UsersService(prisma)); }
  function requestService(prisma: PrismaService) { return new ServiceRequestsService(prisma, {} as never, { distribute: jest.fn().mockResolvedValue(undefined) } as never); }
  function createRequest(service: ServiceRequestsService, fixture: Awaited<ReturnType<typeof createFixture>>) { return service.createServiceRequest(fixture.userId, { categoryId: fixture.categoryId, title: "Preciso de ajuda", location: { country: "BR", state: "SP", city: "São Paulo", neighborhood: "Centro", postalCode: "01000-000", addressLine: "Rua A", addressNumber: "1" } }); }
  function track<T>(operation: Promise<T>) { pendingOperations.add(operation); operation.finally(() => pendingOperations.delete(operation)).catch(() => undefined); return operation; }
});
