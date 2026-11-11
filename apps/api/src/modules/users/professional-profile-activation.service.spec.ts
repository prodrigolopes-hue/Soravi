import { Role, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ProfessionalProfileActivationService } from "./professional-profile-activation.service";
import { ProfessionalProfileActivationUnavailableException } from "./errors/professional-profile-activation-unavailable.exception";
import { ProfessionalCategoryOpenServiceRequestException } from "./errors/professional-category-open-service-request.exception";
import { UsersService } from "./users.service";

describe("ProfessionalProfileActivationService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const input = { professionalTitle: "Eletricista", serviceArea: "São Paulo", bio: "Descrição profissional com mais de trinta caracteres.", categorySlugs: ["eletrica"] };
  let transaction: any; let service: ProfessionalProfileActivationService; let users: any;
  beforeEach(() => {
    transaction = { $queryRaw: jest.fn(), user: { findFirst: jest.fn().mockResolvedValue({ id: userId, name: "Maria", roles: [], professionalProfile: null }) }, category: { findMany: jest.fn().mockResolvedValue([{ id: "category-id" }]) }, serviceRequest: { findFirst: jest.fn().mockResolvedValue(null) }, professionalProfile: { create: jest.fn() }, userRole: { upsert: jest.fn() } };
    users = { findSafeById: jest.fn().mockResolvedValue({ id: userId }) };
    service = new ProfessionalProfileActivationService({ $transaction: jest.fn((callback: any) => callback(transaction)) } as unknown as PrismaService, users as UsersService);
  });
  it.each([UserStatus.PENDING, UserStatus.ACTIVE])("cria perfil elegível %s com categorias e papel", async () => {
    await expect(service.activateCurrentCustomer(userId, input)).resolves.toMatchObject({ id: userId });
    expect(transaction.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] }, roles: { some: { role: Role.CUSTOMER } }, customerProfile: { is: {} } }) }));
    expect(transaction.professionalProfile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId, displayName: "Maria", professionalTitle: input.professionalTitle, serviceArea: input.serviceArea, bio: input.bio }) }));
    expect(transaction.userRole.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_role: { userId, role: Role.PROFESSIONAL } } }));
  });
  it("preserva perfil e categorias existentes e apenas recupera o papel", async () => {
    transaction.user.findFirst.mockResolvedValue({ id: userId, name: "Maria", roles: [], professionalProfile: { id: "profile", deletedAt: null, professionalCategories: [{ categoryId: "category-id" }] } });
    await service.activateCurrentCustomer(userId, { ...input, bio: "Outro texto profissional com mais de trinta caracteres." });
    expect(transaction.professionalProfile.create).not.toHaveBeenCalled();
    expect(transaction.category.findMany).not.toHaveBeenCalled();
    expect(transaction.userRole.upsert).toHaveBeenCalled();
  });
  it("repete a ativação sem revalidar ou sobrescrever perfil já completo", async () => {
    transaction.user.findFirst.mockResolvedValue({ id: userId, name: "Maria", roles: [{ id: "professional-role" }], professionalProfile: { id: "profile", deletedAt: null, professionalCategories: [{ categoryId: "category-id" }] } });
    await service.activateCurrentCustomer(userId, { ...input, professionalTitle: "Outro título", bio: "Outro texto profissional com mais de trinta caracteres." });
    expect(transaction.category.findMany).not.toHaveBeenCalled();
    expect(transaction.serviceRequest.findFirst).not.toHaveBeenCalled();
    expect(transaction.professionalProfile.create).not.toHaveBeenCalled();
  });
  it.each([null, { id: "profile", deletedAt: new Date(), professionalCategories: [] }])("rejeita conta ou perfil inelegível", async (profile) => {
    transaction.user.findFirst.mockResolvedValue(profile === null ? null : { id: userId, name: "Maria", roles: [], professionalProfile: profile });
    await expect(service.activateCurrentCustomer(userId, input)).rejects.toBeInstanceOf(ProfessionalProfileActivationUnavailableException);
  });
  it("rejeita categoria inativa ou inexistente", async () => {
    transaction.category.findMany.mockResolvedValue([]);
    await expect(service.activateCurrentCustomer(userId, input)).rejects.toMatchObject({ response: expect.objectContaining({ code: "INVALID_PROFESSIONAL_PROFILE_CATEGORIES" }) });
  });
  it("rejeita conflito com solicitação própria aberta", async () => {
    transaction.serviceRequest.findFirst.mockResolvedValue({ id: "request" });
    await expect(service.activateCurrentCustomer(userId, input)).rejects.toBeInstanceOf(ProfessionalCategoryOpenServiceRequestException);
  });
});
