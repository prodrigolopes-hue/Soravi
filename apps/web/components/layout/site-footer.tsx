import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const platformLinks = [
  {
    label: "Como funciona",
    href: "/#como-funciona",
  },
  {
    label: "Encontrar profissionais",
    href: "/profissionais",
  },
  {
    label: "Solicitar um serviço",
    href: "/solicitacoes/nova",
  },
] as const;

const accountLinks = [
  {
    label: "Entrar",
    href: "/entrar",
  },
  {
    label: "Criar conta",
    href: "/cadastro",
  },
  {
    label: "Quero trabalhar",
    href: "/cadastro/profissional",
  },
] as const;

const legalLinks = [
  {
    label: "Termos de uso",
    href: "/termos-de-uso",
  },
  {
    label: "Política de privacidade",
    href: "/politica-de-privacidade",
  },
] as const;

const linkClassName =
  "text-sm text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            aria-label="Soravi — Página inicial"
          >
            Soravi
          </Link>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            A Soravi conecta pessoas a profissionais e soluções de serviços de
            forma simples, rápida e segura.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Segurança em cada conexão
          </div>
        </div>

        <nav aria-labelledby="footer-platform-title">
          <h2
            id="footer-platform-title"
            className="text-sm font-semibold text-slate-950"
          >
            Soravi
          </h2>

          <ul className="mt-4 space-y-3">
            {platformLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClassName}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-account-title">
          <h2
            id="footer-account-title"
            className="text-sm font-semibold text-slate-950"
          >
            Minha conta
          </h2>

          <ul className="mt-4 space-y-3">
            {accountLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClassName}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal-title">
          <h2
            id="footer-legal-title"
            className="text-sm font-semibold text-slate-950"
          >
            Informações
          </h2>

          <ul className="mt-4 space-y-3">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClassName}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>© {currentYear} Soravi. Todos os direitos reservados.</p>

          <p>Conectando pessoas a soluções.</p>
        </div>
      </div>
    </footer>
  );
}