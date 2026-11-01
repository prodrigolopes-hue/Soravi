"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { apiBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type ListResult = {
  total: number;
  byStatus: Array<{ status: string; total: number }>;
  items: Array<{
    id: string;
    publicCode: string;
    title: string;
    status: string;
    createdAt: string;
    customerName: string;
  }>;
};

type Detail = {
  publicCode: string;
  title: string;
  description: string | null;
  status: string;
  category: { name: string };
  region: { country: string; state: string; city: string; neighborhood: string };
  customer: { name: string };
  targetProfessional: { displayName: string } | null;
  dates: Record<string, string | null>;
  cancellationReason: string | null;
  opportunities: Array<{ professional: { displayName: string }; createdAt: string; viewedAt: string | null }>;
  proposals: Array<{ id: string; professional: { displayName: string }; amountInCents: number; estimatedDurationValue: number; estimatedDurationUnit: string; conditions: string; status: string; isVisible: boolean; submittedAt: string; acceptedAt: string | null; rejectedAt: string | null; withdrawnAt: string | null; expiredAt: string | null }>;
  contract: { status: string; professional: { displayName: string }; agreedAmountInCents: number; agreedDurationValue: number; agreedDurationUnit: string; conditions: string; acceptedAt: string; startedAt: string | null; completedAt: string | null; cancelledAt: string | null; cancellationReason: string | null } | null;
};

