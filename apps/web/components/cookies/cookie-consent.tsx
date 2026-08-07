"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

import type {
  CookieConsentPreference,
  CookieConsentStorageValue,
} from "./cookie-consent.types";

const STORAGE_KEY = "soravi.cookie-consent";
const STORAGE_VERSION = 1;

interface CookieConsentContextValue {
  preference: CookieConsentStorageValue | null;
  isBannerOpen: boolean;
  openBanner: () => void;
  savePreference: (analytics: "accepted" | "rejected") => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function isValidIsoDate(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isValidPreference(value: unknown): value is CookieConsentStorageValue {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<CookieConsentStorageValue>;

  return (
    (candidate.status === "pending" ||
      candidate.status === "accepted" ||
      candidate.status === "rejected") &&
    candidate.version === STORAGE_VERSION &&
    (candidate.analytics === "accepted" || candidate.analytics === "rejected") &&
    typeof candidate.updatedAt === "string" &&
    isValidIsoDate(candidate.updatedAt)
  );
}

function readStoredPreference(): CookieConsentStorageValue | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (!isValidPreference(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredPreference(value: CookieConsentPreference): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: CookieConsentStorageValue = {
    status: value.analytics === "accepted" ? "accepted" : "rejected",
    ...value,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearStoredPreference(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function readCookieConsentPreference(): CookieConsentStorageValue | null {
  return readStoredPreference();
}

export function validateCookieConsentPreference(
  value: unknown,
): CookieConsentStorageValue | null {
  return isValidPreference(value) ? value : null;
}

export function saveCookieConsentPreference(
  analytics: "accepted" | "rejected",
): CookieConsentStorageValue {
  const preference: CookieConsentPreference = {
    version: STORAGE_VERSION,
    analytics,
    updatedAt: new Date().toISOString(),
  };

  writeStoredPreference(preference);

  return {
    status: analytics === "accepted" ? "accepted" : "rejected",
    ...preference,
  };
}

export function clearCookieConsentPreference(): void {
  clearStoredPreference();
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<CookieConsentStorageValue | null>(null);
  const [isBannerOpen, setIsBannerOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedPreference = readStoredPreference();
    setPreference(storedPreference);
    setIsBannerOpen(!storedPreference);
    setIsHydrated(true);
  }, []);

  const savePreference = (analytics: "accepted" | "rejected") => {
    const nextPreference = saveCookieConsentPreference(analytics);
    setPreference(nextPreference);
    setIsBannerOpen(false);
  };

  const openBanner = () => {
    setIsBannerOpen(true);
  };

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      preference,
      isBannerOpen,
      openBanner,
      savePreference,
    }),
    [isBannerOpen, preference],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {isHydrated && (isBannerOpen || preference === null) ? <CookieConsentBanner /> : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);

  if (!context) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }

  return context;
}

export function CookieConsentBanner() {
  const { preference, isBannerOpen, savePreference } = useCookieConsent();

  if (!isBannerOpen && preference) {
    return null;
  }

  const heading = preference ? "Preferências de cookies" : "Privacidade e cookies";
  const helperText = preference
    ? "Você pode alterar sua escolha a qualquer momento. Recursos essenciais continuam ativos para o funcionamento do site."
    : "A Soravi usa recursos essenciais para o funcionamento do site. Com sua autorização, também podemos usar dados de navegação para entender como a plataforma é utilizada e melhorar sua experiência.";

  return (
    <div
      role="region"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-4 shadow-[0_-12px_40px_rgba(15,23,42,0.10)] backdrop-blur supports-[padding:env(safe-area-inset-bottom)]:pb-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <Cookie aria-hidden="true" className="size-5" />
          </div>

          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold text-slate-950">{heading}</h2>
            <p className="text-sm leading-6 text-slate-600">{helperText}</p>
            <p className="text-sm text-slate-600">
              <Link
                href="/politica-de-privacidade"
                className="font-medium text-sky-700 underline-offset-4 hover:underline"
              >
                Saiba mais na Política de Privacidade.
              </Link>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:min-w-[19rem] sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => savePreference("rejected")}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => savePreference("accepted")}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            Aceitar analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieConsentFooterLink({ className }: { className?: string }) {
  const { openBanner } = useCookieConsent();

  return (
    <button type="button" onClick={openBanner} className={className}>
      Preferências de cookies
    </button>
  );
}
