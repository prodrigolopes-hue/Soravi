"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { HeaderAuthAction, SiteHeader } from "./site-header";

export function PageHeader() {
  const pathname = usePathname();

  if (pathname === "/") {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            aria-label="Soravi — Página inicial"
          >
            <Image
              src="/brand/soravi-logo-horizontal.png"
              alt="Soravi"
              width={877}
              height={231}
              className="h-auto w-32 sm:w-36"
            />
          </Link>

          <HeaderAuthAction />
        </div>
      </header>
    );
  }

  return <SiteHeader />;
}
