import Link from "next/link";
import {
  Hammer,
  Leaf,
  Paintbrush,
  Snowflake,
  PlugZap,
  SprayCan,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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

function isServiceCategory(value: unknown): value is ServiceCategory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ServiceCategory>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.slug === "string" &&
    (typeof candidate.description === "string" || candidate.description === null) &&
    (typeof candidate.icon === "string" || candidate.icon === null) &&
    typeof candidate.displayOrder === "number" &&
    Number.isInteger(candidate.displayOrder)
  );
}

function resolveCategoryIcon(icon: string | null): LucideIcon {
  if (!icon) {
    return Wrench;
  }

  return categoryIconMap[icon] ?? Wrench;
}

async function fetchServiceCategories(): Promise<ServiceCategory[] | null> {
  try {
    const response = await fetch(categoriesUrl, {
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      return null;
    }

    return payload.filter(isServiceCategory);
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
            Explore algumas das categorias que estarão disponíveis na Soravi.
          </p>
        </div>

        {hasCategories ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(({ id, name, slug, description, icon }) => {
              const Icon = resolveCategoryIcon(icon);

              return (
                <Link
                  key={id}
                  href={`/profissionais?categoria=${slug}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>

                  <h3 className="mt-5 font-semibold text-slate-950">{name}</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {description ?? "Profissionais disponíveis nesta categoria."}
                  </p>
                </Link>
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