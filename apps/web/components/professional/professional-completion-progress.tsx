"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { AuthUser } from "../auth/auth-provider";
import { getProfessionalCompletion } from "./professional-completion";

export function ProfessionalCompletionProgress({ user, showAction = true }: { user: AuthUser; showAction?: boolean }) {
  const progress = getProfessionalCompletion(user);
  if (!progress.next) return null;
  const steps = [
    { label: "Conta criada", done: true, detail: "Concluída" },
    { label: "Envie documento e selfie", done: progress.documents, detail: progress.documents ? "Enviados ou identidade confirmada" : "Você pode enviar agora ou depois" },
    { label: "Confirme e-mail e telefone", done: progress.contacts, detail: progress.contacts ? "Contatos confirmados" : "Ambos são necessários para enviar o perfil" },
    { label: "Envie seu perfil para análise", done: progress.submitted, detail: user.professionalProfile?.verificationStatus === "REJECTED" ? "Revise e reenvie seu perfil" : progress.submitted ? "Enviado" : "Acompanhe o resultado no perfil" },
  ];
  return <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="completion-title">
    <h2 id="completion-title" className="text-xl font-bold text-slate-950">Complete seu cadastro profissional</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Veja o que falta para preparar seu perfil e receber oportunidades.</p>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Progresso do cadastro" aria-valuemin={0} aria-valuemax={4} aria-valuenow={progress.completed}><div className="h-full rounded-full bg-blue-700" style={{ width: `${progress.completed * 25}%` }} /></div>
    <p className="mt-2 text-sm text-slate-600">{progress.completed} de 4 etapas concluídas</p>
    <ul className="mt-5 space-y-4">{steps.map((step) => <li key={step.label} className="flex items-start gap-3">{step.done ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" /> : <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />}<div><p className="font-semibold text-slate-900">{step.label} <span className="sr-only">{step.done ? "concluída" : "pendente"}</span></p><p className="text-sm text-slate-600">{step.detail}</p></div></li>)}</ul>
    {showAction ? <Link href={progress.next.href} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 sm:w-auto">{progress.next.label}</Link> : null}
    <p className="mt-4 text-sm leading-6 text-slate-600">A análise de identidade e a aprovação do perfil são etapas separadas. O envio não significa aprovação automática.</p>
  </section>;
}
