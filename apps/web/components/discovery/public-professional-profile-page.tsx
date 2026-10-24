"use client";

import { ChevronLeft, ChevronRight, FileText, Loader2, MapPin, ShieldAlert, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { parsePublicProfessionalProfile, publicProfessionalUrl, type PublicProfessionalProfile } from "../../lib/professional-discovery";
import { directedServiceRequestDestination } from "../../lib/directed-service-request";
import { ProfessionalAvatar } from "../professional/professional-avatar";

const PAGE_SIZE = 20;
type State = "loading" | "success" | "not-found" | "error";

export function PublicProfessionalProfilePage({ professionalProfileId }: { professionalProfileId: string }) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>("loading");
  const [profile, setProfile] = useState<PublicProfessionalProfile | null>(null);
  const photoRefreshRequestedRef = useRef(false);
  const profileRef = useRef<PublicProfessionalProfile | null>(null);

  useEffect(() => {
    profileRef.current = null;
    photoRefreshRequestedRef.current = false;
    setProfile(null); setPage(1); setState("loading");
  }, [professionalProfileId]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const load = useCallback(async (currentPage: number, signal: AbortSignal) => {
    if (!profileRef.current) setState("loading");
    try {
      const response = await fetch(publicProfessionalUrl(professionalProfileId, currentPage, PAGE_SIZE), {
        cache: "no-store", credentials: "omit", signal,
      });
      if (signal.aborted) return;
      if (response.status === 404) { if (!profileRef.current) setState("not-found"); return; }
      const parsed = response.ok ? parsePublicProfessionalProfile(await response.json().catch(() => null)) : null;
      if (signal.aborted) return;
      if (!parsed) { if (!profileRef.current) setState("error"); return; }
      profileRef.current = parsed; setProfile(parsed);
      setState("success");
    } catch (error) {
      if (!signal.aborted && !(error instanceof DOMException && error.name === "AbortError") && !profileRef.current) setState("error");
    }
  }, [professionalProfileId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(page, controller.signal);
    return () => controller.abort();
  }, [load, page, retry]);

  const refreshPhoto = useCallback((reason: "expired" | "error") => {
    if (reason === "error") {
      if (photoRefreshRequestedRef.current) return;
      photoRefreshRequestedRef.current = true;
    }
    setRetry((value) => value + 1);
  }, []);
  const changePage = useCallback((nextPage: number) => {
    profileRef.current = null;
    photoRefreshRequestedRef.current = false;
    setProfile(null); setPage(nextPage);
  }, []);

  if (state === "not-found") return <NotFoundProfile />;
  if (state === "error") return <LoadError onRetry={() => setRetry((value) => value + 1)} />;
  if (state === "loading" || !profile || profile.id !== professionalProfileId) return <Loading />;

  const totalPages = Math.max(1, profile.reviews.pagination.totalPages);
  return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <Link href={profile.categories[0] ? `/servicos/${encodeURIComponent(profile.categories[0].slug)}` : "/"} className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Voltar para profissionais</Link>
    <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <header className="flex gap-4"><ProfessionalAvatar name={profile.displayName} photo={profile.photo} className="size-20" onRefresh={refreshPhoto} /><div><p className="font-semibold text-blue-600">Perfil profissional</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{profile.displayName}</h1>{profile.professionalTitle ? <p className="mt-2 text-lg font-semibold text-slate-700">{profile.professionalTitle}</p> : null}</div></header>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Reputação</p><p className="mt-2 flex gap-2 font-bold"><Star className="size-5 fill-amber-400 text-amber-400" />{profile.reputation.reviewCount ? `${profile.reputation.averageRating.toFixed(1)} (${profile.reputation.reviewCount})` : "Ainda sem avaliações"}</p></div>{profile.serviceArea ? <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Área de atendimento</p><p className="mt-2 flex gap-2"><MapPin className="size-4" />{profile.serviceArea}</p></div> : null}</div>
      {profile.bio ? <section className="mt-7"><h2 className="text-xl font-bold">Sobre o profissional</h2><p className="mt-3 whitespace-pre-wrap leading-7">{profile.bio}</p></section> : null}
      <section className="mt-7"><h2 className="text-xl font-bold">Categorias atendidas</h2><ul className="mt-3 flex flex-wrap gap-2">{profile.categories.map((category) => <li key={category.id}><Link href={`/servicos/${encodeURIComponent(category.slug)}`} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{category.name}</Link></li>)}</ul></section>
      <Link href={directedServiceRequestDestination(profile.id) ?? "/solicitacoes/nova"} className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Pedir orçamento a {profile.displayName}</Link><p className="mt-3 text-sm text-slate-600">Este pedido será enviado somente a este profissional.</p>
    </article>
    <section className="mt-8" aria-labelledby="public-reviews"><h2 id="public-reviews" className="text-2xl font-bold tracking-tight text-slate-950">Avaliações</h2>{profile.reviews.items.length === 0 ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">Ainda sem avaliações</div> : <div className="mt-4 space-y-4">{profile.reviews.items.map((review, index) => <article key={`${review.publishedAt}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="flex items-center gap-2 font-semibold text-slate-950"><Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-400" />{review.rating} de 5</p>{review.comment ? <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{review.comment}</p> : <p className="mt-3 text-sm text-slate-500">Sem comentário.</p>}<p className="mt-4 text-sm text-slate-500">Publicada em {formatPublishedDate(review.publishedAt)}</p></article>)}</div>}<Pagination page={profile.reviews.pagination.page} totalPages={totalPages} onChange={changePage} /></section>
  </div></main>;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Paginação de avaliações" className="mt-6 flex items-center justify-between gap-4"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft aria-hidden="true" className="inline size-4" />Anterior</button><p className="text-sm text-slate-600">Página {page} de {totalPages}</p><button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Próxima<ChevronRight aria-hidden="true" className="inline size-4" /></button></nav>;
}

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value));
}
function Loading() { return <main className="min-h-full bg-slate-50"><div className="mx-auto flex min-h-72 max-w-4xl items-center justify-center px-4"><div role="status" className="flex items-center gap-3 text-slate-700"><Loader2 aria-hidden="true" className="size-5 animate-spin" />Carregando perfil...</div></div></main>; }
function NotFoundProfile() { return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><FileText aria-hidden="true" className="mx-auto size-10 text-slate-400" /><h1 className="mt-4 text-2xl font-bold text-slate-950">Perfil não encontrado</h1><p className="mt-3 leading-7 text-slate-600">Este perfil não está disponível para descoberta pública.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Ver categorias</Link></div></div></main>; }
function LoadError({ onRetry }: { onRetry: () => void }) { return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8"><div className="flex items-start gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" /><div><h1 className="text-xl font-bold text-red-950">Não foi possível carregar o perfil</h1><p className="mt-2 leading-7 text-red-900/80">A página pública está indisponível no momento. Tente novamente em instantes.</p><button type="button" onClick={onRetry} className="mt-5 font-semibold text-red-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700">Tentar novamente</button></div></div></div></div></main>; }
