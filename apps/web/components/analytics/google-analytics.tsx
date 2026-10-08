"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useCookieConsent } from "../cookies/cookie-consent";
import {
  canTrackAnalytics,
  createAnalyticsPageLocation,
  googleAnalyticsCookieDomains,
  isAdminPath,
  sanitizeAnalyticsPathname,
  sanitizeAnalyticsReferrer,
  safeAnalyticsPageTitle,
  shouldSendAnalyticsPageView,
} from "./google-analytics-routing";

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

function ensureGtag(): GtagWindow {
  const gtagWindow = window as GtagWindow;

  gtagWindow.dataLayer = gtagWindow.dataLayer ?? [];

  gtagWindow.gtag =
    gtagWindow.gtag ??
    function gtag(...args: unknown[]) {
      gtagWindow.dataLayer?.push(args);
    };

  return gtagWindow;
}

function removeGoogleAnalyticsCookies(): void {
  if (typeof window === "undefined") {
    return;
  }

  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter(
      (cookieName) =>
        cookieName === "_ga" ||
        cookieName === "_gid" ||
        cookieName.startsWith("_ga_"),
    );

  for (const cookieName of cookieNames) {
    document.cookie =
      `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;

    for (const domain of googleAnalyticsCookieDomains(window.location.hostname)) {
      document.cookie =
        `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
    }
  }
}

interface GoogleAnalyticsProps {
  nonce?: string;
}

function setGoogleAnalyticsDisabled(
  gtagWindow: GtagWindow,
  disabled: boolean,
): void {
  Reflect.set(
    gtagWindow,
    `ga-disable-${GA_MEASUREMENT_ID}`,
    disabled,
  );
}

export function GoogleAnalytics({ nonce }: GoogleAnalyticsProps) {
  const { preference } = useCookieConsent();
  const pathname = usePathname();
  const configuredRef = useRef(false);
  const initializedRef = useRef(false);
  const firstPageViewSentRef = useRef(false);
  const lastTrackedPathRef = useRef<string | null>(null);
  const analyticsEnabled = canTrackAnalytics(preference, pathname);
  const isAdministrativeNavigation = isAdminPath(pathname);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) {
      return;
    }

    if (analyticsEnabled) {
      const gtagWindow = ensureGtag();
      const sanitizedPathname = sanitizeAnalyticsPathname(pathname);
      const sanitizedReferrer = sanitizeAnalyticsReferrer(
        document.referrer,
        window.location.origin,
      );
      const pageReferrer = lastTrackedPathRef.current
        ? `${window.location.origin}${sanitizeAnalyticsPathname(lastTrackedPathRef.current)}`
        : sanitizedReferrer;
      const pageLocation = createAnalyticsPageLocation(
        window.location.origin,
        pathname,
        window.location.search,
        !firstPageViewSentRef.current,
      );
      const pageTitle = safeAnalyticsPageTitle(pathname);

      setGoogleAnalyticsDisabled(gtagWindow, false);

      if (!initializedRef.current) {
        gtagWindow.gtag?.("js", new Date());
        initializedRef.current = true;
      }

      gtagWindow.gtag?.("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });

      if (!configuredRef.current) {
        gtagWindow.gtag?.("config", GA_MEASUREMENT_ID, {
          anonymize_ip: true,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          send_page_view: false,
          page_location: pageLocation,
          page_path: sanitizedPathname,
          page_title: pageTitle,
          ...(pageReferrer
            ? { page_referrer: pageReferrer }
            : {}),
        });
        configuredRef.current = true;
      }

      if (shouldSendAnalyticsPageView(lastTrackedPathRef.current, pathname)) {
        gtagWindow.gtag?.("event", "page_view", {
          page_location: pageLocation,
          page_path: sanitizedPathname,
          page_title: pageTitle,
          ...(pageReferrer
            ? { page_referrer: pageReferrer }
            : {}),
        });
        lastTrackedPathRef.current = pathname;
        firstPageViewSentRef.current = true;
      }

      return;
    }

    const gtagWindow = window as GtagWindow;
    setGoogleAnalyticsDisabled(gtagWindow, true);

    if (preference?.analytics !== "accepted") {
      gtagWindow.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      removeGoogleAnalyticsCookies();
      configuredRef.current = false;
      lastTrackedPathRef.current = null;
    }

    if (isAdministrativeNavigation) {
      lastTrackedPathRef.current = null;
    }
  }, [analyticsEnabled, isAdministrativeNavigation, pathname, preference]);

  if (!GA_MEASUREMENT_ID || !analyticsEnabled) {
    return null;
  }

  return (
    <>
      <Script
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />

    </>
  );
}
