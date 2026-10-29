"use client";

import { type ChangeEvent, useState } from "react";

import { professionalIdentityDocumentUrl } from "../../lib/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function ProfessionalIdentityDocumentUpload({ accessToken }: { accessToken: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectFile(event: ChangeEvent<HTMLInputElement>): void {
    const selected = event.target.files?.[0] ?? null;
    setMessage(null);
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

  async function submit(): Promise<void> {
    if (!file || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
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
            ? "Seu documento já está em análise."
            : "Não foi possível enviar o documento agora. Tente novamente.");
        return;
      }
      setFile(null);
      setMessage("Documento enviado para análise privada. Ele não será exibido no seu perfil público.");
    } catch {
      setError("Não foi possível enviar o documento agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="identity-document-title">
    <h2 id="identity-document-title" className="text-xl font-bold text-slate-950">Documento de identidade</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Envie uma foto legível da sua CIN, RG ou CNH. O arquivo é usado somente na análise interna de identidade e não aparece para clientes nem no seu perfil público.</p>
    <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Selecionar documento<input type="file" accept="image/jpeg,image/png" className="sr-only" disabled={isSubmitting} onChange={selectFile} /></label>
    {file ? <p className="mt-3 text-sm text-slate-700">Arquivo selecionado: {file.name}</p> : null}
    {file ? <button type="button" disabled={isSubmitting} onClick={() => void submit()} className="mt-3 block min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Enviando..." : "Enviar para análise"}</button> : null}
    {error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    {message ? <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
  </section>;
}
