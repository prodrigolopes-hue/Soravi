"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/auth-provider";
import { NotificationBell } from "../notifications/notification-bell";

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

type DesktopAccountMenu = "customer" | "professional";

function accountGreeting(name: string | undefined): string {
  const firstName = name?.trim().split(/\s+/u)[0];

  return firstName ? "Olá, " + firstName : "Minha conta";
}

export function HeaderAuthAction({
  mobile = false,
  onAction,
}: HeaderAuthActionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, signOut, user } = useAuth();
  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));
  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const greeting = accountGreeting(user?.name);
  const hasCustomerAndProfessional = isCustomer && isProfessional;
  const [openDesktopMenu, setOpenDesktopMenu] = useState<DesktopAccountMenu | null>(null);
  const desktopMenuContainerRef = useRef<HTMLDivElement>(null);

  async function handleSignOut(): Promise<void> {
    await signOut();
    router.replace("/");
  }

  function closeDesktopMenu() {
    setOpenDesktopMenu(null);
  }

  function handleDesktopMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDesktopMenu();
      event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }

  function handleDesktopMenuBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      closeDesktopMenu();
    }
  }

  useEffect(() => {
    setOpenDesktopMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!openDesktopMenu) return;

    function handlePointerDown(event: PointerEvent) {
      if (!desktopMenuContainerRef.current?.contains(event.target as Node)) {
        setOpenDesktopMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openDesktopMenu]);

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
        <p className="truncate px-4 py-2 text-sm font-semibold text-slate-900">
          {greeting}
        </p>

        {isCustomer ? (
          <>
            <h2 className="px-4 pt-2 text-sm font-semibold text-slate-900">Contratar</h2>
            <Link href="/cliente" className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={onAction}>
            Painel do cliente
            </Link>
          </>
        ) : null}

        {isCustomer ? (
          <Link
            href="/solicitacoes"
            className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={onAction}
          >
            Minhas solicitações
          </Link>
        ) : null}

        {isCustomer ? (
          <Link href="/favoritos" className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={onAction}>
            Favoritos
          </Link>
        ) : null}

        {isProfessional ? (
          <>
            <h2 className="px-4 pt-2 text-sm font-semibold text-slate-900">Trabalhar</h2>
            <Link href="/profissional" className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={onAction}>
            Painel profissional
            </Link>
          </>
        ) : null}

        {isProfessional ? (
          <Link
            href="/profissional/oportunidades"
            className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={onAction}
          >
            Oportunidades
          </Link>
        ) : null}

        {isCustomer || isProfessional ? (
          <Link
            href="/conversas"
            className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={onAction}
          >
            Conversas
          </Link>
        ) : null}

        {isCustomer || isProfessional ? (
          <NotificationBell mobile onAction={onAction} />
        ) : null}

        {isAdmin ? (
          <Link
            href="/admin"
            className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={onAction}
          >
            Painel admin
          </Link>
        ) : null}

        <Link
          href="/conta"
          className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          onClick={onAction}
        >
          Minha conta
        </Link>

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
        <div
          ref={desktopMenuContainerRef}
          className="flex items-center gap-5"
          onBlurCapture={handleDesktopMenuBlur}
        >
        {hasCustomerAndProfessional ? (
          <div className="relative" onKeyDown={handleDesktopMenuKeyDown}>
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={openDesktopMenu === "customer"}
              aria-controls="desktop-customer-navigation"
              className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              onClick={() => setOpenDesktopMenu((menu) => menu === "customer" ? null : "customer")}
            >
              Contratar
              <ChevronDown aria-hidden="true" className="size-4" />
            </button>
            {openDesktopMenu === "customer" ? (
              <div id="desktop-customer-navigation" className="absolute left-0 top-full z-10 mt-2 flex min-w-56 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <Link href="/cliente" className="rounded-lg px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={closeDesktopMenu}>Painel do cliente</Link>
                <Link href="/solicitacoes" className="rounded-lg px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={closeDesktopMenu}>Minhas solicitações</Link>
                <Link href="/favoritos" className="rounded-lg px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={closeDesktopMenu}>Favoritos</Link>
              </div>
            ) : null}
          </div>
        ) : isCustomer ? (
          <Link href="/cliente" className="whitespace-nowrap font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            Painel do cliente
          </Link>
        ) : null}

        {isCustomer && !hasCustomerAndProfessional ? (
          <Link
            href="/solicitacoes"
            className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Minhas solicitações
          </Link>
        ) : null}

        {isCustomer && !hasCustomerAndProfessional ? (
          <Link href="/favoritos" className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            Favoritos
          </Link>
        ) : null}

        {hasCustomerAndProfessional ? (
          <div className="relative" onKeyDown={handleDesktopMenuKeyDown}>
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={openDesktopMenu === "professional"}
              aria-controls="desktop-professional-navigation"
              className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              onClick={() => setOpenDesktopMenu((menu) => menu === "professional" ? null : "professional")}
            >
              Trabalhar
              <ChevronDown aria-hidden="true" className="size-4" />
            </button>
            {openDesktopMenu === "professional" ? (
              <div id="desktop-professional-navigation" className="absolute left-0 top-full z-10 mt-2 flex min-w-52 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <Link href="/profissional" className="rounded-lg px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={closeDesktopMenu}>Painel profissional</Link>
                <Link href="/profissional/oportunidades" className="rounded-lg px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={closeDesktopMenu}>Oportunidades</Link>
              </div>
            ) : null}
          </div>
        ) : isProfessional ? (
          <Link href="/profissional" className="whitespace-nowrap font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            Painel profissional
          </Link>
        ) : null}

        {isProfessional && !hasCustomerAndProfessional ? (
          <Link
            href="/profissional/oportunidades"
            className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Oportunidades
          </Link>
        ) : null}
        </div>

        {isCustomer || isProfessional ? (
          <Link
            href="/conversas"
            className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Conversas
          </Link>
        ) : null}

        {isCustomer || isProfessional ? <NotificationBell /> : null}

        {isAdmin ? (
          <Link
            href="/admin"
            className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Painel admin
          </Link>
        ) : null}

        <Link
          href="/conta"
          aria-label={`${greeting}, abrir Minha conta`}
          title="Minha conta"
          className="block max-w-44 truncate font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {greeting}
        </Link>

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
      onClick={onAction}
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

type SiteHeaderProps = {
  showMarketingNavigation?: boolean;
};

export function SiteHeader({
  showMarketingNavigation = true,
}: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const showProfessionalRegistrationCta =
    showMarketingNavigation && !isLoading && !isAuthenticated;

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
  href="/"
  className="inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
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
          className="hidden items-center gap-5 whitespace-nowrap xl:flex"
        >
          {showMarketingNavigation
            ? navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  {item.label}
                </Link>
              ))
            : null}

          <HeaderAuthAction />

          {showProfessionalRegistrationCta ? (
            <Link
              href="/cadastro/profissional"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Quero trabalhar
            </Link>
          ) : null}
        </nav>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 xl:hidden"
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
          className="border-t border-slate-200 bg-white px-4 py-4 xl:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {showMarketingNavigation
              ? navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                ))
              : null}

            <HeaderAuthAction mobile onAction={closeMenu} />

            {showProfessionalRegistrationCta ? (
              <Link
                href="/cadastro/profissional"
                className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                onClick={closeMenu}
              >
                Quero trabalhar
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
