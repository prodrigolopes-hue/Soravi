"use client";

import { type ChangeEvent, useEffect, useState } from "react";

import { professionalIdentityDocumentUrl, professionalIdentitySelfieUrl, professionalIdentityVerificationStatusUrl } from "../../lib/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
type IdentityStatus = { status: "NOT_STARTED" | "UNDER_REVIEW" | "CLOSED"; result: "PENDING" | "CONFIRMED" | "NOT_CONFIRMED" | "INCONCLUSIVE"; requiresSelfie?: boolean; documentSubmitted?: boolean; selfieSubmitted?: boolean };

function isIdentityStatus(value: unknown): value is IdentityStatus {
  return typeof value === "object" && value !== null && "status" in value && "result" in value && ["NOT_STARTED", "UNDER_REVIEW", "CLOSED"].includes(String(value.status)) && ["PENDING", "CONFIRMED", "NOT_CONFIRMED", "INCONCLUSIVE"].includes(String(value.result));
}

export function ProfessionalIdentityDocumentUpload({ accessToken }: { accessToken: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const maySubmit = status !== null && !(status.status === "UNDER_REVIEW" || (status.status === "CLOSED" && status.result === "CONFIRMED"));

  useEffect(() => {
    let active = true;
    void fetch(professionalIdentityVerificationStatusUrl, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => { if (!response.ok || !isIdentityStatus(payload)) throw new Error(); if (active) setStatus(payload); })
      .catch(() => { if (active) setError("Não foi possível consultar o estado do documento agora."); });
    return () => { active = false; };
  }, [accessToken]);

  function selectFile(event: ChangeEvent<HTMLInputElement>): void {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    if (!selected) { setFile(null); return; }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("O documento deve ter no máximo 5 MiB.");
      return;
    }
    if (selected.type !== "image/jpeg" && selected.type !== "image/png") {
      setFile(null);
      setError("Envie uma imagem JPEG ou PNG do seu documento.");
      return;
    }
    setFile(selected);
  }

  function selectSelfie(event: ChangeEvent<HTMLInputElement>): void {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    if (!selected) { setSelfie(null); return; }
    if (selected.size > MAX_FILE_SIZE || (selected.type !== "image/jpeg" && selected.type !== "image/png")) {
      setSelfie(null);
      setError("Envie uma selfie JPEG ou PNG com no máximo 5 MiB.");
      return;
    }
    setSelfie(selected);
  }

  async function submit(): Promise<void> {
    if (!file || isSubmitting || !maySubmit) return;
    setIsSubmitting(true);
    setError(null);
    const body = new FormData();
    body.append("document", file, file.name);
    try {
      const response = await fetch(professionalIdentityDocumentUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        body,
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const code = typeof payload === "object" && payload !== null && "code" in payload ? (payload as { code?: unknown }).code : undefined;
        setError(code === "PERSONAL_IDENTITY_REQUIRED"
          ? "Cadastre seu CPF antes de enviar o documento."
          : code === "PROFESSIONAL_IDENTITY_DOCUMENT_ALREADY_SUBMITTED"
            ? "Documento enviado — aguardando análise."
            : code === "PROFESSIONAL_IDENTITY_ALREADY_CONFIRMED"
              ? "Identidade confirmada."
            : "Não foi possível enviar o documento agora. Tente novamente.");
        return;
      }
      setFile(null);
      setStatus({ status: "UNDER_REVIEW", result: "PENDING" });
    } catch {
      setError("Não foi possível enviar o documento agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitSelfie(): Promise<void> {
    if (!selfie || isSubmitting || !status?.requiresSelfie || !maySubmit) return;
    setIsSubmitting(true); setError(null);
    const body = new FormData(); body.append("selfie", selfie, selfie.name);
    try {
      const response = await fetch(professionalIdentitySelfieUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", body });
      if (!response.ok) throw new Error();
      setSelfie(null); setStatus({ ...status, selfieSubmitted: true, status: status.documentSubmitted ? "UNDER_REVIEW" : "NOT_STARTED" });
    } catch { setError("Não foi possível enviar a selfie agora. Tente novamente."); } finally { setIsSubmitting(false); }
  }

  const guidance = status?.status === "UNDER_REVIEW" ? "Documento enviado — aguardando análise." : status?.status === "CLOSED" && status.result === "CONFIRMED" ? "Identidade confirmada." : status?.status === "CLOSED" ? "Não foi possível confirmar sua identidade. Revise a imagem e envie um novo documento." : null;
  return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="identity-document-title">
    <h2 id="identity-document-title" className="text-xl font-bold text-slate-950">Documento de identidade</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Envie uma foto legível da sua CIN, RG ou CNH. O arquivo é usado somente na análise interna de identidade e não aparece para clientes nem no seu perfil público.</p>
    {guidance ? <p role="status" className="mt-3 text-sm font-medium text-slate-800">{guidance}</p> : null}
    {maySubmit ? <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Selecionar documento<input type="file" accept="image/jpeg,image/png" className="sr-only" disabled={isSubmitting} onChange={selectFile} /></label> : null}
    {file ? <p className="mt-3 text-sm text-slate-700">Arquivo selecionado: {file.name}</p> : null}
    {file && maySubmit ? <button type="button" disabled={isSubmitting} onClick={() => void submit()} className="mt-3 block min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Enviando..." : "Enviar para análise"}</button> : null}
    {error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    {status?.requiresSelfie ? <div className="mt-6 border-t pt-5"><h3 className="font-semibold text-slate-950">Selfie para verificação</h3><p className="mt-2 text-sm leading-6 text-slate-600">Tire uma foto atual, de frente, em um local bem iluminado, com o rosto inteiro visível. Não use óculos escuros, boné, chapéu, máscara ou filtros. Se os óculos de grau causarem reflexos ou esconderem seus olhos, retire-os. Não envie foto de outra pessoa nem imagem de documento.</p><p className="mt-2 text-sm leading-6 text-slate-600">A selfie é usada somente na análise interna da identidade e não aparece no seu perfil público.</p>{status.selfieSubmitted ? <p className="mt-3 text-sm font-medium text-slate-800">Selfie enviada.</p> : maySubmit ? <><label className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Selecionar selfie<input type="file" accept="image/jpeg,image/png" className="sr-only" disabled={isSubmitting} onChange={selectSelfie} /></label>{selfie ? <button type="button" disabled={isSubmitting} onClick={() => void submitSelfie()} className="mt-3 block min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Enviando..." : "Enviar selfie"}</button> : null}</> : null}</div> : null}
  </section>;
}
