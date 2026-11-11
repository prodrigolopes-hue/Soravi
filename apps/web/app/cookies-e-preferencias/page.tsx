import type { Metadata } from "next";
import { CookieConsentFooterLink } from "../../components/cookies/cookie-consent";
import { LegalDocumentLayout, LegalSection } from "../../components/legal/legal-document-layout";
export const metadata: Metadata = { title: "Cookies e Preferências | Soravi", description: "Informações sobre cookies e analytics na Soravi." };
export default function CookiesPage() { return <LegalDocumentLayout title="Cookies e Preferências" description="Informações e controles de analytics no site.">
  <p className="text-sm text-slate-500">Versão 1.1 · Vigente a partir de 10 de novembro de 2026</p>
  <LegalSection title="Cookies essenciais"><p>Usamos recursos necessários para autenticação, segurança, funcionamento do site e registro técnico da sua preferência. Esses recursos permanecem ativos quando estritamente necessários.</p></LegalSection>
  <LegalSection title="Analytics opcional"><p>Analytics ajuda a compreender visitas, páginas e desempenho do site. Ele permanece desativado até sua escolha afirmativa. Recusar analytics não impede as funcionalidades essenciais.</p></LegalSection>
  <LegalSection title="Sua escolha"><p>O banner permite aceitar analytics ou recusar. Você pode reabrir a escolha a qualquer momento pelo rodapé. Ao recusar ou revogar a escolha, a Soravi mantém analytics desativado e remove cookies do Google Analytics que estejam acessíveis no navegador.</p><CookieConsentFooterLink className="font-semibold text-blue-700 underline underline-offset-4" /></LegalSection>
</LegalDocumentLayout>; }
