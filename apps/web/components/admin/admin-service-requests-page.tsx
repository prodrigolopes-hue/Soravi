"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { apiBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type Result = { total: number; byStatus: Array<{ status: string; total: number }>; items: Array<{ id: string; publicCode: string; title: string; status: string; createdAt: string; customerName: string }> };

export function AdminServiceRequestsPage() {
  const { accessToken, user } = useAuth(); const [code, setCode] = useState(""); const [result, setResult] = useState<Result | null>(null); const [error, setError] = useState(false); const admin = Boolean(user?.roles.includes("ADMIN"));
  const load = useCallback(async (search: string) => { if (!accessToken || !admin) return; setError(false); try { const url = new URL(`${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/service-requests/admin`); if (search.trim()) url.searchParams.set("code", search.trim()); const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" }); if (!response.ok) throw new Error(); setResult(await response.json() as Result); } catch { setError(true); } }, [accessToken, admin]);
  useEffect(() => { void load(""); }, [load]);
  if (!admin) return <p className="p-6">Acesso restrito à administração.</p>;
  return <main className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-bold">Solicitações</h1><p className="mt-2 text-slate-600">Total geral e contagens por status são calculados diretamente das solicitações.</p><form className="mt-6 flex gap-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void load(code); }}><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Buscar código, ex.: SO2026001" className="min-h-11 flex-1 rounded-xl border px-3"/><button className="min-h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white">Buscar</button></form>{error ? <p role="alert" className="mt-4 text-red-700">Não foi possível carregar as solicitações.</p> : null}{result ? <><div className="mt-6 rounded-xl border p-4"><strong>Total geral: {result.total}</strong><p className="mt-2 text-sm text-slate-600">{result.byStatus.map((item) => `${item.status}: ${item.total}`).join(" · ") || "Sem solicitações"}</p></div><ul className="mt-5 space-y-3">{result.items.map((item) => <li key={item.id} className="rounded-xl border p-4"><p className="font-semibold text-blue-700">{item.publicCode}</p><p className="font-semibold">{item.title}</p><p className="text-sm text-slate-600">{item.status} · {item.customerName}</p></li>)}</ul></> : null}</main>;
}
