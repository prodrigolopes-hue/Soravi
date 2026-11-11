"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

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
const identityStatusLabels: Record<string, string> = {
  AWAITING_EVIDENCE: "Aguardando documentos",
  UNDER_REVIEW: "Em análise",
  CLOSED: "Encerrada",
  CANCELLED: "Cancelada",
};
const identityResultLabels: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Identidade confirmada",
  NOT_CONFIRMED: "Identidade não confirmada",
  INCONCLUSIVE: "Análise inconclusiva",
};

function formatIdentityStatus(status: string): string { return identityStatusLabels[status] ?? status; }
function formatIdentityResult(result: string): string { return identityResultLabels[result] ?? result; }
function formatDecisionReason(reasonCode: string): string {
  return Object.values(decisionReasons).flat().find((reason) => reason.value === reasonCode)?.label ?? "Motivo não catalogado";
}
function isKnownDecisionReason(reasonCode: string): boolean {
  return Object.values(decisionReasons).flat().some((reason) => reason.value === reasonCode);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isAttempt(value: unknown): value is Attempt {
  return isRecord(value) && typeof value.id === "string" && typeof value.createdAt === "string" && isRecord(value.professionalProfile) && typeof value.professionalProfile.displayName === "string";
}

type DisposalPreviewItem = {
  evidenceId: string; attemptId: string; kind: string; createdAt: string; supersededAt: string | null;
  attemptStatus: string; closedAt: string | null; lastEvidenceAt: string | null; decisionAt: string | null;
  discardRequestedAt: string | null; discardStartedAt: string | null; discardedAt: string | null;
  reason: string | null; eligibleAt: string | null; policyEligible: boolean; executionEligible: boolean; impediments: string[];
};
type DisposalPreview = {
  policyVersion: string; referenceAt: string; executionEnabled: boolean; totalsByReason: Record<string, number>;
  items: DisposalPreviewItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
const disposalReasonLabels: Record<string, string> = { SUPERSEDED: "Evidência substituída", INCOMPLETE_ATTEMPT: "Tentativa incompleta", CLOSED_ATTEMPT: "Tentativa encerrada" };
const disposalKindLabels: Record<string, string> = { DOCUMENT: "Documento", SELFIE: "Selfie" };
const disposalImpedimentLabels: Record<string, string> = {
  UNDER_REVIEW: "Em análise", DISPOSAL_SUSPENDED: "Descarte suspenso", DISCARD_ALREADY_REQUESTED: "Descarte já solicitado",
  DISCARD_IN_PROGRESS: "Descarte em andamento", ALREADY_DISCARDED: "Já descartada", ATTEMPT_EXPIRATION_REQUIRED: "Expiração da tentativa necessária",
};
function isDateOrNull(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function isDisposalPreviewItem(value: unknown): value is DisposalPreviewItem {
  return isRecord(value) && typeof value.evidenceId === "string" && typeof value.attemptId === "string" && typeof value.kind === "string" && typeof value.createdAt === "string"
    && isDateOrNull(value.supersededAt) && typeof value.attemptStatus === "string" && isDateOrNull(value.closedAt) && isDateOrNull(value.lastEvidenceAt)
    && isDateOrNull(value.decisionAt) && isDateOrNull(value.discardRequestedAt) && isDateOrNull(value.discardStartedAt) && isDateOrNull(value.discardedAt)
    && isDateOrNull(value.reason) && isDateOrNull(value.eligibleAt) && typeof value.policyEligible === "boolean" && typeof value.executionEligible === "boolean"
    && Array.isArray(value.impediments) && value.impediments.every((item) => typeof item === "string");
}
function isDisposalPreview(value: unknown): value is DisposalPreview {
  return isRecord(value) && typeof value.policyVersion === "string" && typeof value.referenceAt === "string" && typeof value.executionEnabled === "boolean"
    && isRecord(value.totalsByReason) && Object.values(value.totalsByReason).every((item) => typeof item === "number")
    && Array.isArray(value.items) && value.items.every(isDisposalPreviewItem) && isRecord(value.pagination)
    && typeof value.pagination.page === "number" && typeof value.pagination.pageSize === "number" && typeof value.pagination.total === "number" && typeof value.pagination.totalPages === "number";
}
function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString("pt-BR") : "—"; }
function formatSuspensionAction(action: string): string { return action === "APPLIED" ? "Suspensão aplicada" : action === "RELEASED" ? "Suspensão liberada" : action; }
type DisposalTask = { id: string; attemptId: string; kind: string; status: string; attemptCount: number; policyVersion: string; eligibleAt: string; nextAttemptAt: string; leaseExpiresAt: string | null; irreversibleStartedAt: string | null; completedAt: string | null; createdAt: string; updatedAt: string };
type DisposalTasks = { items: DisposalTask[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
const disposalTaskStatusLabels: Record<string, string> = { PENDING: "Pendente", PROCESSING: "Em processamento", COMPLETED: "Concluída", FAILED: "Falhou" };
function isDisposalTask(value: unknown): value is DisposalTask { return isRecord(value) && typeof value.id === "string" && typeof value.attemptId === "string" && typeof value.kind === "string" && typeof value.status === "string" && typeof value.attemptCount === "number" && typeof value.policyVersion === "string" && typeof value.eligibleAt === "string" && typeof value.nextAttemptAt === "string" && isDateOrNull(value.leaseExpiresAt) && isDateOrNull(value.irreversibleStartedAt) && isDateOrNull(value.completedAt) && typeof value.createdAt === "string" && typeof value.updatedAt === "string"; }
function isDisposalTasks(value: unknown): value is DisposalTasks { return isRecord(value) && Array.isArray(value.items) && value.items.every(isDisposalTask) && isRecord(value.pagination) && typeof value.pagination.page === "number" && typeof value.pagination.pageSize === "number" && typeof value.pagination.total === "number" && typeof value.pagination.totalPages === "number"; }

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
  const [detailsRevision, setDetailsRevision] = useState(0);
  const refreshDetails = useCallback(() => { setDetailsRevision((revision) => revision + 1); }, []);
  const selectedAttempt = useRef<string | null>(selected);
  const admin = Boolean(user?.roles.includes("ADMIN"));

  useEffect(() => { selectedAttempt.current = selected; }, [selected]);

  useEffect(() => {
    if (!admin || !accessToken) return;
    const main = document.querySelector("main");
    if (!main) return;
    const host = document.createElement("section");
    const list = main.querySelector(":scope > ul");
    host.className = "mt-6";
    main.insertBefore(host, list);
    const root = createRoot(host);
    root.render(<><DisposalPreviewPanel accessToken={accessToken} /><DisposalTasksPanel accessToken={accessToken} /></>);
    return () => { root.unmount(); host.remove(); };
  }, [accessToken, admin]);

  useEffect(() => {
    if (!selected || !details || !accessToken) return;
    const detailsHost = document.querySelector("main > section.rounded-2xl");
    if (!detailsHost) return;
    const host = document.createElement("section");
    host.className = "mt-5";
    detailsHost.append(host);
    const root = createRoot(host);
    root.render(<DisposalSuspensionPanel attemptId={selected} suspension={details.disposalSuspension} accessToken={accessToken} onRefresh={refreshDetails} />);
    return () => { root.unmount(); host.remove(); };
  }, [accessToken, details, refreshDetails, selected]);

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
  }, [accessToken, admin, selected, detailsRevision]);

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
    const attemptId = selected;
    if (!attemptId || !accessToken || revealing) return;
    setRevealing(true); setError(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(attemptId)}/cpf-reveal`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || typeof body.cpf !== "string") throw new Error("Invalid CPF reveal response");
      if (selectedAttempt.current === attemptId) setCpf(body.cpf);
    } catch { if (selectedAttempt.current === attemptId) setError("Não foi possível revelar o CPF agora."); } finally { if (selectedAttempt.current === attemptId) setRevealing(false); }
  }
  async function viewDocument() {
    const attemptId = selected;
    if (!attemptId || !accessToken || openingDocument) return;
    setOpeningDocument(true); setError(null); setDocumentUrl(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(attemptId)}/evidence`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const body: unknown = await response.json();
      if (response.status === 404 && isRecord(body) && body.code === "IDENTITY_EVIDENCE_UNAVAILABLE") { if (selectedAttempt.current === attemptId) setError("Documento não está mais disponível."); return; }
      if (!response.ok || !isRecord(body) || typeof body.url !== "string") throw new Error("Invalid identity evidence response");
      if (selectedAttempt.current === attemptId) setDocumentUrl(body.url);
    } catch { if (selectedAttempt.current === attemptId) setError("Não foi possível obter o documento agora."); } finally { if (selectedAttempt.current === attemptId) setOpeningDocument(false); }
  }
  async function viewSelfie() {
    const attemptId = selected;
    if (!attemptId || !accessToken || openingSelfie) return;
    setOpeningSelfie(true); setSelfieError(null); setSelfieUrl(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(attemptId)}/selfie`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || typeof body.url !== "string") throw new Error("Invalid selfie evidence response");
      if (selectedAttempt.current === attemptId) setSelfieUrl(body.url);
    } catch { if (selectedAttempt.current === attemptId) setSelfieError("Não foi possível obter a selfie agora."); } finally { if (selectedAttempt.current === attemptId) setOpeningSelfie(false); }
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
  return <main className="mx-auto max-w-4xl p-6"><Link href="/admin/profissionais" className="text-sm font-semibold text-blue-700 underline">Voltar para profissionais</Link><h1 className="mt-4 text-3xl font-bold">Análise privada de identidade</h1><p className="mt-2 text-slate-600">Documentos permanecem privados; decisões não aprovam o perfil profissional.</p>{error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}<ul className="mt-6 space-y-3">{items.map((attempt) => <li key={attempt.id} className="rounded-xl border p-4"><strong>{attempt.professionalProfile.displayName}</strong><p className="text-sm">Recebida em {new Date(attempt.createdAt).toLocaleString("pt-BR")}</p><p className="text-sm">Status: {formatIdentityStatus("UNDER_REVIEW")}</p><button type="button" className="mt-3 underline" onClick={() => selectAttempt(attempt.id)}>Analisar documentos</button></li>)}</ul>{selected ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><button type="button" className="text-sm font-semibold text-blue-700 underline" onClick={closeDetails}>Fechar detalhes</button>{loadingDetails ? <p className="mt-4">Carregando detalhes…</p> : null}{details ? <><h2 className="mt-4 text-xl font-bold">{details.professionalName}</h2><p className="mt-2 text-sm">Status: {formatIdentityStatus(details.attempt.status)} · Resultado: {formatIdentityResult(details.attempt.result)}</p><button type="button" disabled={openingDocument} onClick={() => void viewDocument()} className="mt-4 min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800 disabled:opacity-60">{openingDocument ? "Obtendo documento…" : "Obter documento"}</button>{documentUrl ? <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-3 py-2 font-semibold text-white">Abrir documento</a> : null}{details.attempt.hasActiveSelfie ? <><button type="button" disabled={openingSelfie} onClick={() => void viewSelfie()} className="mt-4 ml-2 min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800 disabled:opacity-60">{openingSelfie ? "Obtendo selfie…" : "Abrir selfie"}</button>{selfieUrl ? <a href={selfieUrl} target="_blank" rel="noopener noreferrer" className="mt-3 ml-2 inline-flex min-h-11 rounded-xl bg-blue-700 px-3 py-2 font-semibold text-white">Abrir selfie</a> : null}{selfieError ? <p role="alert" className="mt-2 text-sm text-red-700">{selfieError}</p> : null}</> : null}<p className="mt-2 text-xs text-slate-600">O link é temporário, privado e é removido desta tela ao fechar ou trocar de tentativa.</p><div className="mt-4 rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">CPF cadastrado</h3>{cpf ? <p className="mt-2 font-mono text-lg">{cpf}</p> : <button type="button" disabled={revealing} onClick={() => void revealCpf()} className="mt-3 min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800 disabled:opacity-60">{revealing ? "Revelando…" : "Revelar CPF"}</button>}<p className="mt-2 text-xs text-slate-600">O CPF só é revelado nesta tela após uma ação explícita e não é armazenado no navegador.</p></div><h3 className="mt-5 font-semibold">Histórico de tentativas</h3><ul className="mt-3 space-y-3">{details.history.map((historyItem) => <li key={historyItem.id} className="rounded-xl border p-3 text-sm"><p>{formatIdentityStatus(historyItem.status)} · {formatIdentityResult(historyItem.result)} · {new Date(historyItem.createdAt).toLocaleString("pt-BR")}</p>{historyItem.decisions.map((decision, index) => <p key={`${decision.createdAt}-${index}`} className="mt-1">Decisão: {formatIdentityResult(decision.result)} · motivo: {formatDecisionReason(decision.reasonCode)}{isKnownDecisionReason(decision.reasonCode) ? null : <span className="text-slate-600"> · código: {decision.reasonCode}</span>} · {new Date(decision.createdAt).toLocaleString("pt-BR")} · {decision.operator?.name ?? "Sistema"}</p>)}</li>)}</ul>{pending ? <form className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4" onSubmit={(event) => { event.preventDefault(); void registerDecision(); }}><h3 className="font-semibold">Registrar decisão</h3><label className="mt-3 block text-sm font-medium" htmlFor="identity-decision-result">Resultado</label><select id="identity-decision-result" value={decisionResult} onChange={(event) => changeDecisionResult(event.target.value as DecisionResult)} disabled={registeringDecision} className="mt-1 min-h-11 w-full rounded-lg border px-3"><option value="CONFIRMED">Identidade confirmada</option><option value="NOT_CONFIRMED">Identidade não confirmada</option><option value="INCONCLUSIVE">Análise inconclusiva</option></select><label className="mt-3 block text-sm font-medium" htmlFor="identity-decision-reason">Motivo</label><select id="identity-decision-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} disabled={registeringDecision} className="mt-1 min-h-11 w-full rounded-lg border px-3">{availableReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={decisionConfirmed} onChange={(event) => setDecisionConfirmed(event.target.checked)} disabled={registeringDecision} className="mt-1" /><span>Confirmo que revisei o documento e desejo encerrar esta tentativa com esta decisão.</span></label><button type="submit" disabled={!decisionConfirmed || registeringDecision} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{registeringDecision ? "Registrando decisão…" : "Registrar decisão"}</button></form> : <p className="mt-5 text-sm text-slate-700">Esta análise foi encerrada e está disponível somente para leitura. Não é possível registrar nova decisão ou reabrir a tentativa.</p>}</> : null}</section> : null}</main>;
}

function DisposalSuspensionPanel({ attemptId, suspension, accessToken, onRefresh }: { attemptId: string; suspension: Details["disposalSuspension"]; accessToken: string; onRefresh: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => { sequence.current += 1; controller.current?.abort(); }, []);

  async function submit() {
    const trimmedReason = reason.trim();
    if (!trimmedReason || submitting) return;
    const requestId = sequence.current + 1;
    sequence.current = requestId;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setSubmitting(true); setError(null); setNotice(null);
    const releasing = suspension.active;
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${encodeURIComponent(attemptId)}/disposal-suspension${releasing ? "/release" : ""}`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", cache: "no-store", signal: nextController.signal,
        body: JSON.stringify({ reason: trimmedReason }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const code = isRecord(body) && typeof body.code === "string" ? body.code : "";
        if (code === "IDENTITY_EVIDENCE_DISPOSAL_IN_PROGRESS") throw new Error("O descarte já iniciou. A imagem pode já ter sido removida e não é possível prometer sua recuperação.");
        throw new Error("Não foi possível alterar a suspensão de descarte agora.");
      }
      if (!isRecord(body) || typeof body.attemptId !== "string") throw new Error("Resposta inválida ao alterar a suspensão de descarte.");
      if (sequence.current !== requestId) return;
      setReason(""); setNotice(releasing ? "Suspensão liberada. Consultando o estado atualizado no servidor." : "Descarte suspenso. Consultando o estado atualizado no servidor.");
      onRefresh();
    } catch (requestError) {
      if (sequence.current !== requestId || (requestError instanceof DOMException && requestError.name === "AbortError")) return;
      setError(requestError instanceof Error ? requestError.message : "Não foi possível alterar a suspensão de descarte agora.");
    } finally {
      if (sequence.current === requestId) setSubmitting(false);
    }
  }

  const actionLabel = suspension.active ? "Liberar suspensão" : "Suspender descarte";
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold">Suspensão de descarte</h3><p className="mt-2 text-sm">Estado atual: <strong>{suspension.active ? "Descarte suspenso" : "Sem suspensão ativa"}</strong></p>{error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}{notice ? <p role="status" className="mt-2 text-sm text-green-700">{notice}</p> : null}<label className="mt-3 block text-sm font-medium" htmlFor="identity-disposal-suspension-reason">Motivo</label><textarea id="identity-disposal-suspension-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={submitting} maxLength={500} className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2" /><button type="button" disabled={submitting || reason.trim().length === 0} onClick={() => void submit()} className="mt-3 min-h-11 rounded-xl border border-amber-500 px-3 py-2 font-semibold text-amber-900 disabled:opacity-60">{submitting ? "Atualizando suspensão…" : actionLabel}</button><h4 className="mt-4 font-medium">Eventos</h4>{suspension.events.length === 0 ? <p className="mt-2 text-sm text-slate-600">Nenhum evento de suspensão registrado.</p> : <ul className="mt-2 space-y-2 text-sm">{suspension.events.map((event, index) => <li key={`${event.createdAt}-${index}`} className="rounded-lg border border-amber-100 bg-white p-2">{formatSuspensionAction(event.action)} · motivo: {event.reason} · {event.operator?.name ?? "Sistema"} · {new Date(event.createdAt).toLocaleString("pt-BR")}</li>)}</ul>}</section>;
}

