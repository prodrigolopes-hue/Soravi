"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import { isDetails, type Details } from "./admin-identity-review-details";

type Attempt = { id: string; createdAt: string; professionalProfile: { displayName: string } };
type DecisionResult = "CONFIRMED" | "NOT_CONFIRMED" | "INCONCLUSIVE";
const base = apiBaseUrl.replace(/\/+$/u, "");
const decisionReasons: Record<DecisionResult, readonly { value: string; label: string }[]> = {
  CONFIRMED: [{ value: "DOCUMENT_CHECKED", label: "Documento conferido" }],
  NOT_CONFIRMED: [
    { value: "DATA_MISMATCH", label: "Dados divergentes" },
    { value: "UNSUPPORTED_DOCUMENT", label: "Documento não aceito" },
    { value: "SUSPECTED_TAMPERING", label: "Possível adulteração" },
    { value: "SELFIE_DOCUMENT_MISMATCH", label: "Divergência entre selfie e documento" },
  ],
  INCONCLUSIVE: [
    { value: "DOCUMENT_UNREADABLE", label: "Documento ilegível" },
    { value: "DOCUMENT_INCOMPLETE", label: "Documento incompleto" },
    { value: "INSUFFICIENT_INFORMATION", label: "Informações insuficientes" },
    { value: "SELFIE_UNREADABLE", label: "Imagem ilegível" },
    { value: "FACE_OBSCURED", label: "Rosto encoberto" },
    { value: "INADEQUATE_EVIDENCE", label: "Evidência inadequada" },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isAttempt(value: unknown): value is Attempt {
  return isRecord(value) && typeof value.id === "string" && typeof value.createdAt === "string" && isRecord(value.professionalProfile) && typeof value.professionalProfile.displayName === "string";
}

export function AdminIdentityReviewsPage() {
  const { accessToken, user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState<string | null>(searchParams.get("attemptId"));
  const [details, setDetails] = useState<Details | null>(null);
  const [cpf, setCpf] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [openingDocument, setOpeningDocument] = useState(false);
  const [openingSelfie, setOpeningSelfie] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [decisionResult, setDecisionResult] = useState<DecisionResult>("CONFIRMED");
  const [reasonCode, setReasonCode] = useState("DOCUMENT_CHECKED");
  const [decisionConfirmed, setDecisionConfirmed] = useState(false);
  const [registeringDecision, setRegisteringDecision] = useState(false);
  const admin = Boolean(user?.roles.includes("ADMIN"));

  useEffect(() => {
    if (!accessToken || !admin) return;
    let active = true;
    setError(null);
    void fetch(`${base}/api/v1/users/admin/professional-identity-verifications`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !Array.isArray(body) || !body.every(isAttempt)) throw new Error("Invalid identity review list response");
        if (active) setItems(body);
      })
      .catch(() => { if (active) setError("Não foi possível carregar as análises pendentes."); });
    return () => { active = false; };
  }, [accessToken, admin]);

  useEffect(() => {
    if (!selected || !accessToken || !admin) return;
    let active = true;
    setCpf(null); setDocumentUrl(null); setSelfieUrl(null); setSelfieError(null); setDetails(null); setLoadingDetails(true); setError(null);
    void fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(selected)}/details`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isDetails(body)) throw new Error("Invalid identity review details response");
        if (active) setDetails(body);
      })
      .catch(() => { if (active) setError("Não foi possível carregar os detalhes privados desta análise."); })
      .finally(() => { if (active) setLoadingDetails(false); });
    return () => { active = false; };
  }, [accessToken, admin, selected]);

  function selectAttempt(attemptId: string) {
    setDocumentUrl(null); setSelfieUrl(null); setSelfieError(null); setCpf(null); setSelected(attemptId);
  }
  function closeDetails() { setSelected(null); setDetails(null); setCpf(null); setDocumentUrl(null); setSelfieUrl(null); setSelfieError(null); setError(null); }
  function changeDecisionResult(result: DecisionResult) {
    setDecisionResult(result);
    setReasonCode(decisionReasons[result][0].value);
    setDecisionConfirmed(false);
  }
  async function revealCpf() {
    if (!selected || !accessToken || revealing) return;
    setRevealing(true); setError(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(selected)}/cpf-reveal`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || typeof body.cpf !== "string") throw new Error("Invalid CPF reveal response");
      setCpf(body.cpf);
    } catch { setError("Não foi possível revelar o CPF agora."); } finally { setRevealing(false); }
  }
  async function viewDocument() {
    if (!selected || !accessToken || openingDocument) return;
    setOpeningDocument(true); setError(null); setDocumentUrl(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(selected)}/evidence`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const body: unknown = await response.json();
      if (response.status === 404 && isRecord(body) && body.code === "IDENTITY_EVIDENCE_UNAVAILABLE") { setError("Documento não está mais disponível."); return; }
      if (!response.ok || !isRecord(body) || typeof body.url !== "string") throw new Error("Invalid identity evidence response");
      setDocumentUrl(body.url);
    } catch { setError("Não foi possível obter o documento agora."); } finally { setOpeningDocument(false); }
  }
  async function viewSelfie() {
    const attemptId = selected;
    if (!attemptId || !accessToken || openingSelfie) return;
    setOpeningSelfie(true); setSelfieError(null); setSelfieUrl(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(attemptId)}/selfie`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || typeof body.url !== "string") throw new Error("Invalid selfie evidence response");
      if (selected === attemptId) setSelfieUrl(body.url);
    } catch { if (selected === attemptId) setSelfieError("Não foi possível obter a selfie agora."); } finally { if (selected === attemptId) setOpeningSelfie(false); }
  }  async function registerDecision() {
    if (!selected || !accessToken || !decisionConfirmed || registeringDecision || details?.attempt.status !== "UNDER_REVIEW") return;
    setRegisteringDecision(true); setError(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(selected)}/decision`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", cache: "no-store",
        body: JSON.stringify({ result: decisionResult, reasonCode, criteriaVersion: "v1" }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || typeof body.attemptId !== "string" || typeof body.result !== "string") throw new Error("Invalid identity decision response");
      const [listResponse, detailsResponse] = await Promise.all([
        fetch(`${base}/api/v1/users/admin/professional-identity-verifications`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" }),
        fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(selected)}/details`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" }),
      ]);
      const [listBody, detailsBody]: unknown[] = await Promise.all([listResponse.json(), detailsResponse.json()]);
      if (!listResponse.ok || !Array.isArray(listBody) || !listBody.every(isAttempt) || !detailsResponse.ok || !isDetails(detailsBody)) throw new Error("Invalid refreshed identity review response");
      setItems(listBody); setDetails(detailsBody); setDocumentUrl(null); setDecisionConfirmed(false);
    } catch { setError("Não foi possível registrar a decisão agora. Atualize os detalhes antes de tentar novamente."); } finally { setRegisteringDecision(false); }
  }

  if (isLoading) return <p>Carregando…</p>;
  if (!admin) return <p>Acesso restrito à administração.</p>;
  const pending = details?.attempt.status === "UNDER_REVIEW";
  const availableReasons = decisionReasons[decisionResult];
  return <main className="mx-auto max-w-4xl p-6"><Link href="/admin/profissionais" className="text-sm font-semibold text-blue-700 underline">Voltar para profissionais</Link><h1 className="mt-4 text-3xl font-bold">Análise privada de identidade</h1><p className="mt-2 text-slate-600">Documentos permanecem privados; decisões não aprovam o perfil profissional.</p>{error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}<ul className="mt-6 space-y-3">{items.map((attempt) => <li key={attempt.id} className="rounded-xl border p-4"><strong>{attempt.professionalProfile.displayName}</strong><p className="text-sm">Recebida em {new Date(attempt.createdAt).toLocaleString("pt-BR")}</p><button type="button" className="mt-3 underline" onClick={() => selectAttempt(attempt.id)}>Analisar documentos</button></li>)}</ul>{selected ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><button type="button" className="text-sm font-semibold text-blue-700 underline" onClick={closeDetails}>Fechar detalhes</button>{loadingDetails ? <p className="mt-4">Carregando detalhes…</p> : null}{details ? <><h2 className="mt-4 text-xl font-bold">{details.professionalName}</h2><p className="mt-2 text-sm">Status: {details.attempt.status} · Resultado: {details.attempt.result}</p><button type="button" disabled={openingDocument} onClick={() => void viewDocument()} className="mt-4 min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800 disabled:opacity-60">{openingDocument ? "Obtendo documento…" : "Obter documento"}</button>{documentUrl ? <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-3 py-2 font-semibold text-white">Abrir documento</a> : null}{details.attempt.hasActiveSelfie ? <><button type="button" disabled={openingSelfie} onClick={() => void viewSelfie()} className="mt-4 ml-2 min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800 disabled:opacity-60">{openingSelfie ? "Obtendo selfie…" : "Abrir selfie"}</button>{selfieUrl ? <a href={selfieUrl} target="_blank" rel="noopener noreferrer" className="mt-3 ml-2 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-3 py-2 font-semibold text-white">Abrir selfie</a> : null}{selfieError ? <p role="alert" className="mt-2 text-sm text-red-700">{selfieError}</p> : null}</> : null}<p className="mt-2 text-xs text-slate-600">O link é temporário, privado e é removido desta tela ao fechar ou trocar de tentativa.</p><div className="mt-4 rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">CPF cadastrado</h3>{cpf ? <p className="mt-2 font-mono text-lg">{cpf}</p> : <button type="button" disabled={revealing} onClick={() => void revealCpf()} className="mt-3 min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800 disabled:opacity-60">{revealing ? "Revelando…" : "Revelar CPF"}</button>}<p className="mt-2 text-xs text-slate-600">O CPF só é revelado nesta tela após uma ação explícita e não é armazenado no navegador.</p></div><h3 className="mt-5 font-semibold">Histórico de tentativas</h3><ul className="mt-3 space-y-3">{details.history.map((historyItem) => <li key={historyItem.id} className="rounded-xl border p-3 text-sm"><p>{historyItem.status} · {historyItem.result} · {new Date(historyItem.createdAt).toLocaleString("pt-BR")}</p>{historyItem.decisions.map((decision, index) => <p key={`${decision.createdAt}-${index}`} className="mt-1">Decisão: {decision.result} · motivo: {decision.reasonCode} · {new Date(decision.createdAt).toLocaleString("pt-BR")} · {decision.operator?.name ?? "Sistema"}</p>)}</li>)}</ul>{pending ? <form className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4" onSubmit={(event) => { event.preventDefault(); void registerDecision(); }}><h3 className="font-semibold">Registrar decisão</h3><label className="mt-3 block text-sm font-medium" htmlFor="identity-decision-result">Resultado</label><select id="identity-decision-result" value={decisionResult} onChange={(event) => changeDecisionResult(event.target.value as DecisionResult)} disabled={registeringDecision} className="mt-1 min-h-11 w-full rounded-lg border px-3"><option value="CONFIRMED">Confirmada</option><option value="NOT_CONFIRMED">Não confirmada</option><option value="INCONCLUSIVE">Inconclusiva</option></select><label className="mt-3 block text-sm font-medium" htmlFor="identity-decision-reason">Motivo</label><select id="identity-decision-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} disabled={registeringDecision} className="mt-1 min-h-11 w-full rounded-lg border px-3">{availableReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={decisionConfirmed} onChange={(event) => setDecisionConfirmed(event.target.checked)} disabled={registeringDecision} className="mt-1" /><span>Confirmo que revisei o documento e desejo encerrar esta tentativa com esta decisão.</span></label><button type="submit" disabled={!decisionConfirmed || registeringDecision} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{registeringDecision ? "Registrando decisão…" : "Registrar decisão"}</button></form> : <p className="mt-5 text-sm text-slate-700">Esta análise foi encerrada e está disponível somente para leitura. Não é possível registrar nova decisão ou reabrir a tentativa.</p>}</> : null}</section> : null}</main>;
}
