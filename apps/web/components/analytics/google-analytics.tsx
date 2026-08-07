"use client";

import Script from "next/script";
import { useEffect } from "react";

import { useCookieConsent } from "../cookies/cookie-consent";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

function removeGoogleAnalyticsCookies(): void {
  if (typeof window === "undefined") {
    return;
  }

  const cookiesToRemove = ["_ga", "_gid"];

  const domain = window.location.hostname;
  const paths = ["/", "//"];

  const candidates = new Set<string>();

  for (const cookieName of cookiesToRemove) {
    candidates.add(cookieName);
  }

  for (const cookieName of document.cookie.split(";")) {
    const trimmedName = cookieName.trim();
    if (trimmedName.startsWith("_ga_")) {
      candidates.add(trimmedName.split("=")[0]);
    }
  }

  for (const cookieName of candidates) {
    for (const path of paths) {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
      if (domain) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}`;
      }
    }
  }
}

export function GoogleAnalytics() {
  const { preference } = useCookieConsent();

  useEffect(() => {
    const gtagWindow = window as GtagWindow;

    if (!gtagWindow.gtag) {
      gtagWindow.dataLayer = [];
      gtagWindow.gtag = function gtag(...args: unknown[]) {
        gtagWindow.dataLayer?.push(args);
      };
    }

    if (!GA_MEASUREMENT_ID || !preference || preference.analytics === "rejected") {
      if (preference?.analytics === "rejected") {
        removeGoogleAnalyticsCookies();
      }
      return;
    }

    if (preference.analytics === "accepted") {
      gtagWindow.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
  }, [preference]);

  if (!GA_MEASUREMENT_ID || !preference || preference.analytics !== "accepted") {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="soravi-ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
          window.gtag('js', new Date());
          window.gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
          window.gtag('config', '${GA_MEASUREMENT_ID}', {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
