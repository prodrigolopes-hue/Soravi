"use client";

import { useState } from "react";

import { adminProfessionalVerificationUrl } from "../../lib/api";

type ReviewStatus = "APPROVED" | "REJECTED";

interface Props {
  userId: string;
  verificationStatus: string;
  accessToken: string;
  onReviewed: (status: ReviewStatus, reviewedAt: string, reviewNotes: string | null) => void;
}

function errorMessage(status: number, payload: unknown): string {
  if (status === 401) return "Sessao invalida ou expirada. Faca login novamente.";
  if (status === 403) return "Voce nao possui permissao para revisar profissionais.";
  if (status === 409) return "Este perfil ja foi revisado. Atualize a listagem.";
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") return payload.message;
  return "Nao foi possivel revisar o profissional agora. Tente novamente.";
}

export function AdminProfessionalVerificationAction({ userId, verificationStatus, accessToken, onReviewed }: Props) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (verificationStatus !== "PENDING") return null;
  const submit = async (status: ReviewStatus): Promise<void> => {
    if (isSubmitting) return;
    setIsSubmitting(true); setError(null);
    try {
      const response = await fetch(adminProfessionalVerificationUrl(userId), { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(status === "REJECTED" ? { status, reviewNotes: notes } : { status }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== "object") throw new Error(errorMessage(response.status, payload));
      const root = "data" in payload && payload.data && typeof payload.data === "object" ? payload.data : payload;
      if (!("verificationStatus" in root) || !("reviewedAt" in root) || typeof root.verificationStatus !== "string" || typeof root.reviewedAt !== "string") throw new Error("Resposta de revisao invalida.");
      onReviewed(status, root.reviewedAt, "reviewNotes" in root && (typeof root.reviewNotes === "string" || root.reviewNotes === null) ? root.reviewNotes : null);
      setMode("idle");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nao foi possivel revisar o profissional agora."); } finally { setIsSubmitting(false); }
  };
  if (mode === "approve") return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm text-emerald-900">Confirmar aprovacao deste perfil?</p>{error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}<div className="mt-3 flex gap-2"><button type="button" disabled={isSubmitting} onClick={() => setMode("idle")} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold">Cancelar</button><button type="button" disabled={isSubmitting} onClick={() => void submit("APPROVED")} className="min-h-10 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Aprovando..." : "Confirmar aprovacao"}</button></div></div>;
  if (mode === "reject") return <div className="rounded-xl border border-red-200 bg-red-50 p-3"><label htmlFor={`review-notes-${userId}`} className="text-sm font-semibold text-red-950">Motivo opcional</label><textarea id={`review-notes-${userId}`} value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-lg border border-red-200 p-2 text-sm" /><p className="mt-1 text-xs text-red-800">{notes.length}/1000</p>{error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}<div className="mt-3 flex gap-2"><button type="button" disabled={isSubmitting} onClick={() => setMode("idle")} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold">Cancelar</button><button type="button" disabled={isSubmitting} onClick={() => void submit("REJECTED")} className="min-h-10 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Rejeitando..." : "Confirmar rejeicao"}</button></div></div>;
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setError(null); setMode("approve"); }} className="min-h-10 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-700">Aprovar</button><button type="button" onClick={() => { setError(null); setMode("reject"); }} className="min-h-10 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700">Rejeitar</button></div>;
}
