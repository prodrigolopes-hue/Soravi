import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Soravi", description: "Encontre profissionais e resolva o que precisa." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
