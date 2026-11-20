import { randomUUID } from "node:crypto";
import { IdentityVerificationResult, Prisma, ProfessionalIdentityVerificationAttemptStatus, ProfessionalVerificationStatus, Role, UserStatus } from "../generated/prisma/client";
import { ProfessionalDiscoveryService } from "../modules/professional-discovery/professional-discovery.service";
import { PublicProfessionalDiscoveryQueryDto } from "../modules/professional-discovery/dto/public-professional-discovery-query.dto";
import { ProfessionalProfilePhotoReadService } from "../modules/users/professional-profile-photo-read.service";
import { OutboundNotificationsService } from "../modules/notifications/outbound-notifications.service";
import { ServiceOpportunityDistributionService } from "../modules/service-requests/service-opportunity-distribution.service";
import { createIntegrationPrismaService } from "./integration-database";

describe("identity gating for new opportunities", () => {
  const db = createIntegrationPrismaService();
  const service = new ServiceOpportunityDistributionService(db, { createPending: jest.fn().mockResolvedValue(null) } as unknown as OutboundNotificationsService);
  const users: string[] = [], categories: string[] = [], requests: string[] = [], profiles: string[] = [], identities: string[] = [];
  beforeAll(async () => {
    await db.$connect();
    const [database] = await db.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database.current_database !== "soravi_integration_test") throw new Error("Banco de integração incorreto.");
  });
  afterEach(async () => {
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.serviceOpportunity.deleteMany({ where: { serviceRequestId: { in: requests } } });
    await db.serviceRequest.deleteMany({ where: { id: { in: requests } } });
    await db.professionalIdentityVerificationAttempt.deleteMany({ where: { professionalProfileId: { in: profiles } } });
    await db.personalIdentity.deleteMany({ where: { id: { in: identities } } });
    await db.professionalCategory.deleteMany({ where: { professionalProfileId: { in: profiles } } });
    await db.category.deleteMany({ where: { id: { in: categories } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    users.length = categories.length = requests.length = profiles.length = identities.length = 0;
  });
  afterAll(async () => { await db.$disconnect(); });
  async function fixture() {
    const customerId = randomUUID(), customerProfileId = randomUUID(), categoryId = randomUUID(), requestId = randomUUID(); users.push(customerId); categories.push(categoryId); requests.push(requestId);
    await db.user.create({ data: { id: customerId, name: "Cliente teste", email: `${customerId}@example.test`, emailNormalized: `${customerId}@example.test`, passwordHash: "test", status: UserStatus.ACTIVE, customerProfile: { create: { id: customerProfileId } } } });
    await db.category.create({ data: { id: categoryId, name: "Categoria teste", slug: `category-${categoryId}`, isActive: true } });
    await db.serviceRequest.create({ data: { id: requestId, publicCode: `SRV-${randomUUID().slice(0,8).toUpperCase()}`, customerProfileId, categoryId, title: "Teste", country: "BR", state: "RJ", city: "Niterói", neighborhood: "Centro", postalCode: "00000000", addressLine: "Rua teste", addressNumber: "1", editableUntil: new Date(0), publishedAt: new Date() } });
    return { categoryId, requestId };
  }
  async function professional(categoryId: string) {
    const userId = randomUUID(), profileId = randomUUID(), identityId = randomUUID(); users.push(userId); profiles.push(profileId); identities.push(identityId);
    await db.user.create({ data: { id: userId, name: "Profissional teste", email: `${userId}@example.test`, emailNormalized: `${userId}@example.test`, passwordHash: "test", status: UserStatus.ACTIVE, roles: { create: { role: Role.PROFESSIONAL } }, professionalProfile: { create: { id: profileId, displayName: "Profissional teste", verificationStatus: ProfessionalVerificationStatus.APPROVED } }, personalIdentity: { create: { id: identityId, cpfEnvelope: {}, cpfHmac: identityId, hmacKeyId: "test" } } } });
    await db.professionalCategory.create({ data: { professionalProfileId: profileId, categoryId } });
    return { profileId, identityId };
  }
  async function addAttempt(profileId: string, identityId: string, result: IdentityVerificationResult, createdAt: Date) {
    await db.professionalIdentityVerificationAttempt.create({ data: { professionalProfileId: profileId, personalIdentityId: identityId, status: ProfessionalIdentityVerificationAttemptStatus.CLOSED, result, createdAt, closedAt: createdAt } });
  }
  it("atribui somente ao confirmado e respeita uma decisão posterior não confirmada", async () => {
    const f = await fixture(); const confirmed = await professional(f.categoryId), pending = await professional(f.categoryId), revised = await professional(f.categoryId);
    await addAttempt(confirmed.profileId, confirmed.identityId, IdentityVerificationResult.CONFIRMED, new Date("2026-01-01T00:00:00Z"));
    await addAttempt(revised.profileId, revised.identityId, IdentityVerificationResult.CONFIRMED, new Date("2026-01-01T00:00:00Z"));
    await addAttempt(revised.profileId, revised.identityId, IdentityVerificationResult.NOT_CONFIRMED, new Date("2026-01-02T00:00:00Z"));
    expect(await service.distribute(f.requestId)).toEqual({ dispatched: true, opportunitiesCreated: 1 });
    expect(await db.serviceOpportunity.findMany({ where: { serviceRequestId: f.requestId }, select: { professionalProfileId: true } })).toEqual([{ professionalProfileId: confirmed.profileId }]);
    expect(pending.profileId).not.toBe(confirmed.profileId);
    const discovery = new ProfessionalDiscoveryService(db, { createTemporaryReadUrl: jest.fn().mockResolvedValue(null) } as unknown as ProfessionalProfilePhotoReadService);
    const publicList = await discovery.findByCategory(`category-${f.categoryId}`, new PublicProfessionalDiscoveryQueryDto());
    expect(publicList.items.find((item) => item.id === confirmed.profileId)?.identityVerified).toBe(true);
    expect(publicList.items.find((item) => item.id === pending.profileId)?.identityVerified).toBe(false);
    expect(publicList.items.find((item) => item.id === revised.profileId)?.identityVerified).toBe(false);
    expect(publicList.items[0]).not.toHaveProperty("identityVerificationAttempts");
  });
  it("não atribui solicitação direcionada a identidade não confirmada", async () => {
    const f = await fixture(); const unverified = await professional(f.categoryId);
    await db.serviceRequest.update({ where: { id: f.requestId }, data: { targetProfessionalProfileId: unverified.profileId } });
    expect(await service.distribute(f.requestId)).toEqual({ dispatched: true, opportunitiesCreated: 0 });
    expect(await db.serviceOpportunity.count({ where: { serviceRequestId: f.requestId } })).toBe(0);
    expect((await db.serviceRequest.findUniqueOrThrow({ where: { id: f.requestId } })).targetProfessionalUnavailableAt).not.toBeNull();
  });
  it("preserva uma oportunidade já existente enquanto impede novas atribuições", async () => {
    const f = await fixture(); const unverified = await professional(f.categoryId);
    const existing = await db.serviceOpportunity.create({ data: { serviceRequestId: f.requestId, professionalProfileId: unverified.profileId } });
    expect(await service.distribute(f.requestId)).toEqual({ dispatched: false, opportunitiesCreated: 0 });
    expect(await db.serviceOpportunity.findUnique({ where: { id: existing.id } })).not.toBeNull();
  });

});
