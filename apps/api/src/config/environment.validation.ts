import { plainToInstance, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
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
  API_PORT = 3001;

  @IsString()
  @IsOptional()
  CORS_ORIGIN = "http://localhost:3000";
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