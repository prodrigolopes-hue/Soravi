import { randomUUID } from "node:crypto";

import { Prisma, Role, UserStatus } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CustomerProfileActivationService } from "../modules/users/customer-profile-activation.service";
import { UsersService } from "../modules/users/users.service";
import { createIntegrationPrismaService } from "./integration-database";

describe("Ativação concorrente de perfil cliente", () => {
  const controlPrisma = createIntegrationPrismaService();
  const firstPrisma = createIntegrationPrismaService();
  const secondPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    await Promise.all([controlPrisma.$connect(), firstPrisma.$connect(), secondPrisma.$connect()]);
    const [database] = await controlPrisma.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== "soravi_integration_test") throw new Error("A suíte recusou executar fora do banco de integração.");
  });
  afterEach(async () => {
    for (const userId of createdUserIds) {
      await controlPrisma.user.deleteMany({ where: { id: userId } });
      createdUserIds.delete(userId);
    }
  });
  afterAll(async () => { await Promise.all([controlPrisma.$disconnect(), firstPrisma.$disconnect(), secondPrisma.$disconnect()]); });

  it("não duplica perfil nem papel em ativações simultâneas", async () => {
    const userId = await createProfessional();
    const first = createService(firstPrisma);
    const second = createService(secondPrisma);

    const results = await Promise.allSettled([
      first.activateCurrentProfessional(userId),
      second.activateCurrentProfessional(userId),
    ]);

    expect(results).toHaveLength(2);
    expect(results).toEqual([
      expect.objectContaining({ status: "fulfilled" }),
      expect.objectContaining({ status: "fulfilled" }),
    ]);

    const user = await controlPrisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { customerProfile: { select: { id: true } }, professionalProfile: { select: { id: true } }, roles: { select: { role: true } } },
    });
    expect(user.customerProfile).not.toBeNull();
    expect(user.professionalProfile).not.toBeNull();
    expect(user.roles.map(({ role }) => role)).toEqual(expect.arrayContaining([Role.PROFESSIONAL, Role.CUSTOMER]));
    expect(user.roles.filter(({ role }) => role === Role.CUSTOMER)).toHaveLength(1);
  });

  async function createProfessional(): Promise<string> {
    const id = randomUUID();
    const email = `customer-activation-${randomUUID()}@example.test`;
    createdUserIds.add(id);
    await controlPrisma.user.create({ data: {
      id, name: "Profissional de teste", email, emailNormalized: email, passwordHash: "integration-only", status: UserStatus.ACTIVE,
      roles: { create: { role: Role.PROFESSIONAL } }, professionalProfile: { create: { displayName: "Profissional de teste" } },
    } });
    return id;
  }

  function createService(prisma: PrismaService) {
    return new CustomerProfileActivationService(prisma, new UsersService(prisma));
  }
});
