import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "../components/layout/site-footer";
import { SiteHeader } from "../components/layout/site-header";
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
        <div className="flex min-h-screen flex-col">
          <SiteHeader />

          <div className="flex-1">{children}</div>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}