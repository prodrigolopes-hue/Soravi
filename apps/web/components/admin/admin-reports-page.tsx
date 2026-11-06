"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { adminReportUrl, adminReportsUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type ReportStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
type Item = { id: string; protocol: string; status: ReportStatus; reason: string; contract: { serviceRequest: { publicCode: string; title: string } } };
type Detail = Record<string, unknown> & { id: string; status: ReportStatus; contract: { serviceRequest?: { publicCode?: string; title?: string } }; reporter: { name?: string; role?: string }; target: { name?: string; role?: string } };

const statusLabels: Record<ReportStatus, string> = { OPEN: "Aberta", UNDER_REVIEW: "Em análise", RESOLVED: "Resolvida", DISMISSED: "Descartada" };

function transitionsFor(status: ReportStatus): readonly ReportStatus[] {
  if (status === "OPEN") return ["UNDER_REVIEW", "RESOLVED", "DISMISSED"];
  if (status === "UNDER_REVIEW") return ["RESOLVED", "DISMISSED"];
  return [];
}

export function AdminReportsPage() {
  const { accessToken, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [resolution, setResolution] = useState("");
  const [status, setStatus] = useState<ReportStatus>("UNDER_REVIEW");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const response = await fetch(adminReportsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json().catch(() => null);
    if (response.ok && Array.isArray(body)) setItems(body as Item[]);
    else setError("Não foi possível carregar as denúncias.");
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  async function open(id: string) {
    if (!accessToken) return;
    const response = await fetch(adminReportUrl(id), { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json().catch(() => null);
    if (response.ok && body && typeof body === "object") {
      const detail = body as Detail;
      setSelected(detail);
      setStatus(transitionsFor(detail.status)[0] ?? detail.status);
      setResolution("");
    }
  }

  async function decide() {
    if (!accessToken || !selected || transitionsFor(selected.status).length === 0) return;
    const response = await fetch(adminReportUrl(selected.id), { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status, resolution }) });
    if (response.ok) { await load(); await open(selected.id); }
    else setError("Não foi possível atualizar a denúncia.");
  }

  if (!user?.roles.includes("ADMIN")) return <main className="p-6">Acesso restrito à administração.</main>;

  const transitions = selected ? transitionsFor(selected.status) : [];
  const readonly = selected !== null && transitions.length === 0;

  return <main className="mx-auto max-w-4xl p-6"><Link href="/admin" className="text-sm font-semibold text-blue-700 underline">← Voltar ao painel admin</Link><h1 className="mt-4 text-3xl font-bold">Denúncias de contratações</h1>{error ? <p role="alert" className="mt-3 text-red-700">{error}</p> : null}<ul className="mt-6 space-y-3">{items.map((item) => <li key={item.id} className="rounded-xl border p-4"><button className="text-left" onClick={() => void open(item.id)}><strong>{item.protocol}</strong><p className="text-sm font-medium">{item.contract.serviceRequest.publicCode} · {item.contract.serviceRequest.title}</p><p className="text-sm">{statusLabels[item.status]} · {item.reason}</p></button></li>)}</ul>{selected ? <section className="mt-6 rounded-xl border p-4"><h2 className="text-xl font-bold">{String(selected.protocol)}</h2><p className="mt-1 text-sm font-medium">{selected.contract.serviceRequest?.publicCode} · {selected.contract.serviceRequest?.title}</p><p className="mt-2 text-sm">Status: <strong>{statusLabels[selected.status]}</strong></p><p className="mt-3 text-sm">Denunciante: <strong>{selected.reporter.name}</strong> ({selected.reporter.role === "CUSTOMER" ? "Cliente" : "Profissional"})</p><p className="text-sm">Denunciado: <strong>{selected.target.name}</strong> ({selected.target.role === "CUSTOMER" ? "Cliente" : "Profissional"})</p><p className="mt-2 whitespace-pre-wrap">{String(selected.description)}</p>{readonly ? <p className="mt-4 text-sm text-slate-600">Esta denúncia foi encerrada e está disponível somente para leitura.</p> : <><label className="mt-4 block">Status<select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)} className="ml-2 border">{transitions.map((nextStatus) => <option key={nextStatus} value={nextStatus}>{statusLabels[nextStatus]}</option>)}</select></label><textarea required value={resolution} onChange={(event) => setResolution(event.target.value)} minLength={3} maxLength={1200} className="mt-3 block min-h-24 w-full border p-2" placeholder="Motivo da decisão" /><button disabled={resolution.trim().length < 3} onClick={() => void decide()} className="mt-3 rounded bg-blue-700 px-3 py-2 font-semibold text-white">Registrar decisão</button></>}</section> : null}</main>;
}
