"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  CurrentUserPhoneApiError,
  formatBrazilianPhoneInput,
  updateCurrentUserPhone,
} from "../../lib/phone-verification";
import { z } from "../../lib/zod";
import { useAuth } from "../auth/auth-provider";

const phoneChangeSchema = z.object({
  phone: z.string().trim().min(1, "Informe o telefone.").refine((value) => {
    const digits = value.replace(/\D/gu, "");
    return digits.length === 10 || digits.length === 11;
  }, "Informe um telefone brasileiro válido com DDD."),
  currentPassword: z.string().min(1, "Informe sua senha atual.").max(128, "A senha atual deve possuir no máximo 128 caracteres."),
});

type PhoneChangeFormData = z.infer<typeof phoneChangeSchema>;

export function AccountPhonePage() {
  const { accessToken, isAuthenticated, isLoading, refreshSession, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PhoneChangeFormData>({
    resolver: zodResolver(phoneChangeSchema),
    defaultValues: { phone: "", currentPassword: "" },
    mode: "onTouched",
  });
  const phoneField = register("phone");

  if (isLoading) {
    return <AccountPhoneMessage title="Carregando telefone..." />;
  }

  if (!isAuthenticated || !accessToken || !user) {
    return <AccountPhoneMessage title="Entre para gerenciar seu telefone" description="Acesse sua conta Soravi para alterar ou verificar seu telefone." action={{ href: "/entrar", label: "Entrar" }} />;
  }

  const currentAccessToken = accessToken;
  const currentUser = user;
  const hasPhone = Boolean(currentUser.phone);

  async function submitPhoneChange(data: PhoneChangeFormData): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    try {
      await updateCurrentUserPhone(currentAccessToken, {
        phone: data.phone.trim(),
        currentPassword: data.currentPassword,
      });
      const changedNumber = phoneDigits(data.phone) !== phoneDigits(currentUser.phone ?? "");
      reset();
      setIsEditing(false);
      setRequiresVerification(changedNumber);
      setMessage(changedNumber ? "Telefone alterado. Verifique o novo número para concluir a atualização." : "Telefone salvo com sucesso.");
      await refreshSession();
    } catch (error) {
      setErrorMessage(
        error instanceof CurrentUserPhoneApiError
          ? error.message
          : "Não foi possível alterar o telefone agora. Tente novamente em instantes.",
      );
    }
  }

  function openEditor(): void {
    setMessage(null);
    setErrorMessage(null);
    setIsEditing(true);
  }

  function cancelEditor(): void {
    if (isSubmitting) {
      return;
    }

    reset();
    setErrorMessage(null);
    setIsEditing(false);
  }

  return (
    <main className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/conta" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Voltar para conta</Link>
        <header className="mt-5">
          <p className="font-semibold text-blue-700">Conta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Telefone</h1>
          <p className="mt-3 max-w-xl leading-7 text-slate-600">Mantenha seu telefone atualizado e verificado para usar os recursos da Soravi com segurança.</p>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="current-phone-title">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Phone aria-hidden="true" className="size-5" /></span>
            <div>
              <h2 id="current-phone-title" className="font-bold text-slate-950">Telefone atual</h2>
              <p className="mt-1 text-lg font-semibold text-slate-900">{user.phone ?? "Nenhum telefone cadastrado"}</p>
              <span className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${user.phoneVerified && !requiresVerification ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><ShieldCheck aria-hidden="true" className="size-4" />{user.phoneVerified && !requiresVerification ? "Verificado" : "Não verificado"}</span>
            </div>
          </div>

          {!isEditing ? <button type="button" onClick={openEditor} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-blue-600 px-4 py-2 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{hasPhone ? "Alterar telefone" : "Cadastrar telefone"}</button> : null}
        </section>

        {isEditing ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="phone-change-title"><h2 id="phone-change-title" className="text-xl font-bold text-slate-950">{hasPhone ? "Alterar telefone" : "Cadastrar telefone"}</h2><p className="mt-2 text-sm leading-6 text-slate-600">Por segurança, confirme sua senha atual para salvar o telefone.</p><form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit(submitPhoneChange)}><div><label htmlFor="account-phone" className="block text-sm font-semibold text-slate-800">{hasPhone ? "Novo telefone" : "Telefone"}</label><input id="account-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="(11) 99999-9999" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "account-phone-error" : "account-phone-hint"} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" {...phoneField} onChange={(event) => { event.target.value = formatBrazilianPhoneInput(event.target.value); void phoneField.onChange(event); }} />{errors.phone ? <p id="account-phone-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{errors.phone.message}</p> : <p id="account-phone-hint" className="mt-2 text-sm text-slate-600">Informe o DDD e o número.</p>}</div><div><label htmlFor="account-current-password" className="block text-sm font-semibold text-slate-800">Senha atual</label><input id="account-current-password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} aria-describedby={errors.currentPassword ? "account-current-password-error" : undefined} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" {...register("currentPassword")} />{errors.currentPassword ? <p id="account-current-password-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{errors.currentPassword.message}</p> : null}</div><button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">{isSubmitting ? <><Loader2 aria-hidden="true" className="size-5 animate-spin" />Salvando telefone...</> : "Salvar telefone"}</button><button type="button" disabled={isSubmitting} onClick={cancelEditor} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Cancelar</button></form></section> : null}

        {errorMessage ? <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{errorMessage}</div> : null}
        {message ? <div role="status" aria-live="polite" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><div className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />{message}</div>{requiresVerification ? <Link href="/verificar-telefone" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">Verificar novo telefone</Link> : null}</div> : null}

        {!isEditing && !message && !user.phoneVerified ? <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Verifique seu telefone</h2><p className="mt-2 text-sm leading-6 text-amber-900">Seu telefone ainda não foi verificado. Envie e confirme um código para concluir a verificação.</p><Link href="/verificar-telefone" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2">Verificar telefone</Link></section> : null}
      </div>
    </main>
  );
}

function AccountPhoneMessage({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string } }) {
  return <main className="bg-slate-50"><div className="mx-auto max-w-2xl px-4 py-10 sm:px-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">{title}</h1>{description ? <p className="mt-3 text-slate-600">{description}</p> : null}{action ? <Link href={action.href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{action.label}</Link> : null}</section></div></main>;
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/gu, "");
}
