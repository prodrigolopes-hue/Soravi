import { plainToInstance, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from "class-validator";

const environmentNames = [
  "development",
  "test",
  "production",
] as const;

type EnvironmentName = (typeof environmentNames)[number];

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

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  STORAGE_S3_ENDPOINT?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  STORAGE_S3_ACCESS_KEY_ID?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  STORAGE_S3_SECRET_ACCESS_KEY?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  STORAGE_S3_BUCKET?: string;

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
        .map((error) => error.toString())
        .join("; ")}`,
    );
  }

  return validatedEnvironment;
}
