"use client";

import { ClipboardList, Heart, MessageCircle, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { favoritesUrl, myServiceRequestsUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import { formatServiceRequestDate, isServiceRequestStatus, serviceRequestStatusPresentation, type ServiceRequestStatus } from "../service-requests/service-request-presentation";

type RequestItem = { id: string; title: string; status: ServiceRequestStatus; location: { city: string; state: string }; createdAt: string };
type DashboardData = { requests: RequestItem[]; favoriteCount: number };
type LoadState = "loading" | "success" | "empty" | "error";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

function parseRequests(payload: unknown): RequestItem[] | null {
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(root) || !Array.isArray(root.items)) return null;
  const items: RequestItem[] = [];
  for (const value of root.items) {
    if (!isRecord(value) || !isRecord(value.location) || typeof value.id !== "string" || typeof value.title !== "string" || !isServiceRequestStatus(value.status) || typeof value.location.city !== "string" || typeof value.location.state !== "string" || typeof value.createdAt !== "string") return null;
    items.push({ id: value.id, title: value.title, status: value.status, location: { city: value.location.city, state: value.location.state }, createdAt: value.createdAt });
  }
  return items;
}

function parseFavoriteCount(payload: unknown): number | null {
  const root = isRecord(payload) && "data" in payload ? payload.data : payload;
  return Array.isArray(root) ? root.length : null;
}

const openStatuses: ServiceRequestStatus[] = ["OPEN", "RECEIVING_PROPOSALS", "IN_NEGOTIATION"];
const ongoingStatuses: ServiceRequestStatus[] = ["HIRED", "IN_PROGRESS"];

export function CustomerDashboardPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));

  const load = useCallback(async () => {
    if (!accessToken) return;
    setState("loading");
    try {
      const requestsUrl = new URL(myServiceRequestsUrl);
      requestsUrl.searchParams.set("page", "1");
      requestsUrl.searchParams.set("limit", "100");
      requestsUrl.searchParams.set("sort", "desc");
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [requestsResponse, favoritesResponse] = await Promise.all([
        fetch(requestsUrl.toString(), { headers, credentials: "include", cache: "no-store" }),
        fetch(favoritesUrl, { headers, credentials: "include", cache: "no-store" }),
      ]);
      const [requestsPayload, favoritesPayload] = await Promise.all([requestsResponse.json().catch(() => null), favoritesResponse.json().catch(() => null)]);
      const requests = parseRequests(requestsPayload);
      const favoriteCount = parseFavoriteCount(favoritesPayload);
      if (!requestsResponse.ok || !favoritesResponse.ok || !requests || favoriteCount === null) throw new Error();
      setData({ requests, favoriteCount });
      setState(requests.length === 0 ? "empty" : "success");
    } catch { setData(null); setState("error"); }
  }, [accessToken]);

  useEffect(() => { if (isAuthenticated && isCustomer && accessToken) void load(); }, [accessToken, isAuthenticated, isCustomer, load]);

  if (isLoading || (isAuthenticated && isCustomer && state === "loading")) return <PageMessage title="Carregando seu painel..." />;
  if (!isAuthenticated) return <PageMessage title="Entre para acessar seu painel" description="Acesse sua conta de cliente para acompanhar seus serviços." action={{ href: "/entrar", label: "Entrar" }} />;
  if (!isCustomer) return <PageMessage title="Acesso exclusivo para clientes" description="Esta página requer uma conta com perfil de cliente." />;
  if (state === "error") return <main className="bg-slate-50"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><h1 className="text-xl font-bold">Não foi possível carregar seu painel</h1><button type="button" onClick={() => void load()} className="mt-3 font-semibold underline">Tentar novamente</button></div></div></main>;

  const requests = data?.requests ?? [];
  const openCount = requests.filter((item) => openStatuses.includes(item.status)).length;
  const ongoingCount = requests.filter((item) => ongoingStatuses.includes(item.status)).length;
  const completedCount = requests.filter((item) => item.status === "COMPLETED").length;
  const quickActions = [
    { href: "/solicitacoes/nova", label: "Nova solicitação", icon: Plus },
    { href: "/solicitacoes", label: "Minhas solicitações", icon: ClipboardList },
    { href: "/conversas", label: "Conversas", icon: MessageCircle },
    { href: "/favoritos", label: "Favoritos", icon: Heart },
  ];

  return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><header><p className="font-semibold text-blue-600">Área do cliente</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Olá, {user?.name}</h1><p className="mt-3 text-slate-600">Acompanhe seus pedidos e retome o que precisa fazer.</p></header><section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo das solicitações"><SummaryCard label="Solicitações abertas" value={openCount} /><SummaryCard label="Contratadas / em andamento" value={ongoingCount} /><SummaryCard label="Concluídos" value={completedCount} /><SummaryCard label="Favoritos" value={data?.favoriteCount ?? 0} /></section><section className="mt-8" aria-labelledby="quick-actions-title"><h2 id="quick-actions-title" className="text-xl font-bold text-slate-950">Ações rápidas</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{quickActions.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"><Icon aria-hidden="true" className="size-5 text-blue-600" />{label}</Link>)}</div></section><section className="mt-8" aria-labelledby="latest-requests-title"><div className="flex items-center justify-between gap-4"><h2 id="latest-requests-title" className="text-xl font-bold text-slate-950">Últimas solicitações</h2><Link href="/solicitacoes" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Ver todas</Link></div>{state === "empty" ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600"><Wrench aria-hidden="true" className="size-6 text-slate-400" /><p className="mt-3 font-medium text-slate-900">Você ainda não criou solicitações.</p><Link href="/solicitacoes/nova" className="mt-4 inline-flex min-h-11 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Criar solicitação</Link></div> : <ul className="mt-4 space-y-3">{requests.slice(0, 5).map((item) => <li key={item.id}><Link href={`/solicitacoes/${item.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.location.city} - {item.location.state} · {formatServiceRequestDate(item.createdAt)}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${serviceRequestStatusPresentation[item.status].className}`}>{serviceRequestStatusPresentation[item.status].label}</span></div></Link></li>)}</ul>}</section></div></main>;
}

function SummaryCard({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm leading-5 text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>; }
function PageMessage({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string } }) { return <main className="bg-slate-50"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">{title}</h1>{description ? <p className="mt-3 text-slate-600">{description}</p> : null}{action ? <Link href={action.href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">{action.label}</Link> : null}</section></div></main>; }
