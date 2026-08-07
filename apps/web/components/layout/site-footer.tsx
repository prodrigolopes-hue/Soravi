import Image from "next/image";
import { ShieldCheck } from "lucide-react";

import { CookieConsentFooterLink } from "../cookies/cookie-consent";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-sm">
          <Image
            src="/brand/soravi-logo-horizontal.png"
            alt="Soravi"
            width={877}
            height={231}
            className="h-auto w-36"
          />
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Conectando pessoas a soluções.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl bg-slate-50 p-5 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Soravi</p>
          <div className="flex flex-wrap items-center gap-3">
            <CookieConsentFooterLink className="font-medium text-sky-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2" />
            <span className="text-slate-400">•</span>
            <a href="/politica-de-privacidade" className="font-medium text-sky-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2">
              Política de privacidade
            </a>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 font-medium text-green-700">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Segurança em cada conexão
          </div>
        </div>
      </div>
    </footer>
  );
}
