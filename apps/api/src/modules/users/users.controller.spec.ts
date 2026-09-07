import { HttpStatus } from "@nestjs/common";
import { ProfessionalVerificationStatus, Role, UserStatus, } from "../../generated/prisma/client";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UsersAdminCustomersListResponseDto } from "./dto/users-admin-customers-list-response.dto";
import { UsersAdminCustomersQueryDto } from "./dto/users-admin-customers-query.dto";
import { UsersAdminProfessionalsListResponseDto } from "./dto/users-admin-professionals-list-response.dto";
import { UsersAdminProfessionalsQueryDto } from "./dto/users-admin-professionals-query.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersController } from "./users.controller";
import { UsersPasswordService } from "./users-password.service";
import { UsersPhoneService } from "./users-phone.service";
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
    let usersPhoneServiceMock: {
        updateCurrentUserPhone: jest.Mock;
    };
    let usersPasswordServiceMock: {
        updateCurrentUserPassword: jest.Mock;
    };

    beforeEach(() => {
        usersServiceMock = {
            findSafeById: jest.fn(),
            findAllAdminCustomers: jest.fn(),
            findAllAdminProfessionals: jest.fn(),
        };
        usersPhoneServiceMock = {
            updateCurrentUserPhone: jest.fn(),
        };
        usersPasswordServiceMock = {
            updateCurrentUserPassword: jest.fn(),
        };

        controller = new UsersController(
            usersServiceMock as unknown as UsersService,
            usersPhoneServiceMock as unknown as UsersPhoneService,
            usersPasswordServiceMock as unknown as UsersPasswordService,
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
            phoneVerifiedAt: null,
        };

        const safeUser = createUserResponse(Role.CUSTOMER);

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

    it.each([Role.CUSTOMER, Role.ADMIN])(
        "permite que usuário autenticado %s altere o próprio telefone",
        async (role) => {
            const currentUser: AuthenticatedUser = {
                id: userId,
                sessionId,
                roles: [role],
                phoneVerifiedAt: null,
            };
            const input = {
                phone: "(11) 98888-7777",
                currentPassword: "senha atual",
            };
            const response = createUserResponse(role);
            usersPhoneServiceMock.updateCurrentUserPhone.mockResolvedValue(
                response,
            );

            await expect(
                controller.updateCurrentUserPhone(currentUser, input),
            ).resolves.toBe(response);
            expect(
                usersPhoneServiceMock.updateCurrentUserPhone,
            ).toHaveBeenCalledWith(userId, sessionId, input);
        },
    );

    it("protege a alteração com autenticação e throttle, sem PhoneVerifiedGuard", () => {
        const guards = Reflect.getMetadata(
            "__guards__",
            UsersController.prototype.updateCurrentUserPhone,
        );

        expect(guards).toEqual([AccessTokenGuard, ThrottlerGuard]);
    });

    it("limita a alteração a três tentativas por hora", () => {
        const values = Reflect.getMetadataKeys(
            UsersController.prototype.updateCurrentUserPhone,
        )
            .filter((key) => String(key).toLowerCase().includes("throttler"))
            .map((key) => Reflect.getMetadata(
                key,
                UsersController.prototype.updateCurrentUserPhone,
            ));

        expect(values).toEqual(expect.arrayContaining([3, 3_600_000]));
    });

    it.each([Role.CUSTOMER, Role.PROFESSIONAL])(
        "permite que usuário autenticado %s altere a própria senha",
        async (role) => {
            const currentUser: AuthenticatedUser = {
                id: userId,
                sessionId,
                roles: [role],
                phoneVerifiedAt: null,
            };
            const input = {
                currentPassword: "senha atual",
                newPassword: "nova senha ok",
            };
            usersPasswordServiceMock.updateCurrentUserPassword.mockResolvedValue(
                undefined,
            );

            await expect(
                controller.updateCurrentUserPassword(currentUser, input),
            ).resolves.toBeUndefined();
            expect(
                usersPasswordServiceMock.updateCurrentUserPassword,
            ).toHaveBeenCalledWith(userId, sessionId, input);
        },
    );

    it("protege a alteração de senha com autenticação e throttle, sem PhoneVerifiedGuard", () => {
        const guards = Reflect.getMetadata(
            "__guards__",
            UsersController.prototype.updateCurrentUserPassword,
        );

        expect(guards).toEqual([AccessTokenGuard, ThrottlerGuard]);
    });

    it("limita a alteração de senha a três tentativas por hora", () => {
        const values = Reflect.getMetadataKeys(
            UsersController.prototype.updateCurrentUserPassword,
        )
            .filter((key) => String(key).toLowerCase().includes("throttler"))
            .map((key) => Reflect.getMetadata(
                key,
                UsersController.prototype.updateCurrentUserPassword,
            ));

        expect(values).toEqual(expect.arrayContaining([3, 3_600_000]));
    });

    it("retorna 204 na alteração de senha", () => {
        expect(Reflect.getMetadata(
            "__httpCode__",
            UsersController.prototype.updateCurrentUserPassword,
        )).toBe(HttpStatus.NO_CONTENT);
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

    function createUserResponse(role: Role): UserResponseDto {
        return new UserResponseDto({
            id: userId,
            name: "Maria da Silva",
            email: "maria.teste@soravi.com.br",
            phone: "(11) 98888-7777",
            status: UserStatus.ACTIVE,
            roles: [role],
            emailVerified: false,
            phoneVerified: false,
            customerProfile: {
                id: "26c03da3-548b-4de6-bf75-783b1fade521",
            },
            professionalProfile: null,
            createdAt: new Date("2026-07-31T17:57:46.624Z"),
        });
    }
});
