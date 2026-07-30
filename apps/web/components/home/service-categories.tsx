import Link from "next/link";
import {
  Brush,
  Hammer,
  Leaf,
  Paintbrush,
  PlugZap,
  SprayCan,
  Wrench,
  type LucideIcon,
} from "lucide-react";

interface ServiceCategory {
  name: string;
  slug: string;
  description: string;
  icon: LucideIcon;
}

const categories: ServiceCategory[] = [
  {
    name: "Eletricista",
    slug: "eletricista",
    description: "Instalações, reparos e manutenção elétrica.",
    icon: PlugZap,
  },
  {
    name: "Encanador",
    slug: "encanador",
    description: "Vazamentos, instalações e manutenção hidráulica.",
    icon: Wrench,
  },
  {
    name: "Pintor",
    slug: "pintor",
    description: "Pintura residencial, comercial e acabamentos.",
    icon: Paintbrush,
  },
  {
    name: "Diarista",
    slug: "diarista",
    description: "Limpeza e organização para casas e empresas.",
    icon: SprayCan,
  },
  {
    name: "Jardineiro",
    slug: "jardineiro",
    description: "Cuidados, manutenção e revitalização de jardins.",
    icon: Leaf,
  },
  {
    name: "Montador",
    slug: "montador",
    description: "Montagem e desmontagem de móveis.",
    icon: Hammer,
  },
  {
    name: "Reformas",
    slug: "reformas",
    description: "Pequenas reformas e melhorias no imóvel.",
    icon: Brush,
  },
];

export function ServiceCategories() {
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

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(({ name, slug, description, icon: Icon }) => (
            <Link
              key={slug}
              href={`/profissionais?categoria=${slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Icon aria-hidden="true" className="size-5" />
              </div>

              <h3 className="mt-5 font-semibold text-slate-950">{name}</h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}