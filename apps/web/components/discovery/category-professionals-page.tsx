"use client";

import { BriefcaseBusiness, ChevronLeft, ChevronRight, Loader2, MapPin, ShieldAlert, Star, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { categoriesUrl, categoryProfessionalsUrl, parsePublicCategories, parsePublicProfessionalsResponse, type PublicCategory, type PublicProfessionalsResponse } from "../../lib/professional-discovery";
import { ProfessionalAvatar } from "../professional/professional-avatar";

const PAGE_SIZE = 20;
type State = "loading" | "success" | "empty" | "not-found" | "error";

export function CategoryProfessionalsPage({ categorySlug }: { categorySlug: string }) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>("loading");
  const [category, setCategory] = useState<PublicCategory | null>(null);
  const [response, setResponse] = useState<PublicProfessionalsResponse | null>(null);
  const photoRefreshRequestedRef = useRef(false);
  const responseRef = useRef<PublicProfessionalsResponse | null>(null);

  useEffect(() => {
    responseRef.current = null;
    photoRefreshRequestedRef.current = false;
    setCategory(null); setResponse(null); setPage(1); setState("loading");
  }, [categorySlug]);
  useEffect(() => { responseRef.current = response; }, [response]);

  const load = useCallback(async (currentPage: number, signal: AbortSignal) => {
    if (!responseRef.current) setState("loading");
    try {
      const [categoriesResponse, professionalsResponse] = await Promise.all([
        fetch(categoriesUrl, { cache: "no-store", credentials: "omit", signal }),
        fetch(categoryProfessionalsUrl(categorySlug, currentPage, PAGE_SIZE), { cache: "no-store", credentials: "omit", signal }),
      ]);
      if (signal.aborted) return;
      if (professionalsResponse.status === 404) { setState("not-found"); return; }
      const categories = categoriesResponse.ok ? parsePublicCategories(await categoriesResponse.json().catch(() => null)) : null;
      const professionals = professionalsResponse.ok ? parsePublicProfessionalsResponse(await professionalsResponse.json().catch(() => null)) : null;
      if (signal.aborted) return;
      const foundCategory = categories?.find((item) => item.slug === categorySlug) ?? null;
      if (!categories || !professionals) { setState("error"); return; }
      if (!foundCategory) { setState("not-found"); return; }
      setCategory(foundCategory);
      responseRef.current = professionals; setResponse(professionals);
      setState(professionals.items.length ? "success" : "empty");
    } catch (error) {
      if (!signal.aborted && !(error instanceof DOMException && error.name === "AbortError") && !responseRef.current) setState("error");
    }
  }, [categorySlug]);

  useEffect(() => { const controller = new AbortController(); void load(page, controller.signal); return () => controller.abort(); }, [load, page, retry]);
  const refreshPhotos = useCallback((reason: "expired" | "error") => {
    if (reason === "error") {
      if (photoRefreshRequestedRef.current) return;
      photoRefreshRequestedRef.current = true;
    }
    setRetry((value) => value + 1);
  }, []);
  const changePage = useCallback((nextPage: number) => {
    responseRef.current = null;
    photoRefreshRequestedRef.current = false;
    setResponse(null); setCategory(null); setPage(nextPage);
  }, []);

  if (state === "loading") return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><Loading label="Carregando profissionais..." /></div></main>;
  if (state === "error") return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><LoadError onRetry={() => setRetry((value) => value + 1)} /></div></main>;
  if (state === "not-found") return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><NotFoundCategory /></div></main>;

  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const title = category ? `Profissionais de ${category.name}` : "Profissionais por categoria";
  return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Voltar para categorias</Link>
    <header className="mt-5"><p className="font-semibold text-blue-600">Descubra profissionais</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Conheça profissionais disponíveis e veja seus perfis públicos antes de descrever o que você precisa.</p></header>
    <section className="mt-8" aria-live="polite">
    {state === "empty" && category ? <EmptyCategory categoryName={category.name} /> : null}
    {state === "success" && response && category?.slug === categorySlug ? <><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{response.items.map((professional) => <article key={professional.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><ProfessionalAvatar name={professional.displayName} photo={professional.photo} onRefresh={refreshPhotos} /><div><h2 className="text-xl font-bold text-slate-950">{professional.displayName}</h2>{professional.professionalTitle ? <p className="text-sm font-semibold text-blue-700">{professional.professionalTitle}</p> : null}</div></div>{professional.serviceArea ? <p className="mt-4 flex gap-2 text-sm text-slate-600"><MapPin className="size-4" />{professional.serviceArea}</p> : null}<p className="mt-4 flex gap-2 text-sm text-slate-700"><Star className="size-4 fill-amber-400 text-amber-400" />{professional.reputation.reviewCount ? `${professional.reputation.averageRating.toFixed(1)} · ${professional.reputation.reviewCount} avaliações` : "Ainda sem avaliações"}</p>{professional.categories.length ? <ul className="mt-4 flex flex-wrap gap-2">{professional.categories.map((item) => <li key={item.id}><Link href={`/servicos/${encodeURIComponent(item.slug)}`} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{item.name}</Link></li>)}</ul> : null}<Link href={`/profissionais/${encodeURIComponent(professional.id)}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">Ver perfil</Link></article>)}</div><Pagination page={response.pagination.page} totalPages={totalPages} onChange={changePage} /></> : null}
    </section></div></main>;
}

function Loading({ label }: { label: string }) { return <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm"><Loader2 aria-hidden="true" className="mr-3 size-5 animate-spin" />{label}</div>; }
function LoadError({ onRetry }: { onRetry: () => void }) { return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8"><div className="flex items-start gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" /><div><h2 className="text-xl font-bold text-red-950">Não foi possível carregar os profissionais</h2><p className="mt-2 leading-7 text-red-900/80">A listagem pública está indisponível no momento. Tente novamente em instantes.</p><button type="button" onClick={onRetry} className="mt-5 font-semibold text-red-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700">Tentar novamente</button></div></div></div>; }
function NotFoundCategory() { return <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><UsersRound aria-hidden="true" className="mx-auto size-10 text-slate-400" /><h2 className="mt-4 text-2xl font-bold text-slate-950">Categoria não encontrada</h2><p className="mt-3 leading-7 text-slate-600">Esta categoria não está disponível para descoberta pública.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Ver categorias</Link></div>; }
function EmptyCategory({ categoryName }: { categoryName: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><BriefcaseBusiness aria-hidden="true" className="mx-auto size-10 text-blue-600" /><h2 className="mt-4 text-2xl font-bold text-slate-950">Ainda não há profissionais disponíveis</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">Não encontramos perfis públicos disponíveis em {categoryName} neste momento.</p><Link href="/solicitacoes/nova" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Descrever o que preciso</Link></div>; }
function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) { if (totalPages <= 1) return null; return <nav aria-label="Paginação de profissionais" className="mt-8 flex items-center justify-between gap-4"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft aria-hidden="true" className="size-4" />Anterior</button><p className="text-sm text-slate-600">Página {page} de {totalPages}</p><button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Próxima<ChevronRight aria-hidden="true" className="size-4" /></button></nav>; }
