"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

import { useCookieConsent } from "../cookies/cookie-consent";

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

  const domain = window.location.hostname;

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

    if (domain) {
      document.cookie =
        `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
    }
  }
}

export function GoogleAnalytics() {
  const { preference } = useCookieConsent();
  const configuredRef = useRef(false);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) {
      return;
    }

    const gtagWindow = ensureGtag();

    if (preference?.analytics === "accepted") {
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
          send_page_view: true,
        });

        configuredRef.current = true;
      }

      return;
    }

    gtagWindow.gtag?.("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    if (preference?.analytics === "rejected") {
      removeGoogleAnalyticsCookies();
    }
  }, [preference]);

  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />

      <Script
        id="soravi-google-analytics-bootstrap"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];

          window.gtag = window.gtag || function() {
            window.dataLayer.push(arguments);
          };

          window.gtag('js', new Date());
        `}
      </Script>
    </>
  );
}