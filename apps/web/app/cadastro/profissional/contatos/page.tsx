"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "../../../../components/auth/auth-provider";
import { canContinueProfessionalRegistrationContacts } from "../../../../components/auth/professional-registration-steps";
import { ProfessionalContactVerification } from "../../../../components/professional/professional-contact-verification";

export default function ProfessionalRegistrationContactsPage() {
  const { accessToken, isAuthenticated, isLoading, user, refreshUser } = useAuth();
  useEffect(() => {
    if (!accessToken) return;
    void refreshUser();
    const onFocus = () => { void refreshUser(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [accessToken, refreshUser]);
  if (isLoading) return <main className="mx-auto max-w-2xl p-8">Carregando cadastro...</main>;
  if (!isAuthenticated || !accessToken || !user) return <main className="mx-auto max-w-2xl p-8"><p>Entre na sua conta profissional para confirmar seus contatos.</p><Link className="text-blue-700 underline" href="/entrar">Entrar</Link></main>;
  if (!user.roles.includes("PROFESSIONAL")) return <main className="mx-auto max-w-2xl p-8">Esta etapa é exclusiva para profissionais.</main>;
  const contactsConfirmed = canContinueProfessionalRegistrationContacts(user);
  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-2xl px-4 py-10">
    <p className="font-semibold text-blue-700">Cadastro profissional</p>
    <h1 className="mt-2 text-3xl font-bold text-slate-950">Confirme seus contatos</h1>
    <p className="mt-3 leading-7 text-slate-600">Confirme o e-mail pelo link enviado e o telefone pelo código. Os dois são necessários para enviar seu perfil profissional para análise.</p>
    <ProfessionalContactVerification accessToken={accessToken} email={user.email} phone={user.phone} emailVerified={user.emailVerified} phoneVerified={user.phoneVerified} onPhoneVerified={refreshUser} emailVerificationFrom="professional-onboarding" />
    {contactsConfirmed ? <Link href="/profissional/perfil" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 font-semibold text-white">Continuar para meu perfil</Link> : <p role="status" className="mt-6 text-sm text-slate-600">Confirme os dois contatos para continuar para o perfil.</p>}
  </div></main>;
}
