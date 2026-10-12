import {
  Hammer,
  Leaf,
  Paintbrush,
  PlugZap,
  Snowflake,
  SprayCan,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";

import { categoriesUrl } from "../../lib/api";

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
}

const categoryIconMap: Record<string, LucideIcon> = {
  zap: PlugZap,
  wrench: Wrench,
  "paint-roller": Paintbrush,
  "spray-can": SprayCan,
  leaf: Leaf,
  hammer: Hammer,
  snowflake: Snowflake,
  "house-wrench": Wrench,
};

const categoryImageBySlug: Readonly<Record<string, string>> = {
  eletricista: "/images/soravi-categoria-eletricista.webp",
  encanador: "/images/soravi-categoria-encanador.webp",
  pintor: "/images/soravi-categoria-pintor.webp",
  diarista: "/images/soravi-categoria-diarista.webp",
  jardineiro: "/images/soravi-categoria-jardineiro.webp",
  "montador-de-moveis": "/images/soravi-categoria-montador-moveis.webp",
  "climatizacao-e-ar-condicionado": "/images/soravi-categoria-climatizacao.webp",
  "reparos-e-manutencao-residencial":
    "/images/soravi-categoria-reparos-residenciais.webp",
};

function isServiceCategory(value: unknown): value is ServiceCategory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ServiceCategory>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.slug === "string" &&
    (typeof candidate.description === "string" ||
      candidate.description === null) &&
    (typeof candidate.icon === "string" || candidate.icon === null) &&
    typeof candidate.displayOrder === "number" &&
    Number.isInteger(candidate.displayOrder)
  );
}

function resolveCategoryIcon(icon: string | null): LucideIcon {
  return icon ? (categoryIconMap[icon] ?? Wrench) : Wrench;
}

async function fetchServiceCategories(): Promise<ServiceCategory[] | null> {
  try {
    const response = await fetch(categoriesUrl, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();

    return Array.isArray(payload) ? payload.filter(isServiceCategory) : null;
  } catch {
    return null;
  }
}

export async function ServiceCategories() {
  const categories = await fetchServiceCategories();
  const hasCategories = Array.isArray(categories) && categories.length > 0;
  const isEmptyList = Array.isArray(categories) && categories.length === 0;

  return (
    <section
      aria-labelledby="service-categories-title"
      className="bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-semibold text-blue-600">Categorias de serviços</p>
          <h2
            id="service-categories-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Encontre ajuda para diferentes necessidades
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Conheça as categorias disponíveis para criar sua solicitação.
          </p>
        </div>

        {hasCategories ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(({ id, name, slug, description, icon }) => {
              const Icon = resolveCategoryIcon(icon);
              const imageSrc = categoryImageBySlug[slug];

              return (
                <article
                  key={id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  {imageSrc ? (
                    <div className="aspect-video bg-slate-100">
                      <Image
                        src={imageSrc}
                        alt={`Profissional de ${name} em atendimento`}
                        width={960}
                        height={540}
                        sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) calc(50vw - 2rem), (max-width: 1279px) calc(25vw - 2rem), 320px"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-blue-50 text-blue-600">
                      <Icon aria-hidden="true" className="size-8" />
                    </div>
                  )}

                  <div className="p-5">
                    <h3 className="font-semibold text-slate-950">{name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {description ?? "Categoria disponível para sua solicitação."}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-10 text-sm leading-6 text-slate-600">
            {isEmptyList
              ? "Nenhuma categoria disponível no momento."
              : "As categorias estarão disponíveis em instantes."}
          </p>
        )}
      </div>
    </section>
  );
}
