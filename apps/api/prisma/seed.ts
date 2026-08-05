import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({
  path: resolve(process.cwd(), "../../.env"),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in the environment.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
  }),
});

const categories = [
  {
    name: "Eletricista",
    slug: "eletricista",
    description: "Serviços elétricos residenciais e comerciais.",
    icon: "zap",
    isActive: true,
    displayOrder: 1,
  },
  {
    name: "Encanador",
    slug: "encanador",
    description: "Instalação e conserto hidráulico.",
    icon: "wrench",
    isActive: true,
    displayOrder: 2,
  },
  {
    name: "Pintor",
    slug: "pintor",
    description: "Pintura de paredes, tetos e acabamentos.",
    icon: "paint-roller",
    isActive: true,
    displayOrder: 3,
  },
  {
    name: "Diarista",
    slug: "diarista",
    description: "Limpeza residencial rápida e confiável.",
    icon: "spray-can",
    isActive: true,
    displayOrder: 4,
  },
  {
    name: "Jardineiro",
    slug: "jardineiro",
    description: "Cuidado de jardins, vasos e paisagismo.",
    icon: "leaf",
    isActive: true,
    displayOrder: 5,
  },
  {
    name: "Montador de móveis",
    slug: "montador-de-moveis",
    description: "Montagem e ajuste de móveis em casa.",
    icon: "hammer",
    isActive: true,
    displayOrder: 6,
  },
  {
    name: "Climatização e ar-condicionado",
    slug: "climatizacao-e-ar-condicionado",
    description: "Instalação e manutenção de ar-condicionado.",
    icon: "snowflake",
    isActive: true,
    displayOrder: 7,
  },
  {
    name: "Reparos e manutenção residencial",
    slug: "reparos-e-manutencao-residencial",
    description: "Consertos gerais e manutenção doméstica.",
    icon: "house-wrench",
    isActive: true,
    displayOrder: 8,
  },
];

async function main() {
  await prisma.$connect();

  const results = [] as Array<{ slug: string; created: boolean }>;

  for (const category of categories) {
    const createdCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        isActive: category.isActive,
        displayOrder: category.displayOrder,
      },
    });

    const created = createdCategory.createdAt.getTime() === createdCategory.updatedAt.getTime();
    results.push({ slug: category.slug, created });
  }

  const createdCount = results.filter((item) => item.created).length;
  const updatedCount = results.length - createdCount;

  console.log(
    `Seed completed: ${results.length} categorias processadas, ${createdCount} criadas, ${updatedCount} atualizadas.`
  );
}

main()
  .catch((error: unknown) => {
    if (error instanceof Error) {
      const prismaError = error as { code?: string; meta?: unknown };
      console.error("Seed failed:", {
        name: error.name,
        message: error.message,
        code: prismaError.code,
        meta: prismaError.meta,
      });
    } else {
      console.error("Seed failed: Unknown error");
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
