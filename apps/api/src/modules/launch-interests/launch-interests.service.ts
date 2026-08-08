import { Injectable } from "@nestjs/common";

import {
    LaunchInterestSource,
    Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateLaunchInterestDto } from "./dto/create-launch-interest.dto";
import { LaunchInterestAdminListResponseDto, LaunchInterestAdminRecord } from "./dto/launch-interest-admin-response.dto";
import { LaunchInterestAdminQueryDto } from "./dto/launch-interest-admin-query.dto";
import { LaunchInterestRegistrationResponseDto } from "./dto/launch-interest-response.dto";

@Injectable()
export class LaunchInterestsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async register(
        input: CreateLaunchInterestDto,
    ): Promise<LaunchInterestRegistrationResponseDto> {
        const emailNormalized =
            this.normalizeEmail(input.email);

        const phoneNormalized =
            this.normalizePhone(input.phone);

        const now = new Date();

        const createData = {
            name: input.name.trim(),
            email: input.email.trim(),
            emailNormalized,
            phone: input.phone?.trim() ?? null,
            phoneNormalized,
            audienceType: input.audienceType,
            city: input.city.trim(),
            state: this.normalizeState(input.state),
            serviceInterest:
                this.normalizeOptionalString(
                    input.serviceInterest,
                ),
            professionalCategoryInterest:
                this.normalizeOptionalString(
                    input.professionalCategoryInterest,
                ),
            source:
                input.source ??
                LaunchInterestSource.HOME,
            privacyNoticeAcceptedAt: now,
            marketingConsentAt:
                input.marketingConsent
                    ? now
                    : undefined,
            emailConfirmedAt: null,
            unsubscribedAt: null,
        } satisfies Prisma.LaunchInterestCreateInput;

        const updateData = {
            name: input.name.trim(),
            email: input.email.trim(),
            phone: input.phone?.trim() ?? null,
            phoneNormalized,
            audienceType: input.audienceType,
            city: input.city.trim(),
            state: this.normalizeState(input.state),
            serviceInterest:
                this.normalizeOptionalString(
                    input.serviceInterest,
                ),
            professionalCategoryInterest:
                this.normalizeOptionalString(
                    input.professionalCategoryInterest,
                ),
            source:
                input.source ??
                LaunchInterestSource.HOME,
            privacyNoticeAcceptedAt: now,
            ...(input.marketingConsent
                ? {
                    marketingConsentAt: now,
                    unsubscribedAt: null,
                }
                : {}),
        } satisfies Prisma.LaunchInterestUpdateInput;

        await this.prisma.launchInterest.upsert({
            where: {
                emailNormalized,
            },
            create: createData,
            update: updateData,
        });

        return new LaunchInterestRegistrationResponseDto();
    }

    async findAllAdmin(
        query: LaunchInterestAdminQueryDto,
    ): Promise<LaunchInterestAdminListResponseDto> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const [total, items] = await this.prisma.$transaction([
            this.prisma.launchInterest.count(),
            this.prisma.launchInterest.findMany({
                orderBy: {
                    createdAt: "desc",
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
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
                },
            }),
        ]);

        return new LaunchInterestAdminListResponseDto(
            items as LaunchInterestAdminRecord[],
            page,
            pageSize,
            total,
        );
    }

    private normalizeEmail(
        email: string,
    ): string {
        return email.trim().toLowerCase();
    }

    private normalizePhone(
        phone?: string,
    ): string | null {
        if (!phone) {
            return null;
        }

        const digits = phone.replace(/\D+/g, "");

        return digits.length > 0
            ? digits
            : null;
    }

    private normalizeOptionalString(
        value?: string | null,
    ): string | null {
        if (!value) {
            return null;
        }

        const normalized = value.trim();

        return normalized.length > 0
            ? normalized
            : null;
    }

    private normalizeState(
        value?: string | null,
    ): string | null {
        if (!value) {
            return null;
        }

        const normalized =
            value.trim().toUpperCase();

        return normalized.length > 0
            ? normalized
            : null;
    }
}