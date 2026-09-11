import { plainToInstance, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsUrl,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from "class-validator";

const environmentNames = [
  "development",
  "test",
  "production",
] as const;

type EnvironmentName = (typeof environmentNames)[number];

const phoneVerificationDeliveryProviders = [
  "unavailable",
  "meta",
] as const;

type PhoneVerificationDeliveryProvider =
  (typeof phoneVerificationDeliveryProviders)[number];

const passwordResetDeliveryProviders = ["unavailable", "resend"] as const;

type PasswordResetDeliveryProvider =
  (typeof passwordResetDeliveryProviders)[number];

class EnvironmentVariables {
  @IsIn(environmentNames)
  @IsOptional()
  NODE_ENV: EnvironmentName = "development";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  API_PORT = 3001;

  @IsString()
  @IsOptional()
  CORS_ORIGIN = "http://localhost:3000";

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN_SECONDS = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN_DAYS = 30;

  @IsString()
  @MinLength(32)
  PHONE_VERIFICATION_HMAC_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  @IsOptional()
  PHONE_VERIFICATION_TTL_SECONDS = 600;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  PHONE_VERIFICATION_MAX_ATTEMPTS = 5;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(3600)
  @IsOptional()
  PHONE_VERIFICATION_COOLDOWN_SECONDS = 60;

  @IsIn(phoneVerificationDeliveryProviders)
  @IsOptional()
  PHONE_VERIFICATION_DELIVERY_PROVIDER: PhoneVerificationDeliveryProvider =
    "unavailable";

  @ValidateIf((_environment, value) => value !== "")
  @IsString()
  @MinLength(1)
  @IsOptional()
  META_WHATSAPP_ACCESS_TOKEN!: string;

  @ValidateIf((_environment, value) => value !== "")
  @IsString()
  @MinLength(1)
  @IsOptional()
  META_WHATSAPP_PHONE_NUMBER_ID!: string;

  @ValidateIf((_environment, value) => value !== "")
  @IsString()
  @Matches(/^v\d+\.\d+$/u)
  @IsOptional()
  META_WHATSAPP_GRAPH_API_VERSION!: string;

  @ValidateIf((_environment, value) => value !== "")
  @IsString()
  @MinLength(1)
  @IsOptional()
  META_WHATSAPP_OTP_TEMPLATE_NAME!: string;

  @ValidateIf((_environment, value) => value !== "")
  @IsString()
  @MinLength(1)
  @IsOptional()
  META_WHATSAPP_OTP_TEMPLATE_LANGUAGE!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(15000)
  @IsOptional()
  META_WHATSAPP_HTTP_TIMEOUT_MS = 5000;

  @IsIn(passwordResetDeliveryProviders)
  @IsOptional()
  PASSWORD_RESET_DELIVERY_PROVIDER: PasswordResetDeliveryProvider =
    "unavailable";

  @ValidateIf((_environment, value) => value !== "")
  @IsString()
  @MinLength(1)
  @IsOptional()
  RESEND_API_KEY!: string;

  @ValidateIf((_environment, value) => value !== "")
  @IsString()
  @MinLength(1)
  @IsOptional()
  PASSWORD_RESET_EMAIL_FROM!: string;

  @ValidateIf((_environment, value) => value !== "")
  @IsUrl({ require_protocol: true, require_tld: false })
  @IsOptional()
  FRONTEND_PUBLIC_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(86400000)
  @IsOptional()
  OPPORTUNITY_DISTRIBUTION_INTERVAL_MS = 60000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  OPPORTUNITY_DISTRIBUTION_BATCH_SIZE = 50;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(86400000)
  @IsOptional()
  OUTBOUND_NOTIFICATION_INTERVAL_MS = 60000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  OUTBOUND_NOTIFICATION_BATCH_SIZE = 25;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @IsUrl({
    protocols: ["redis", "rediss"],
    require_protocol: true,
    require_tld: false,
  })
  @Matches(/^rediss?:\/\//u)
  REDIS_URL!: string;

  @IsString()
  @MinLength(1)
  STORAGE_S3_ENDPOINT!: string;

  @IsString()
  @MinLength(1)
  STORAGE_S3_ACCESS_KEY_ID!: string;

  @IsString()
  @MinLength(1)
  STORAGE_S3_SECRET_ACCESS_KEY!: string;

  @IsString()
  @MinLength(1)
  STORAGE_S3_BUCKET!: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  STORAGE_S3_REGION = "auto";
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): EnvironmentVariables {
  const validatedEnvironment = plainToInstance(
    EnvironmentVariables,
    environment,
    {
      enableImplicitConversion: true,
    },
  );

  const errors = validateSync(validatedEnvironment, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Variáveis de ambiente inválidas: ${errors
        .map((error) => {
          const constraints = Object.values(error.constraints ?? {});

          return constraints.length > 0
            ? `${error.property}: ${constraints.join(", ")}`
            : error.property;
        })
        .join("; ")}`,
    );
  }

  if (
    validatedEnvironment.PHONE_VERIFICATION_DELIVERY_PROVIDER === "meta"
  ) {
    const requiredMetaVariables = [
      "META_WHATSAPP_ACCESS_TOKEN",
      "META_WHATSAPP_PHONE_NUMBER_ID",
      "META_WHATSAPP_GRAPH_API_VERSION",
      "META_WHATSAPP_OTP_TEMPLATE_NAME",
      "META_WHATSAPP_OTP_TEMPLATE_LANGUAGE",
    ] as const;
    const missingMetaVariables = requiredMetaVariables.filter((key) => {
      const value = validatedEnvironment[key];

      return typeof value !== "string" || value.length === 0;
    });

    if (missingMetaVariables.length > 0) {
      throw new Error(
        `Variáveis de ambiente inválidas: configuração Meta incompleta (${missingMetaVariables.join(
          ", ",
        )}).`,
      );
    }
  }

  if (
    validatedEnvironment.PHONE_VERIFICATION_HMAC_SECRET ===
    validatedEnvironment.JWT_ACCESS_SECRET
  ) {
    throw new Error(
      "Variáveis de ambiente inválidas: PHONE_VERIFICATION_HMAC_SECRET deve ser diferente de JWT_ACCESS_SECRET.",
    );
  }

  if (validatedEnvironment.PASSWORD_RESET_DELIVERY_PROVIDER === "resend") {
    const requiredResendVariables = [
      "RESEND_API_KEY",
      "PASSWORD_RESET_EMAIL_FROM",
      "FRONTEND_PUBLIC_URL",
    ] as const;
    const missingResendVariables = requiredResendVariables.filter((key) => {
      const value = validatedEnvironment[key];

      return typeof value !== "string" || value.length === 0;
    });

    if (missingResendVariables.length > 0) {
      throw new Error(
        `Variáveis de ambiente inválidas: configuração Resend incompleta (${missingResendVariables.join(
          ", ",
        )}).`,
      );
    }
  }

  return validatedEnvironment;
}
