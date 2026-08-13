import { ProfessionalVerificationStatus, Role, UserStatus, } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UsersAdminCustomersListResponseDto } from "./dto/users-admin-customers-list-response.dto";
import { UsersAdminCustomersQueryDto } from "./dto/users-admin-customers-query.dto";
import { UsersAdminProfessionalsListResponseDto } from "./dto/users-admin-professionals-list-response.dto";
import { UsersAdminProfessionalsQueryDto } from "./dto/users-admin-professionals-query.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
    const userId =
        "525afb87-2b81-4de7-9606-8f382fff3341";

    const sessionId =
        "725afb87-2b81-4de7-9606-8f382fff3341";

    let controller: UsersController;

    let usersServiceMock: {
        findSafeById: jest.Mock;
        findAllAdminCustomers: jest.Mock;
        findAllAdminProfessionals: jest.Mock;
    };

    beforeEach(() => {
        usersServiceMock = {
            findSafeById: jest.fn(),
            findAllAdminCustomers: jest.fn(),
            findAllAdminProfessionals: jest.fn(),
        };

        controller = new UsersController(
            usersServiceMock as unknown as UsersService,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("deve retornar o usuário autenticado", async () => {
        const currentUser: AuthenticatedUser = {
            id: userId,
            sessionId,
            roles: [Role.CUSTOMER],
        };

        const safeUser = new UserResponseDto({
            id: userId,
            name: "Maria da Silva",
            email: "maria.teste@soravi.com.br",
            phone: null,
            status: UserStatus.ACTIVE,
            roles: [Role.CUSTOMER],
            emailVerified: false,
            phoneVerified: false,
            customerProfile: {
                id: "26c03da3-548b-4de6-bf75-783b1fade521",
            },
            professionalProfile: null,
            createdAt: new Date(
                "2026-07-31T17:57:46.624Z",
            ),
        });

        usersServiceMock.findSafeById.mockResolvedValue(
            safeUser,
        );

        const response =
            await controller.findCurrentUser(currentUser);

        expect(
            usersServiceMock.findSafeById,
        ).toHaveBeenCalledWith(userId);

        expect(response).toEqual(safeUser);
        expect(response).not.toHaveProperty("password");
        expect(response).not.toHaveProperty(
            "passwordHash",
        );
        expect(response).not.toHaveProperty("sessions");
    });

    it("deve confirmar acesso profissional", () => {
        const response =
            controller.validateProfessionalAccess();

        expect(response).toEqual({
            data: {
                authorized: true,
                role: Role.PROFESSIONAL,
            },
        });
    });

    it("encaminha a listagem administrativa de clientes", async () => {
        const query = new UsersAdminCustomersQueryDto();
        const response = new UsersAdminCustomersListResponseDto(
            [
                {
                    id: userId,
                    name: "Maria da Silva",
                    email: "maria.teste@soravi.com.br",
                    phone: null,
                    status: UserStatus.ACTIVE,
                    emailVerifiedAt: null,
                    phoneVerifiedAt: null,
                    createdAt: new Date("2026-07-31T17:57:46.624Z"),
                },
            ],
            1,
            20,
            1,
        );

        usersServiceMock.findAllAdminCustomers.mockResolvedValue(
            response,
        );

        const result =
            await controller.findAdminCustomers(query);

        expect(
            usersServiceMock.findAllAdminCustomers,
        ).toHaveBeenCalledWith(query);

        expect(result).toEqual(response);
    });

    it("exige autenticação para listagem administrativa de clientes", () => {
        const guards = Reflect.getMetadata(
            "__guards__",
            UsersController.prototype.findAdminCustomers,
        );

        expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
    });

    it("exige role ADMIN para listagem administrativa de clientes", () => {
        const roles = Reflect.getMetadata(
            "roles",
            UsersController.prototype.findAdminCustomers,
        );

        expect(roles).toEqual([Role.ADMIN]);
    });

    it("encaminha a listagem administrativa de profissionais", async () => {
        const query = new UsersAdminProfessionalsQueryDto();
        const response = new UsersAdminProfessionalsListResponseDto(
            [
                {
                    id: userId,
                    name: "Maria da Silva",
                    email: "maria.teste@soravi.com.br",
                    phone: null,
                    status: UserStatus.ACTIVE,
                    emailVerifiedAt: null,
                    phoneVerifiedAt: null,
                    createdAt: new Date("2026-07-31T17:57:46.624Z"),
                    professionalProfile: {
                        id: "46c03da3-548b-4de6-bf75-783b1fade999",
                        displayName: "Maria da Silva",
                        verificationStatus: ProfessionalVerificationStatus.NOT_STARTED,
                        isAvailable: true,
                    },
                },
            ],
            1,
            20,
            1,
        );

        usersServiceMock.findAllAdminProfessionals.mockResolvedValue(
            response,
        );

        const result =
            await controller.findAdminProfessionals(query);

        expect(
            usersServiceMock.findAllAdminProfessionals,
        ).toHaveBeenCalledWith(query);

        expect(result).toEqual(response);
    });

    it("exige autenticação para listagem administrativa de profissionais", () => {
        const guards = Reflect.getMetadata(
            "__guards__",
            UsersController.prototype.findAdminProfessionals,
        );

        expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
    });

    it("exige role ADMIN para listagem administrativa de profissionais", () => {
        const roles = Reflect.getMetadata(
            "roles",
            UsersController.prototype.findAdminProfessionals,
        );

        expect(roles).toEqual([Role.ADMIN]);
    });
});