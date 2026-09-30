"use client";

import { BriefcaseBusiness, ClipboardList, MessageCircle, Star, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { professionalDashboardUrl, professionalVerificationSubmissionUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import { formatServiceRequestDate } from "../service-requests/service-request-presentation";

type Dashboard = { opportunitiesAvailable: number; proposalsSent: number; servicesContractedOrInProgress: number; servicesCompleted: number; averageRating: number; reviewCount: number; recentOpportunities: Array<{ id: string; createdAt: string; title: string; categoryName: string; city: string; state: string }>; recentServices: Array<{ id: string; status: string; title: string; completedAt: string | null }> };
type LoadState = "loading" | "success" | "empty" | "error";
type SubmissionState = "idle" | "submitting" | "error";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function parseDashboard(payload: unknown): Dashboard | null {
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(root) || !["opportunitiesAvailable", "proposalsSent", "servicesContractedOrInProgress", "servicesCompleted", "averageRating", "reviewCount"].every((key) => typeof root[key] === "number") || !Array.isArray(root.recentOpportunities) || !Array.isArray(root.recentServices)) return null;
  if (!root.recentOpportunities.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.createdAt === "string" && typeof item.title === "string" && typeof item.categoryName === "string" && typeof item.city === "string" && typeof item.state === "string")) return null;
  if (!root.recentServices.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.status === "string" && typeof item.title === "string" && (typeof item.completedAt === "string" || item.completedAt === null))) return null;
  return root as Dashboard;
}

export function ProfessionalDashboardPage() {
  const { accessToken, isAuthenticated, isLoading, user, refreshSession } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));
  const load = useCallback(async () => {
    if (!accessToken) return;
    setState("loading");
    try {
      const response = await fetch(professionalDashboardUrl, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const parsed = parseDashboard(await response.json().catch(() => null));
      if (!response.ok || !parsed) throw new Error();
      setData(parsed); setState(parsed.recentOpportunities.length === 0 && parsed.recentServices.length === 0 ? "empty" : "success");
    } catch { setData(null); setState("error"); }
  }, [accessToken]);
  useEffect(() => { if (isAuthenticated && isProfessional && accessToken) void load(); }, [accessToken, isAuthenticated, isProfessional, load]);
  if (isLoading || (isAuthenticated && isProfessional && state === "loading")) return <PageMessage title="Carregando seu painel..." />;
  if (!isAuthenticated) return <PageMessage title="Entre para acessar seu painel" description="Acesse sua conta profissional para acompanhar seu trabalho." action={{ href: "/entrar", label: "Entrar" }} />;
  if (!isProfessional) return <PageMessage title="Acesso exclusivo para profissionais" description="Esta pagina requer uma conta com perfil profissional." />;
  if (state === "error") return <PageMessage title="Nao foi possivel carregar seu painel" action={{ href: "/profissional", label: "Tentar novamente" }} />;
  const submitForVerification = async (): Promise<void> => {
    if (!accessToken || submissionState === "submitting") return;
    setSubmissionState("submitting"); setSubmissionError(null);
    try {
      const response = await fetch(professionalVerificationSubmissionUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        throw new Error(isRecord(payload) && typeof payload.message === "string" ? payload.message : "Nao foi possivel enviar seu perfil para analise agora.");
      }
      await refreshSession(); setSubmissionState("idle");
    } catch (error: unknown) { setSubmissionError(error instanceof Error ? error.message : "Nao foi possivel enviar seu perfil para analise agora."); setSubmissionState("error"); }
  };
  const quickActions = [{ href: "/profissional/oportunidades", label: "Ver oportunidades", icon: BriefcaseBusiness }, { href: "/conversas", label: "Conversas", icon: MessageCircle }, { href: "/profissional/perfil", label: "Editar perfil", icon: UserRound }];
  return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><header><p className="font-semibold text-blue-600">Area do profissional</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Ola, {user?.professionalProfile?.displayName ?? user?.name}</h1><p className="mt-3 text-slate-600">Acompanhe oportunidades, servicos e sua reputacao.</p></header><ProfessionalVerificationCard status={user?.professionalProfile?.verificationStatus} phoneVerified={user?.phoneVerified ?? false} isSubmitting={submissionState === "submitting"} error={submissionError} onSubmit={() => void submitForVerification()} /><section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo profissional"><SummaryCard label="Oportunidades" value={data?.opportunitiesAvailable ?? 0} /><SummaryCard label="Propostas enviadas" value={data?.proposalsSent ?? 0} /><SummaryCard label="Contratados / em andamento" value={data?.servicesContractedOrInProgress ?? 0} /><SummaryCard label="Concluidos" value={data?.servicesCompleted ?? 0} /></section><section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Reputacao"><p className="text-sm text-slate-600">Avaliacao</p><p className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-950"><Star aria-hidden="true" className="size-5 fill-amber-400 text-amber-400" />{(data?.averageRating ?? 0).toFixed(1)} <span className="text-sm font-normal text-slate-600">({data?.reviewCount ?? 0} avaliacoes)</span></p></section><section className="mt-8" aria-labelledby="professional-quick-actions"><h2 id="professional-quick-actions" className="text-xl font-bold text-slate-950">Acoes rapidas</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{quickActions.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"><Icon aria-hidden="true" className="size-5 text-blue-600" />{label}</Link>)}</div></section><section className="mt-8 grid gap-8 lg:grid-cols-2"><RecentOpportunities items={data?.recentOpportunities ?? []} empty={state === "empty"} /><RecentServices items={data?.recentServices ?? []} empty={state === "empty"} /></section></div></main>;
}