const base = apiBaseUrl.replace(/\/+$/u, "");

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "Não registrado";
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export function AdminServiceRequestsPage() {
  const { accessToken, user } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ListResult | null>(null);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error" | "not-found">("idle");
  const detailInFlight = useRef<string | null>(null);
  const admin = Boolean(user?.roles.includes("ADMIN"));

  const load = useCallback(async (search: string) => {
    if (!accessToken || !admin) return;

    setError(false);
    try {
      const url = new URL(`${base}/api/v1/service-requests/admin`);
      if (search.trim()) url.searchParams.set("code", search.trim());
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      setResult((await response.json()) as ListResult);
    } catch {
      setError(true);
    }
  }, [accessToken, admin]);

  const openDetail = useCallback(async (publicCode: string) => {
    if (!accessToken || detailInFlight.current === publicCode || detail?.publicCode === publicCode) return;

    detailInFlight.current = publicCode;
    setDetail(null);
    setDetailState("loading");
    try {
      const response = await fetch(
        `${base}/api/v1/service-requests/admin/by-code/${encodeURIComponent(publicCode)}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" },
      );
      if (response.status === 404) {
        setDetailState("not-found");
        return;
      }
      if (!response.ok) throw new Error();
      setDetail((await response.json()) as Detail);
      setDetailState("idle");
    } catch {
      setDetailState("error");
    } finally {
      detailInFlight.current = null;
    }
  }, [accessToken, detail?.publicCode]);

  useEffect(() => {
    void load("");
  }, [load]);

  if (!admin) return <p className="p-6">Acesso restrito à administração.</p>;

  if (detailState === "loading") {
    return <main className="mx-auto max-w-6xl p-6"><p>Carregando detalhes comerciais…</p></main>;
  }

  if (detailState === "error" || detailState === "not-found") {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p role="alert" className="text-red-700">
          {detailState === "not-found" ? "Solicitação não encontrada." : "Não foi possível carregar os detalhes da solicitação."}
        </p>
        <button type="button" className="mt-4 min-h-11 rounded-xl border px-4 py-2 font-semibold" onClick={() => setDetailState("idle")}>Voltar à listagem</button>
      </main>
    );
  }

  if (detail) {
    const operationalMilestones: Array<[string, string | null]> = [
      ["Criada", detail.dates.createdAt],
      ["Publicada", detail.dates.publishedAt],
      ["Contratada", detail.dates.hiredAt],
      ["Iniciada", detail.dates.startedAt],
      ["Concluída", detail.dates.completedAt],
      ["Cancelada", detail.dates.cancelledAt],
    ];
    const milestones = operationalMilestones.filter(([, value]) => value !== null);

    return (
      <main className="mx-auto max-w-6xl p-6">
        <button type="button" className="text-sm font-semibold text-blue-700 underline" onClick={() => setDetail(null)}>Voltar à listagem</button>
        <h1 className="mt-4 text-3xl font-bold">Solicitação {detail.publicCode}</h1>
        <p className="mt-2 text-slate-600">Consulta administrativa somente leitura. Esta visualização não inclui conversas, documentos ou dados de identidade.</p>

        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">{detail.title}</h2>
          <p className="mt-2 text-sm text-slate-700">{detail.status} · {detail.category.name}</p>
          {detail.description ? <p className="mt-4 whitespace-pre-wrap text-slate-700">{detail.description}</p> : null}
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-sm text-slate-600">Cliente</dt><dd className="font-semibold">{detail.customer.name}</dd></div>
            <div><dt className="text-sm text-slate-600">Região</dt><dd className="font-semibold">{detail.region.neighborhood}, {detail.region.city} · {detail.region.state}, {detail.region.country}</dd></div>
            <div><dt className="text-sm text-slate-600">Profissional direcionado</dt><dd className="font-semibold">{detail.targetProfessional?.displayName ?? "Não direcionada"}</dd></div>
          </dl>
          {detail.cancellationReason ? <p className="mt-4 text-sm text-slate-700">Motivo do cancelamento: {detail.cancellationReason}</p> : null}
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Marcos operacionais</h2>
          <p className="mt-1 text-sm text-slate-600">Derivados das datas registradas; não constituem histórico completo.</p>
          {milestones.length ? <ol className="mt-4 space-y-2">{milestones.map(([label, value]) => <li key={label} className="text-sm"><strong>{label}:</strong> {formatDate(value)}</li>)}</ol> : <p className="mt-4 text-sm text-slate-600">Nenhum marco operacional registrado.</p>}
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Profissionais envolvidos</h2>
          {detail.opportunities.length ? <ul className="mt-4 space-y-2">{detail.opportunities.map((opportunity, index) => <li key={`${opportunity.professional.displayName}-${index}`} className="text-sm"><strong>{opportunity.professional.displayName}</strong> · oportunidade em {formatDate(opportunity.createdAt)} · {opportunity.viewedAt ? `vista em ${formatDate(opportunity.viewedAt)}` : "não visualizada"}</li>)}</ul> : <p className="mt-4 text-sm text-slate-600">Nenhuma oportunidade registrada.</p>}
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Propostas</h2>
          {detail.proposals.length ? <div className="mt-4 space-y-3">{detail.proposals.map((proposal) => <article key={proposal.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{proposal.professional.displayName}</strong><span className="text-sm font-semibold">{proposal.status}</span></div><p className="mt-2 text-sm">{formatAmount(proposal.amountInCents)} · {proposal.estimatedDurationValue} {proposal.estimatedDurationUnit}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">Condições: {proposal.conditions}</p><p className="mt-2 text-xs text-slate-600">Enviada: {formatDate(proposal.submittedAt)} · Aceita: {formatDate(proposal.acceptedAt)} · Rejeitada: {formatDate(proposal.rejectedAt)} · Retirada: {formatDate(proposal.withdrawnAt)} · Expirada: {formatDate(proposal.expiredAt)}</p></article>)}</div> : <p className="mt-4 text-sm text-slate-600">Nenhuma proposta vinculada.</p>}
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Contrato e proposta aceita</h2>
          {detail.contract ? <div className="mt-4 text-sm text-slate-700"><p><strong>{detail.contract.professional.displayName}</strong> · {detail.contract.status}</p><p className="mt-2">{formatAmount(detail.contract.agreedAmountInCents)} · {detail.contract.agreedDurationValue} {detail.contract.agreedDurationUnit}</p><p className="mt-2 whitespace-pre-wrap">Condições acordadas: {detail.contract.conditions}</p><p className="mt-2">Aceita: {formatDate(detail.contract.acceptedAt)} · Início: {formatDate(detail.contract.startedAt)} · Conclusão: {formatDate(detail.contract.completedAt)} · Cancelamento: {formatDate(detail.contract.cancelledAt)}</p>{detail.contract.cancellationReason ? <p className="mt-2">Motivo do cancelamento: {detail.contract.cancellationReason}</p> : null}</div> : <p className="mt-4 text-sm text-slate-600">Não há contrato vinculado.</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold">Solicitações</h1>
      <p className="mt-2 text-slate-600">Total geral e contagens por status são calculados diretamente das solicitações.</p>
      <form className="mt-6 flex flex-wrap gap-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void load(code); }}>
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Buscar código, ex.: SO2026001" className="min-h-11 min-w-0 flex-1 rounded-xl border px-3" />
        <button className="min-h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white">Buscar</button>
      </form>
      {error ? <p role="alert" className="mt-4 text-red-700">Não foi possível carregar as solicitações.</p> : null}
      {result ? <><div className="mt-6 rounded-xl border p-4"><strong>Total geral: {result.total}</strong><p className="mt-2 text-sm text-slate-600">{result.byStatus.map((item) => `${item.status}: ${item.total}`).join(" · ") || "Sem solicitações"}</p></div><ul className="mt-5 space-y-3">{result.items.map((item) => <li key={item.id} className="rounded-xl border p-4"><p className="font-semibold text-blue-700">{item.publicCode}</p><p className="font-semibold">{item.title}</p><p className="text-sm text-slate-600">{item.status} · {item.customerName}</p><button type="button" className="mt-3 min-h-11 rounded-xl border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800" onClick={() => void openDetail(item.publicCode)}>Ver detalhes</button></li>)}</ul></> : null}
    </main>
  );
}