function DisposalPreviewPanel({ accessToken }: { accessToken: string | null }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DisposalPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function load(page: number) {
    if (!accessToken || loading) return;
    const requestId = sequence.current + 1;
    sequence.current = requestId;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true); setError(null);
    try {
      const url = new URL(`${base}/api/v1/users/admin/professional-identity-verifications/disposal-preview`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", "10");
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store", signal: nextController.signal });
      const body: unknown = await response.json();
      if (!response.ok || !isDisposalPreview(body)) throw new Error("Invalid disposal preview response");
      if (sequence.current === requestId) setPreview(body);
    } catch (requestError) {
      if (sequence.current === requestId && !(requestError instanceof DOMException && requestError.name === "AbortError")) setError("Não foi possível consultar a prévia de descarte.");
    } finally {
      if (sequence.current === requestId) setLoading(false);
    }
  }

  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold">Prévia de descarte de identidade</h2><p className="mt-1 text-sm text-slate-600">Esta consulta não exclui imagens nem altera análises.</p></div><button type="button" onClick={() => setOpen((current) => !current)} className="min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800">{open ? "Ocultar prévia" : "Mostrar prévia"}</button></div>
    {open ? <div className="mt-4"><button type="button" disabled={loading} onClick={() => void load(preview?.pagination.page ?? 1)} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{loading ? "Consultando prévia…" : preview ? "Consultar novamente" : "Consultar prévia de descarte"}</button>
      {error ? <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800"><p>{error}</p><button type="button" disabled={loading} onClick={() => void load(preview?.pagination.page ?? 1)} className="mt-2 underline disabled:opacity-60">Tentar novamente</button></div> : null}
      {preview ? <div className="mt-4 space-y-4"><div className="grid gap-3 text-sm sm:grid-cols-2"><p><strong>Política:</strong> {preview.policyVersion}</p><p><strong>Consulta:</strong> {formatDate(preview.referenceAt)}</p><p><strong>Execução automática:</strong> {preview.executionEnabled ? "Habilitada" : "Desabilitada"}</p></div><div><h3 className="font-semibold">Totais por motivo</h3><ul className="mt-2 flex flex-wrap gap-2">{Object.entries(preview.totalsByReason).map(([reason, total]) => <li key={reason} className="rounded-full bg-slate-200 px-3 py-1 text-sm">{disposalReasonLabels[reason] ?? reason}: {total}</li>)}</ul></div>
        {preview.items.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">Nenhuma evidência está elegível nesta consulta.</p> : <ul className="space-y-3">{preview.items.map((item) => <li key={item.evidenceId} className="rounded-xl border bg-white p-3 text-sm"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><strong>{disposalKindLabels[item.kind] ?? item.kind}</strong><span className={item.executionEligible ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>{item.executionEligible ? "Elegível para descarte" : item.policyEligible ? "Elegível, mas impedida" : "Ainda não elegível"}</span></div><dl className="mt-2 grid gap-x-4 gap-y-1 text-slate-700 sm:grid-cols-2"><div><dt className="font-medium">Tentativa</dt><dd className="break-all">{item.attemptId}</dd></div><div><dt className="font-medium">Motivo</dt><dd>{item.reason ? disposalReasonLabels[item.reason] ?? item.reason : "—"}</dd></div><div><dt className="font-medium">Elegível em</dt><dd>{formatDate(item.eligibleAt)}</dd></div><div><dt className="font-medium">Último envio</dt><dd>{formatDate(item.lastEvidenceAt)}</dd></div><div><dt className="font-medium">Substituída em</dt><dd>{formatDate(item.supersededAt)}</dd></div><div><dt className="font-medium">Decisão em</dt><dd>{formatDate(item.decisionAt)}</dd></div></dl>{item.impediments.length ? <p className="mt-2 text-amber-800">Impedimentos: {item.impediments.map((impediment) => disposalImpedimentLabels[impediment] ?? impediment).join(" · ")}</p> : null}</li>)}</ul>}
        {preview.pagination.totalPages > 1 ? <nav aria-label="Paginação da prévia" className="flex items-center justify-between gap-3"><button type="button" disabled={loading || preview.pagination.page === 1} onClick={() => void load(preview.pagination.page - 1)} className="min-h-11 rounded-xl border px-3 py-2 disabled:opacity-60">Anterior</button><span className="text-sm">Página {preview.pagination.page} de {preview.pagination.totalPages}</span><button type="button" disabled={loading || preview.pagination.page === preview.pagination.totalPages} onClick={() => void load(preview.pagination.page + 1)} className="min-h-11 rounded-xl border px-3 py-2 disabled:opacity-60">Próxima</button></nav> : null}</div> : null}
    </div> : null}
  </div>;
}

function DisposalTasksPanel({ accessToken }: { accessToken: string | null }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [tasks, setTasks] = useState<DisposalTasks | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => { sequence.current += 1; controller.current?.abort(); }, []);

  async function load(page: number) {
    if (!accessToken || loading) return;
    const requestId = sequence.current + 1;
    sequence.current = requestId;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true); setError(null);
    try {
      const url = new URL(`${base}/api/v1/users/admin/professional-identity-verifications/disposal-tasks`);
      url.searchParams.set("page", String(page)); url.searchParams.set("pageSize", "10");
      if (status !== "ALL") url.searchParams.set("status", status);
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store", signal: nextController.signal });
      const body: unknown = await response.json();
      if (!response.ok || !isDisposalTasks(body)) throw new Error("Invalid disposal tasks response");
      if (sequence.current === requestId) setTasks(body);
    } catch (requestError) {
      if (sequence.current === requestId && !(requestError instanceof DOMException && requestError.name === "AbortError")) setError("Não foi possível consultar as tarefas de descarte.");
    } finally {
      if (sequence.current === requestId) setLoading(false);
    }
  }

  return <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold">Acompanhamento de tarefas de descarte</h2><p className="mt-1 text-sm text-slate-600">Consulta somente leitura; não cria, reprocessa, exclui nem ativa tarefas.</p></div><button type="button" onClick={() => setOpen((current) => !current)} className="min-h-11 rounded-xl border border-blue-300 px-3 py-2 font-semibold text-blue-800">{open ? "Ocultar tarefas" : "Mostrar tarefas"}</button></div>{open ? <div className="mt-4"><label className="block text-sm font-medium" htmlFor="identity-disposal-task-status">Status</label><select id="identity-disposal-task-status" value={status} onChange={(event) => { setStatus(event.target.value); setTasks(null); }} disabled={loading} className="mt-1 min-h-11 rounded-lg border px-3"><option value="ALL">Todos</option>{Object.entries(disposalTaskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" disabled={loading} onClick={() => void load(tasks?.pagination.page ?? 1)} className="ml-3 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{loading ? "Consultando tarefas…" : tasks ? "Consultar novamente" : "Consultar tarefas"}</button>{error ? <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800"><p>{error}</p><button type="button" disabled={loading} onClick={() => void load(tasks?.pagination.page ?? 1)} className="mt-2 underline disabled:opacity-60">Tentar novamente</button></div> : null}{tasks ? <div className="mt-4">{tasks.items.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">Nenhuma tarefa encontrada para este filtro.</p> : <ul className="space-y-3">{tasks.items.map((task) => <li key={task.id} className="rounded-xl border bg-white p-3 text-sm"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><strong>{disposalKindLabels[task.kind] ?? task.kind}</strong><span className="font-semibold">{disposalTaskStatusLabels[task.status] ?? task.status}</span></div><dl className="mt-2 grid gap-x-4 gap-y-1 text-slate-700 sm:grid-cols-2"><div><dt className="font-medium">Tarefa</dt><dd className="break-all">{task.id}</dd></div><div><dt className="font-medium">Tentativa</dt><dd className="break-all">{task.attemptId}</dd></div><div><dt className="font-medium">Tentativas de execução</dt><dd>{task.attemptCount}</dd></div><div><dt className="font-medium">Política</dt><dd>{task.policyVersion}</dd></div><div><dt className="font-medium">Elegível em</dt><dd>{formatDate(task.eligibleAt)}</dd></div><div><dt className="font-medium">Próxima tentativa</dt><dd>{formatDate(task.nextAttemptAt)}</dd></div><div><dt className="font-medium">Início irreversível</dt><dd>{formatDate(task.irreversibleStartedAt)}</dd></div><div><dt className="font-medium">Concluída em</dt><dd>{formatDate(task.completedAt)}</dd></div></dl></li>)}</ul>}{tasks.pagination.totalPages > 1 ? <nav aria-label="Paginação das tarefas de descarte" className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={loading || tasks.pagination.page === 1} onClick={() => void load(tasks.pagination.page - 1)} className="min-h-11 rounded-xl border px-3 py-2 disabled:opacity-60">Anterior</button><span className="text-sm">Página {tasks.pagination.page} de {tasks.pagination.totalPages}</span><button type="button" disabled={loading || tasks.pagination.page === tasks.pagination.totalPages} onClick={() => void load(tasks.pagination.page + 1)} className="min-h-11 rounded-xl border px-3 py-2 disabled:opacity-60">Próxima</button></nav> : null}</div> : null}</div> : null}</div>;
}