function ProfessionalVerificationCard({ status, phoneVerified, isSubmitting, error, onSubmit }: { status: string | undefined; phoneVerified: boolean; isSubmitting: boolean; error: string | null; onSubmit: () => void }) {
  const { user } = useAuth();
  const reviewNotes = user?.professionalProfile?.reviewNotes;
  if (status === "PENDING") return <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Perfil em analise</h2><p className="mt-2 text-sm text-amber-900">Seu perfil foi enviado para analise administrativa.</p></section>;
  if (status === "APPROVED") return <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">Perfil aprovado</h2><p className="mt-2 text-sm text-emerald-900">Seu perfil profissional esta verificado.</p></section>;
  if (status === "REJECTED") return <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5"><h2 className="font-bold text-red-950">Perfil nao aprovado</h2><p className="mt-2 text-sm text-red-900">Revise seu perfil e reenvie-o para uma nova analise.</p>{reviewNotes ? <p className="mt-3 text-sm text-red-950"><span className="font-semibold">Motivo da revisao:</span> {reviewNotes}</p> : null}{error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}<div className="mt-4 flex gap-3"><Link href="/profissional/perfil" className="inline-flex min-h-11 items-center rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-900">Editar perfil</Link><button type="button" disabled={isSubmitting} onClick={onSubmit} className="inline-flex min-h-11 items-center rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Reenviando..." : "Reenviar para analise"}</button></div></section>;
  if (!phoneVerified) return <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Verifique seu telefone</h2><p className="mt-2 text-sm text-amber-900">A verificacao do telefone e necessaria para enviar seu perfil para analise.</p><Link href="/verificar-telefone" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white">Verificar telefone</Link></section>;
  return <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-bold text-blue-950">Envie seu perfil para verificacao</h2><p className="mt-2 text-sm text-blue-900">Com telefone verificado e categoria selecionada, seu perfil pode seguir para analise.</p>{error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}<button type="button" disabled={isSubmitting} onClick={onSubmit} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Enviando..." : "Enviar perfil para verificacao"}</button></section>;
}

function SummaryCard({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm leading-5 text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>; }
function RecentOpportunities({ items, empty }: { items: Dashboard["recentOpportunities"]; empty: boolean }) { return <section aria-labelledby="recent-opportunities"><h2 id="recent-opportunities" className="text-xl font-bold text-slate-950">Oportunidades recentes</h2>{empty ? <Empty label="Nenhuma oportunidade disponivel agora." /> : <ul className="mt-4 space-y-3">{items.map((item) => <li key={item.id}><Link href={`/profissional/oportunidades/${item.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300"><h3 className="font-semibold text-slate-950">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.categoryName} - {item.city} - {item.state}</p><p className="mt-1 text-sm text-slate-500">{formatServiceRequestDate(item.createdAt)}</p></Link></li>)}</ul>}</section>; }
function RecentServices({ items, empty }: { items: Dashboard["recentServices"]; empty: boolean }) { return <section aria-labelledby="recent-services"><h2 id="recent-services" className="text-xl font-bold text-slate-950">Servicos recentes</h2>{empty ? <Empty label="Nenhum servico contratado ainda." /> : <ul className="mt-4 space-y-3">{items.map((item) => <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-semibold text-slate-950">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.status === "COMPLETED" ? "Concluido" : item.status === "IN_PROGRESS" ? "Em andamento" : "Contratado"}{item.completedAt ? ` - ${formatServiceRequestDate(item.completedAt)}` : ""}</p></li>)}</ul>}</section>; }
function Empty({ label }: { label: string }) { return <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-600"><ClipboardList aria-hidden="true" className="size-5 text-slate-400" /><p className="mt-2 text-sm">{label}</p></div>; }
function PageMessage({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string } }) { return <main className="bg-slate-50"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">{title}</h1>{description ? <p className="mt-3 text-slate-600">{description}</p> : null}{action ? <Link href={action.href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">{action.label}</Link> : null}</section></div></main>; }
