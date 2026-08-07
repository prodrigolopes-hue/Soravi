import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GoogleAnalytics } from "../components/analytics/google-analytics";
import { CookieConsentProvider } from "../components/cookies/cookie-consent";
import { SiteFooter } from "../components/layout/site-footer";
import { PageHeader } from "../components/layout/page-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soravi",
  description:
    "Encontre profissionais e soluções para os serviços que você precisa.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-slate-950 antialiased">
        <CookieConsentProvider>
          <GoogleAnalytics />
          <div className="flex min-h-screen flex-col">
            <PageHeader />

            <div className="flex-1">{children}</div>

            <SiteFooter />
          </div>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
