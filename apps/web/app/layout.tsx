import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GoogleAnalytics } from "../components/analytics/google-analytics";
import { AuthProvider } from "../components/auth/auth-provider";
import { PhoneVerificationGuard } from "../components/auth/phone-verification-guard";
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

export default async function RootLayout({ children }: RootLayoutProps) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-slate-950 antialiased">
        <CookieConsentProvider>
          <AuthProvider>
            <PhoneVerificationGuard>
              <GoogleAnalytics nonce={nonce} />
              <div className="flex min-h-screen flex-col">
                <PageHeader />

                <div className="flex-1">{children}</div>

                <SiteFooter />
              </div>
            </PhoneVerificationGuard>
          </AuthProvider>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
