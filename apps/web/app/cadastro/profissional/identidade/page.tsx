"use client";

import Link from "next/link";
import { useAuth } from "../../../../components/auth/auth-provider";
import { PersonalIdentityCollection } from "../../../../components/professional/personal-identity-collection";
import { ProfessionalIdentityDocumentUpload } from "../../../../components/professional/professional-identity-document-upload";
import { ProfessionalCompletionProgress } from "../../../../components/professional/professional-completion-progress";

export default function ProfessionalIdentityRegistrationPage() {
  const { accessToken, isAuthenticated, isLoading, user, refreshUser } = useAuth();
  if (isLoading) return <main className="mx-auto max-w-2xl p-8">Carregando cadastro...</main>;
  if (!isAuthenticated || !accessToken || !user) return <main className="mx-auto max-w-2xl p-8"><p>Entre na sua conta profissional para continuar seu cadastro.</p><Link className="text-blue-700 underline" href="/entrar">Entrar</Link></main>;
  if (!user.roles.includes("PROFESSIONAL")) return <main className="mx-auto max-w-2xl p-8">Esta etapa é exclusiva para profissionais.</main>;
  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-2xl px-4 py-10">
    <p className="font-semibold text-blue-700">Cadastro profissional</p>
    <h1 className="mt-2 text-3xl font-bold text-slate-950">Confirme sua identidade</h1>
    <p className="mt-3 leading-7 text-slate-600">Informe seu CPF e envie seu documento e sua selfie para análise. Você poderá receber novas oportunidades depois que sua identidade for confirmada e seu perfil aprovado.</p>
    <p className="mt-3 text-sm text-slate-600">Na próxima etapa, confirme seu e-mail e seu telefone.</p>
    <ProfessionalCompletionProgress user={user} showAction={false} />
    <PersonalIdentityCollection key={`${user.id}:${accessToken}`} userId={user.id} accessToken={accessToken} />
    <ProfessionalIdentityDocumentUpload accessToken={accessToken} onEvidenceSubmitted={refreshUser} />
    {user.professionalRegistrationCompleted ? <div className="mt-6 rounded-xl bg-emerald-50 p-4"><p role="status">Documentos enviados para análise.</p><Link className="mt-3 inline-block font-semibold text-blue-700 underline" href="/cadastro/profissional/contatos">Continuar para confirmar contatos</Link></div> : <div className="mt-6"><p className="text-sm text-slate-600">Você poderá enviar os documentos depois. Até a confirmação da identidade, não receberá novas oportunidades.</p><Link className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800" href="/cadastro/profissional/contatos">Enviar documentos depois</Link></div>}
  </div></main>;
}
