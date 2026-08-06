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

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;
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