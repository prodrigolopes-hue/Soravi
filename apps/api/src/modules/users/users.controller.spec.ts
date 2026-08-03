import { Role, UserStatus, } from "../../generated/prisma/client";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
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
    };

    beforeEach(() => {
        usersServiceMock = {
            findSafeById: jest.fn(),
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
});