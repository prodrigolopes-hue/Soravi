import {
  ArrowRight,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

interface AccountTypeCardProps {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  benefits: readonly string[];
  icon: LucideIcon;
  variant: "client" | "professional";
}

const variantStyles = {
  client: {
    icon: "bg-blue-50 text-blue-600",
    button: "bg-blue-600 text-white hover:bg-blue-700",
  },
  professional: {
    icon: "bg-green-50 text-green-700",
    button: "bg-slate-950 text-white hover:bg-slate-800",
  },
} as const;

export function AccountTypeCard({
  title,
  description,
  href,
  actionLabel,
  benefits,
  icon: Icon,
  variant,
}: AccountTypeCardProps) {
  const styles = variantStyles[variant];

  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/60 sm:p-8">
      <div
        className={`flex size-14 items-center justify-center rounded-2xl ${styles.icon}`}
      >
        <Icon aria-hidden="true" className="size-7" />
      </div>

      <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-950">
        {title}
      </h2>

      <p className="mt-3 leading-7 text-slate-600">{description}</p>

      <ul className="mt-6 space-y-3">
        {benefits.map((benefit) => (
          <li
            key={benefit}
            className="flex items-start gap-3 text-sm leading-6 text-slate-700"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-green-600"
            />

            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          href={href}
          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${styles.button}`}
        >
          {actionLabel}

          <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </article>
  );
}