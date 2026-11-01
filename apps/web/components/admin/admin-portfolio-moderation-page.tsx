"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type Item = { id: string; caption: string | null; moderationVersion: number; professionalProfile: { displayName: string } };
type History = { result: string; reasonCode: string | null; contentVersion: number; createdAt: string; operator: { name: string; email: string } };
const reasons = ["INAPPROPRIATE_CONTENT", "PERSONAL_DATA_EXPOSED", "NOT_A_WORK_PHOTO", "LOW_QUALITY"];
const base = apiBaseUrl.replace(/\/+$/u, "");

export function AdminPortfolioModerationPage() {
  const { accessToken, user, isLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [result, setResult] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reason, setReason] = useState(reasons[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const admin = Boolean(user?.roles.includes("ADMIN"));

  const load = useCallback(async () => {
    if (!accessToken) return;
    const response = await fetch(`${base}/api/v1/users/admin/professional-portfolios`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
    const body: unknown = await response.json();
    if (!response.ok || !Array.isArray(body)) throw new Error("Invalid portfolio moderation list");
    setItems(body as Item[]);
  }, [accessToken]);

  useEffect(() => {
    if (admin) void load().catch(() => setError("Não foi possível carregar a fila."));
  }, [admin, load]);

  async function inspect(item: Item) {
    setSelected(item); setUrl(null); setHistory([]);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [evidence, historyResponse] = await Promise.all([
      fetch(`${base}/api/v1/users/admin/professional-portfolios/${item.id}/evidence`, { headers, credentials: "include", cache: "no-store" }),
      fetch(`${base}/api/v1/users/admin/professional-portfolios/${item.id}/history`, { headers, credentials: "include", cache: "no-store" }),
    ]);
    const evidenceBody: unknown = await evidence.json();
    const historyBody: unknown = await historyResponse.json();
    if (Array.isArray(historyBody)) setHistory(historyBody as History[]);
    if (evidence.ok && typeof evidenceBody === "object" && evidenceBody !== null && "url" in evidenceBody && typeof evidenceBody.url === "string") setUrl(evidenceBody.url);
    else setError("Não foi possível obter a foto privada.");
  }

  async function decide() {
    if (!selected || !confirmed || saving) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${base}/api/v1/users/admin/professional-portfolios/${selected.id}/decision`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ result, reasonCode: result === "REJECTED" ? reason : undefined, version: selected.moderationVersion }) });
      await response.json();
      if (!response.ok) throw new Error("Portfolio decision failed");
      setSelected(null); setUrl(null); setConfirmed(false); await load();
    } catch { setError("Não foi possível registrar a decisão."); } finally { setSaving(false); }
  }

  if (isLoading) return <p>Carregando…</p>;
  if (!admin) return <p>Acesso restrito à administração.</p>;
  return <main className="mx-auto max-w-4xl p-6"><Link href="/admin" className="underline">Voltar ao painel</Link><h1 className="mt-4 text-3xl font-bold">Moderação do portfólio</h1>{error ? <p role="alert" className="mt-3 text-red-700">{error}</p> : null}<ul className="mt-5 space-y-3">{items.map((item) => <li key={item.id} className="rounded border p-3"><strong>{item.professionalProfile.displayName}</strong><p>{item.caption ?? "Sem legenda"}</p><button type="button" onClick={() => void inspect(item)} className="mt-2 underline">Analisar foto</button></li>)}</ul>{selected ? <section className="mt-5 rounded border p-4">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Abrir foto privada</a> : <p>Obtendo foto…</p>}<div className="mt-3"><select value={result} disabled={saving} onChange={(event) => { setResult(event.target.value as "APPROVED" | "REJECTED"); setConfirmed(false); }}><option value="APPROVED">Aprovar</option><option value="REJECTED">Rejeitar</option></select>{result === "REJECTED" ? <select value={reason} disabled={saving} onChange={(event) => setReason(event.target.value)}>{reasons.map((value) => <option key={value}>{value}</option>)}</select> : null}</div><label className="mt-3 flex gap-2"><input type="checkbox" checked={confirmed} disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo esta decisão.</label><button type="button" disabled={!confirmed || saving} onClick={() => void decide()} className="mt-3 rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-60">{saving ? "Registrando…" : "Registrar decisão"}</button><h2 className="mt-5 font-semibold">Histórico</h2>{history.map((entry, index) => <p key={`${entry.createdAt}-${index}`} className="text-sm">{entry.result} · {entry.reasonCode ?? "sem motivo"} · versão {entry.contentVersion} · {entry.operator.name} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</p>)}</section> : null}</main>;
}