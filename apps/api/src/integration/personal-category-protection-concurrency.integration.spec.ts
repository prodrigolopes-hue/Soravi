import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { Role, UserStatus } from "../generated/prisma/client";
import { ServiceRequestOwnProfessionalCategoryException } from "../modules/service-requests/errors/service-request-own-professional-category.exception";
import { ServiceRequestsService } from "../modules/service-requests/service-requests.service";
import { ProfessionalCategoryOpenServiceRequestException } from "../modules/users/errors/professional-category-open-service-request.exception";
import { CurrentProfessionalProfileService } from "../modules/users/current-professional-profile.service";
import { ProfessionalProfilePhotoReadService } from "../modules/users/professional-profile-photo-read.service";
import { deferred, queryRawSql, waitUntilPostgresConfirmsBlocking, wrapPrisma } from "./integration-concurrency";
import { createIntegrationPrismaService } from "./integration-database";

interface Fixture { userId: string; requestCategoryId: string; requestCategorySlug: string; existingCategorySlug: string; }

describe("Proteção pessoal de categorias concorrente", () => {
  const controlPrisma = createIntegrationPrismaService();
  const publishPrisma = createIntegrationPrismaService();
  const categoryPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdCategoryIds = new Set<string>();
  const pendingOperations = new Set<Promise<unknown>>();
  const photoReadService = { createTemporaryReadUrl: jest.fn().mockResolvedValue(null) };

  beforeAll(async () => { await Promise.all([controlPrisma.$connect(), publishPrisma.$connect(), categoryPrisma.$connect()]); });
  afterEach(async () => {
    let cleanupError: unknown;
    await Promise.allSettled([...pendingOperations]);
    for (const userId of createdUserIds) {
      try {
        await controlPrisma.serviceRequest.deleteMany({
          where: { customerProfile: { userId } },
        });
      } catch (error: unknown) {
        cleanupError ??= error;
      }
    }
    for (const userId of createdUserIds) {
      try {
        await controlPrisma.user.deleteMany({ where: { id: userId } });
        createdUserIds.delete(userId);
      } catch (error: unknown) {
        cleanupError ??= error;
      }
    }
    for (const categoryId of createdCategoryIds) {
      try {
        await controlPrisma.category.deleteMany({ where: { id: categoryId } });
        createdCategoryIds.delete(categoryId);
      } catch (error: unknown) {
        cleanupError ??= error;
      }
    }
    if (cleanupError) throw cleanupError;
  });
  afterAll(async () => { await Promise.all([controlPrisma.$disconnect(), publishPrisma.$disconnect(), categoryPrisma.$disconnect()]); });

  it("rejeita a adição quando a publicação vence a corrida", async () => {
    const fixture = await createFixture();
    const acquired = deferred<void>();
    const release = deferred<void>();
    const blockedPid = deferred<number>();
    const publishing = publishingService(wrapPrisma(publishPrisma, { afterQueryRaw: async (args) => { if (queryRawSql(args).includes('FROM "users"')) { acquired.resolve(); await release.promise; } } }));
    const profile = profileService(wrapPrisma(categoryPrisma, { transactionStarted: (pid) => blockedPid.resolve(pid) }));
    let publication: Promise<unknown> | undefined;
    let categoryUpdate: Promise<unknown> | undefined;
    try {
      publication = track(publish(fixture, publishing));
      await acquired.promise;
      categoryUpdate = track(addCategory(fixture, profile));
      await waitUntilPostgresConfirmsBlocking(controlPrisma, await blockedPid.promise);
      release.resolve();
      await expect(publication).resolves.toMatchObject({ categoryId: fixture.requestCategoryId });
      await expect(categoryUpdate).rejects.toBeInstanceOf(ProfessionalCategoryOpenServiceRequestException);
      await expect(requestCount(fixture.userId)).resolves.toBe(1);
    } finally {
      release.resolve();
      await settle(publication, categoryUpdate);
    }
  });

  it("rejeita a publicação sem persistir solicitação quando a adição vence a corrida", async () => {
    const fixture = await createFixture();
    const acquired = deferred<void>();
    const release = deferred<void>();
    const blockedPid = deferred<number>();
    const profile = profileService(wrapPrisma(categoryPrisma, { afterQueryRaw: async (args) => { if (queryRawSql(args).includes('FROM "users"')) { acquired.resolve(); await release.promise; } } }));
    const publishing = publishingService(wrapPrisma(publishPrisma, { transactionStarted: (pid) => blockedPid.resolve(pid) }));
    let categoryUpdate: Promise<unknown> | undefined;
    let publication: Promise<unknown> | undefined;
    try {
      categoryUpdate = track(addCategory(fixture, profile));
      await acquired.promise;
      publication = track(publish(fixture, publishing));
      await waitUntilPostgresConfirmsBlocking(controlPrisma, await blockedPid.promise);
      release.resolve();
      await expect(categoryUpdate).resolves.toBeDefined();
      await expect(publication).rejects.toBeInstanceOf(ServiceRequestOwnProfessionalCategoryException);
      await expect(requestCount(fixture.userId)).resolves.toBe(0);
    } finally {
      release.resolve();
      await settle(categoryUpdate, publication);
    }
  });

  async function createFixture(): Promise<Fixture> {
    const fixture: Fixture = { userId: randomUUID(), requestCategoryId: randomUUID(), requestCategorySlug: `request-${randomUUID()}`, existingCategorySlug: `existing-${randomUUID()}` };
    const existingCategoryId = randomUUID();
    const email = `personal-category-${randomUUID()}@example.test`;
    createdUserIds.add(fixture.userId); createdCategoryIds.add(fixture.requestCategoryId); createdCategoryIds.add(existingCategoryId);
    await controlPrisma.category.createMany({ data: [
      { id: fixture.requestCategoryId, name: "Categoria solicitada", slug: fixture.requestCategorySlug, isActive: true, displayOrder: 0 },
      { id: existingCategoryId, name: "Categoria atual", slug: fixture.existingCategorySlug, isActive: true, displayOrder: 1 },
    ] });
    await controlPrisma.user.create({ data: {
      id: fixture.userId, name: "Pessoa concorrente", email, emailNormalized: email, passwordHash: "integration-only", status: UserStatus.ACTIVE,
      roles: { create: [{ role: Role.CUSTOMER }, { role: Role.PROFESSIONAL }] }, customerProfile: { create: {} },
      professionalProfile: { create: { displayName: "Profissional concorrente", professionalCategories: { create: { categoryId: existingCategoryId } } } },
    } });
    return fixture;
  }

  function publishingService(prisma: PrismaService): ServiceRequestsService { return new ServiceRequestsService(prisma, {} as never, { distribute: jest.fn().mockResolvedValue(undefined) } as never); }
  function profileService(prisma: PrismaService): CurrentProfessionalProfileService { return new CurrentProfessionalProfileService(prisma, photoReadService as unknown as ProfessionalProfilePhotoReadService); }
  function publish(fixture: Fixture, service: ServiceRequestsService) { return service.createServiceRequest(fixture.userId, { categoryId: fixture.requestCategoryId, title: "Preciso de ajuda", location: { country: "BR", state: "SP", city: "São Paulo", neighborhood: "Centro", postalCode: "01000-000", addressLine: "Rua A", addressNumber: "1" } }); }
  function addCategory(fixture: Fixture, service: CurrentProfessionalProfileService) { return service.updateCurrent(fixture.userId, { displayName: "Profissional concorrente", categorySlugs: [fixture.existingCategorySlug, fixture.requestCategorySlug], isAvailable: true }); }
  function requestCount(userId: string) { return controlPrisma.serviceRequest.count({ where: { customerProfile: { userId }, deletedAt: null } }); }
  async function settle(...operations: Array<Promise<unknown> | undefined>): Promise<void> { await Promise.allSettled(operations.filter((operation): operation is Promise<unknown> => operation !== undefined)); }
  function track<T>(operation: Promise<T>): Promise<T> {
    pendingOperations.add(operation);
    operation.then(
      () => pendingOperations.delete(operation),
      () => pendingOperations.delete(operation),
    );
    return operation;
  }
});
