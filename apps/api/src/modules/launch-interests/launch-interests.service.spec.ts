import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import {
    LaunchInterestSource,
    LaunchInterestType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateLaunchInterestDto } from "./dto/create-launch-interest.dto";
import { LaunchInterestAdminQueryDto } from "./dto/launch-interest-admin-query.dto";
import { LaunchInterestsService } from "./launch-interests.service";

describe("LaunchInterestsService", () => {
    let service: LaunchInterestsService;

    let prismaMock: {
        $transaction: jest.Mock;
        launchInterest: {
            upsert: jest.Mock;
            count: jest.Mock;
            findMany: jest.Mock;
        };
    };

    const baseInput: CreateLaunchInterestDto = {
        name: " Maria da Silva ",
        email: " MARIA@Exemplo.Com ",
        phone: "+55 11 99999-9999",
        audienceType: LaunchInterestType.CUSTOMER,
        city: " São Paulo ",
        state: " sp ",
        serviceInterest:
            " Preciso de serviços residenciais ",
        professionalCategoryInterest: " ",
        source: LaunchInterestSource.HOME,
        privacyNoticeAccepted: true,
        marketingConsent: true,
    };

    beforeEach(() => {
        prismaMock = {
            $transaction: jest.fn(),
            launchInterest: {
                upsert: jest.fn(),
                count: jest.fn(),
                findMany: jest.fn(),
            },
        };

        prismaMock.launchInterest.upsert.mockResolvedValue(
            {},
        );
        prismaMock.launchInterest.count.mockResolvedValue(0);
        prismaMock.launchInterest.findMany.mockResolvedValue([]);
        prismaMock.$transaction.mockResolvedValue([
            0,
            [],
        ]);

        service = new LaunchInterestsService(
            prismaMock as unknown as PrismaService,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("cria novo interesse com dados normalizados", async () => {
        const response =
            await service.register(baseInput);

        expect(
            prismaMock.launchInterest.upsert,
        ).toHaveBeenCalledWith({
            where: {
                emailNormalized:
                    "maria@exemplo.com",
            },
            create: expect.objectContaining({
                name: "Maria da Silva",
                email: "MARIA@Exemplo.Com",
                emailNormalized:
                    "maria@exemplo.com",
                phone: "+55 11 99999-9999",
                phoneNormalized:
                    "5511999999999",
                audienceType:
                    LaunchInterestType.CUSTOMER,
                city: "São Paulo",
                state: "SP",
                serviceInterest:
                    "Preciso de serviços residenciais",
                professionalCategoryInterest:
                    null,
                source: LaunchInterestSource.HOME,
                privacyNoticeAcceptedAt:
                    expect.any(Date),
                marketingConsentAt:
                    expect.any(Date),
                emailConfirmedAt: null,
                unsubscribedAt: null,
            }),
            update: expect.objectContaining({
                name: "Maria da Silva",
                email: "MARIA@Exemplo.Com",
                phone: "+55 11 99999-9999",
                phoneNormalized:
                    "5511999999999",
                audienceType:
                    LaunchInterestType.CUSTOMER,
                city: "São Paulo",
                state: "SP",
                serviceInterest:
                    "Preciso de serviços residenciais",
                professionalCategoryInterest:
                    null,
                source: LaunchInterestSource.HOME,
                privacyNoticeAcceptedAt:
                    expect.any(Date),
                marketingConsentAt:
                    expect.any(Date),
                unsubscribedAt: null,
            }),
        });

        expect(response).toEqual({
            data: {
                registered: true,
                message:
                    "Seu interesse no lançamento da Soravi foi registrado.",
            },
        });
    });

    it("cria interesse sem telefone e sem consentimento de marketing", async () => {
        const input: CreateLaunchInterestDto = {
            ...baseInput,
            phone: undefined,
            marketingConsent: false,
        };

        const response =
            await service.register(input);

        const call =
            prismaMock.launchInterest.upsert
                .mock.calls[0][0];

        expect(call.create.phone).toBeNull();
        expect(
            call.create.phoneNormalized,
        ).toBeNull();

        expect(
            call.create.marketingConsentAt,
        ).toBeUndefined();

        expect(
            call.create.privacyNoticeAcceptedAt,
        ).toBeInstanceOf(Date);

        expect(
            call.create.emailConfirmedAt,
        ).toBeNull();

        expect(
            call.create.unsubscribedAt,
        ).toBeNull();

        expect(call.update.phone).toBeNull();
        expect(
            call.update.phoneNormalized,
        ).toBeNull();

        expect(call.update).not.toHaveProperty(
            "marketingConsentAt",
        );

        expect(call.update).not.toHaveProperty(
            "unsubscribedAt",
        );

        expect(response.data.registered).toBe(
            true,
        );
    });

    it("atualiza registro existente pelo e-mail normalizado", async () => {
        const response =
            await service.register({
                ...baseInput,
                email: " maria@exemplo.com ",
                name: "Maria Atualizada",
                marketingConsent: false,
            });

        expect(
            prismaMock.launchInterest.upsert,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    emailNormalized:
                        "maria@exemplo.com",
                },
                update:
                    expect.objectContaining({
                        name: "Maria Atualizada",
                        email:
                            "maria@exemplo.com",
                    }),
            }),
        );

        expect(response.data.registered).toBe(
            true,
        );
    });

    it("preserva marketingConsentAt e unsubscribedAt quando marketingConsent for false", async () => {
        await service.register({
            ...baseInput,
            marketingConsent: false,
        });

        const call =
            prismaMock.launchInterest.upsert
                .mock.calls[0][0];

        expect(call.update).not.toHaveProperty(
            "marketingConsentAt",
        );

        expect(call.update).not.toHaveProperty(
            "unsubscribedAt",
        );
    });

    it("reativa comunicações quando marketingConsent for true", async () => {
        await service.register({
            ...baseInput,
            marketingConsent: true,
        });

        const call =
            prismaMock.launchInterest.upsert
                .mock.calls[0][0];

        expect(call.update).toHaveProperty(
            "marketingConsentAt",
        );

        expect(
            call.update.marketingConsentAt,
        ).toBeInstanceOf(Date);

        expect(call.update).toHaveProperty(
            "unsubscribedAt",
            null,
        );
    });

    it("transforma strings opcionais vazias em null", async () => {
        await service.register({
            ...baseInput,
            state: "  ",
            serviceInterest: "",
            professionalCategoryInterest: "",
        });

        const call =
            prismaMock.launchInterest.upsert
                .mock.calls[0][0];

        expect(call.create.state).toBeNull();

        expect(
            call.create.serviceInterest,
        ).toBeNull();

        expect(
            call.create
                .professionalCategoryInterest,
        ).toBeNull();

        expect(call.update.state).toBeNull();

        expect(
            call.update.serviceInterest,
        ).toBeNull();

        expect(
            call.update
                .professionalCategoryInterest,
        ).toBeNull();
    });

    it("normaliza UF para uppercase", async () => {
        await service.register({
            ...baseInput,
            state: "rj",
        });

        const call =
            prismaMock.launchInterest.upsert
                .mock.calls[0][0];

        expect(call.create.state).toBe("RJ");
        expect(call.update.state).toBe("RJ");
    });

    it("não altera emailConfirmedAt durante atualização", async () => {
        await service.register(baseInput);

        const call =
            prismaMock.launchInterest.upsert
                .mock.calls[0][0];

        expect(call.update).not.toHaveProperty(
            "emailConfirmedAt",
        );
    });

    it("rejeita pageSize maior que 100", async () => {
        const instance = plainToInstance(
            LaunchInterestAdminQueryDto,
            {
                page: 1,
                pageSize: 101,
            },
        );

        const errors = await validate(instance);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toEqual(
            expect.objectContaining({
                max: "O parâmetro pageSize deve ser no máximo 100.",
            }),
        );
    });

    it("lista registros administrativos com paginação padrão e ordenação descendente", async () => {
        const total = 60;
        const items = [
            {
                id: "11111111-1111-1111-1111-111111111111",
                name: "Interesse A",
                email: "a@exemplo.com",
                phone: null,
                audienceType: LaunchInterestType.CUSTOMER,
                city: "São Paulo",
                state: "SP",
                serviceInterest: "Serviço",
                professionalCategoryInterest: null,
                source: LaunchInterestSource.HOME,
                privacyNoticeAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
                marketingConsentAt: null,
                emailConfirmedAt: null,
                unsubscribedAt: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
        ];

        prismaMock.$transaction.mockResolvedValue([
            total,
            items,
        ]);

        const response = await service.findAllAdmin(
            new LaunchInterestAdminQueryDto(),
        );

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.launchInterest.count).toHaveBeenCalledTimes(1);
        expect(prismaMock.launchInterest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: {
                    createdAt: "desc",
                },
                skip: 0,
                take: 20,
                select: expect.objectContaining({
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    audienceType: true,
                    city: true,
                    state: true,
                    serviceInterest: true,
                    professionalCategoryInterest: true,
                    source: true,
                    privacyNoticeAcceptedAt: true,
                    marketingConsentAt: true,
                    emailConfirmedAt: true,
                    unsubscribedAt: true,
                    createdAt: true,
                    updatedAt: true,
                }),
            }),
        );

        expect(response.pagination).toEqual({
            page: 1,
            pageSize: 20,
            total: 60,
            totalPages: 3,
        });
        expect(response.items).toHaveLength(1);
    });

    it("lista registros administrativos com paginação customizada", async () => {
        const total = 2;
        const items = [
            {
                id: "11111111-1111-1111-1111-111111111111",
                name: "Interesse A",
                email: "a@exemplo.com",
                phone: null,
                audienceType: LaunchInterestType.CUSTOMER,
                city: "São Paulo",
                state: "SP",
                serviceInterest: "Serviço",
                professionalCategoryInterest: null,
                source: LaunchInterestSource.HOME,
                privacyNoticeAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
                marketingConsentAt: null,
                emailConfirmedAt: null,
                unsubscribedAt: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
        ];

        prismaMock.$transaction.mockResolvedValue([
            total,
            items,
        ]);

        const response = await service.findAllAdmin({
            page: 2,
            pageSize: 5,
        } as LaunchInterestAdminQueryDto);

        expect(prismaMock.launchInterest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 5,
                take: 5,
            }),
        );

        expect(response.pagination).toEqual({
            page: 2,
            pageSize: 5,
            total: 2,
            totalPages: 1,
        });
    });

    it("não retorna dados ocultos do modelo em listagem administrativa", async () => {
        const items = [
            {
                id: "11111111-1111-1111-1111-111111111111",
                name: "Interesse A",
                email: "a@exemplo.com",
                phone: null,
                audienceType: LaunchInterestType.CUSTOMER,
                city: "São Paulo",
                state: "SP",
                serviceInterest: "Serviço",
                professionalCategoryInterest: null,
                source: LaunchInterestSource.HOME,
                privacyNoticeAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
                marketingConsentAt: null,
                emailConfirmedAt: null,
                unsubscribedAt: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
        ];

        prismaMock.$transaction.mockResolvedValue([
            1,
            items,
        ]);

        const response = await service.findAllAdmin(
            new LaunchInterestAdminQueryDto(),
        );

        expect(response.items[0]).not.toHaveProperty("emailNormalized");
        expect(response.items[0]).not.toHaveProperty("phoneNormalized");
        expect(response.items[0]).toEqual(expect.objectContaining({
            id: "11111111-1111-1111-1111-111111111111",
            name: "Interesse A",
            email: "a@exemplo.com",
            phone: null,
        }));
    });

    it("não retorna dados pessoais", async () => {
        const response =
            await service.register(baseInput);

        expect(response).toEqual({
            data: {
                registered: true,
                message:
                    "Seu interesse no lançamento da Soravi foi registrado.",
            },
        });

        expect(response).not.toHaveProperty(
            "id",
        );

        expect(response).not.toHaveProperty(
            "email",
        );

        expect(response).not.toHaveProperty(
            "phone",
        );

        expect(response.data).not.toHaveProperty(
            "email",
        );

        expect(response.data).not.toHaveProperty(
            "phone",
        );
    });
});