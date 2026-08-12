"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../auth/auth-provider";

const navigationItems = [
  {
    label: "Como funciona",
    href: "/#como-funciona",
  },
] as const;

type HeaderAuthActionProps = {
  mobile?: boolean;
  onAction?: () => void;
};

export function HeaderAuthAction({
  mobile = false,
  onAction,
}: HeaderAuthActionProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, signOut, user } = useAuth();
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));

  async function handleSignOut(): Promise<void> {
    await signOut();
    router.replace("/");
  }

  if (isLoading) {
    return mobile ? (
      <span
        aria-hidden="true"
        className="rounded-xl px-4 py-3 font-medium text-slate-700 invisible"
      >
        Sair
      </span>
    ) : (
      <span
        aria-hidden="true"
        className="font-medium text-slate-700 invisible"
      >
        Sair
      </span>
    );
  }

  if (isAuthenticated) {
    return mobile ? (
      <div className="flex flex-col gap-2">
        {isAdmin ? (
          <Link
            href="/admin"
            className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={onAction}
          >
            Painel admin
          </Link>
        ) : null}

        <button
          type="button"
          className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
          onClick={() => {
            onAction?.();
            void handleSignOut();
          }}
        >
          Sair
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-5">
        {isAdmin ? (
          <Link
            href="/admin"
            className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Painel admin
          </Link>
        ) : null}

        <button
          type="button"
          className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer"
          onClick={() => void handleSignOut()}
        >
          Sair
        </button>
      </div>
    );
  }

  return mobile ? (
    <Link
      href="/entrar"
      className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      Entrar
    </Link>
  ) : (
    <Link
      href="/entrar"
      className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      Entrar
    </Link>
  );
}

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
  href="/"
  className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
  aria-label="Soravi — Página inicial"
  onClick={closeMenu}
>
  <Image
    src="/brand/soravi-logo-horizontal.png"
    alt=""
    width={877}
    height={231}
    priority
    className="h-auto w-32 sm:w-36"
  />
</Link>

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-8 md:flex"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {item.label}
            </Link>
          ))}

          <HeaderAuthAction />

          <Link
            href="/cadastro/profissional"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Quero trabalhar
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:hidden"
          aria-label={
            isMenuOpen ? "Fechar menu principal" : "Abrir menu principal"
          }
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
        >
          {isMenuOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      {isMenuOpen ? (
        <nav
          id="mobile-navigation"
          aria-label="Navegação para dispositivos móveis"
          className="border-t border-slate-200 bg-white px-4 py-4 md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}

            <HeaderAuthAction mobile onAction={closeMenu} />

            <Link
              href="/cadastro/profissional"
              className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              onClick={closeMenu}
            >
              Quero trabalhar
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}