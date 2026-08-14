import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";

function parsePort(...values: Array<string | number | undefined>): number {
  for (const value of values) {
    if (value === undefined) {
      continue;
    }

    const port = typeof value === "number" ? value : Number(value);

    if (Number.isInteger(port) && port >= 1 && port <= 65535) {
      return port;
    }
  }

  return 3001;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpAdapter = app.getHttpAdapter();

  if (httpAdapter.getType() === "express") {
    const expressApp = httpAdapter.getInstance();
    expressApp.set("trust proxy", 1);
  }

  const apiPort = parsePort(
    configService.get<string | number>("PORT"),
    configService.get<string | number>("API_PORT"),
  );

  const corsOrigin = configService.get<string>(
    "CORS_ORIGIN",
    "http://localhost:3000",
  );

  const allowedOrigins = corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.use(helmet());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(apiPort, "0.0.0.0");

  console.log(`Soravi API iniciada na porta ${apiPort}.`);
}

void bootstrap();