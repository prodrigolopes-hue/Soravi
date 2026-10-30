"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type Result = "CONFIRMED" | "NOT_CONFIRMED" | "INCONCLUSIVE";
type Attempt = { id: string; createdAt: string; professionalProfile: { userId: string; displayName: string } };
const reasons: Record<Result, Array<{ value: string; label: string }>> = {
  CONFIRMED: [{ value: "DOCUMENT_CHECKED", label: "Documento legível e dados conferidos." }],
  NOT_CONFIRMED: [{ value: "DATA_MISMATCH", label: "Dados divergentes." }, { value: "UNSUPPORTED_DOCUMENT", label: "Documento não aceito." }, { value: "SUSPECTED_TAMPERING", label: "Indício de adulteração." }],
  INCONCLUSIVE: [{ value: "DOCUMENT_UNREADABLE", label: "Imagem ilegível." }, { value: "DOCUMENT_INCOMPLETE", label: "Documento incompleto." }, { value: "INSUFFICIENT_INFORMATION", label: "Informações insuficientes." }],
};
const base = apiBaseUrl.replace(/\/+$/u, "");

export function AdminIdentityReviewsPage() {
  const { accessToken, user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const requestedAttemptId = searchParams.get("attemptId");
  const [items, setItems] = useState<Attempt[]>([]); const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<Result>("CONFIRMED"); const [reasonCode, setReasonCode] = useState("DOCUMENT_CHECKED");
  const [error, setError] = useState<string | null>(null); const [isDeciding, setIsDeciding] = useState(false);
  const availableReasons = useMemo(() => reasons[result], [result]);

  useEffect(() => { if (!accessToken || !user?.roles.includes("ADMIN")) return; void fetch(`${base}/api/v1/users/admin/professional-identity-verifications`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" }).then(async response => { if (!response.ok) throw new Error(); const data = await response.json(); setItems(Array.isArray(data) ? data : []); }).catch(() => setError("Não foi possível carregar as tentativas.")); }, [accessToken, user?.roles]);
  useEffect(() => { if (requestedAttemptId && items.some((item) => item.id === requestedAttemptId)) setSelected(requestedAttemptId); }, [items, requestedAttemptId]);
  if (isLoading) return <p>Carregando…</p>; if (!user?.roles.includes("ADMIN")) return <p>Acesso restrito à administração.</p>;
  async function openEvidence(id: string) { const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${id}/evidence`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" }); const body = await response.json(); if (!response.ok || typeof body.url !== "string") { setError("Não foi possível abrir a evidência."); return; } window.open(body.url, "_blank", "noopener,noreferrer"); }
  function changeResult(value: Result) { setResult(value); setReasonCode(reasons[value][0].value); }
  async function decide() { if (!selected || isDeciding) return; const selectedReason = availableReasons.find((reason) => reason.value === reasonCode); if (!selectedReason) return; if (!window.confirm(`Confirmar decisão: ${result} — ${selectedReason.label}`)) return; setIsDeciding(true); setError(null); try { const response = await fetch(`${base}/api/v1/users/admin/professional-identity-verifications/${selected}/decision`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ result, reasonCode, criteriaVersion: "manual-v1" }) }); if (!response.ok) throw new Error(); setItems((current) => current.filter((item) => item.id !== selected)); setSelected(null); } catch { setError("A decisão não pôde ser registrada. Tente novamente."); } finally { setIsDeciding(false); } }
  return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-bold">Análise privada de identidade</h1><p className="mt-2 text-slate-600">A decisão não aprova o perfil profissional nem libera oportunidades.</p>{error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}<ul className="mt-6 space-y-3">{items.map((attempt) => <li key={attempt.id} className="rounded border p-4"><strong>{attempt.professionalProfile.displayName}</strong><p className="text-sm">Recebida em {new Date(attempt.createdAt).toLocaleString("pt-BR")}</p><button className="mr-3 mt-3 underline" onClick={() => void openEvidence(attempt.id)}>Abrir evidência</button><button className="mt-3 underline" onClick={() => setSelected(attempt.id)}>Decidir</button></li>)}</ul>{selected ? <section className="mt-6 rounded border p-4"><label className="block font-medium">Resultado<select className="ml-3 border p-2" value={result} disabled={isDeciding} onChange={(event) => changeResult(event.target.value as Result)}><option value="CONFIRMED">Confirmada</option><option value="NOT_CONFIRMED">Não confirmada</option><option value="INCONCLUSIVE">Inconclusiva</option></select></label><label className="mt-3 block font-medium">Motivo<select className="ml-3 border p-2" value={reasonCode} disabled={isDeciding} onChange={(event) => setReasonCode(event.target.value)}>{availableReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label><button className="mt-4 underline disabled:opacity-50" disabled={isDeciding} onClick={() => void decide()}>{isDeciding ? "Registrando…" : "Registrar decisão"}</button></section> : null}</main>;
}
