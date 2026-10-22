"use client";

import { BriefcaseBusiness, ChevronLeft, ChevronRight, Loader2, MapPin, ShieldAlert, Star, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  categoriesUrl,
  categoryProfessionalsUrl,
  parsePublicCategories,
  parsePublicProfessionalsResponse,
  type PublicCategory,
  type PublicProfessionalsResponse,
} from "../../lib/professional-discovery";

const PAGE_SIZE = 20;

type LoadState = "loading" | "success" | "empty" | "not-found" | "error";

export function CategoryProfessionalsPage({ categorySlug }: { categorySlug: string }) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [category, setCategory] = useState<PublicCategory | null>(null);
  const [response, setResponse] = useState<PublicProfessionalsResponse | null>(null);

  useEffect(() => setPage(1), [categorySlug]);

  const load = useCallback(async (targetPage: number, signal: AbortSignal) => {
    setState("loading");
    try {
      const [categoriesResponse, professionalsResponse] = await Promise.all([
        fetch(categoriesUrl, { cache: "no-store", credentials: "omit", signal }),
        fetch(categoryProfessionalsUrl(categorySlug, targetPage, PAGE_SIZE), { cache: "no-store", credentials: "omit", signal }),
      ]);
      if (signal.aborted) return;
      if (professionalsResponse.status === 404) {
        setCategory(null); setResponse(null); setState("not-found"); return;
      }
      if (!categoriesResponse.ok || !professionalsResponse.ok) {
        setCategory(null); setResponse(null); setState("error"); return;
      }
      const [categoriesPayload, professionalsPayload] = await Promise.all([
        categoriesResponse.json().catch(() => null),
        professionalsResponse.json().catch(() => null),
      ]);
      if (signal.aborted) return;
      const categories = parsePublicCategories(categoriesPayload);
      const professionals = parsePublicProfessionalsResponse(professionalsPayload);
      const currentCategory = categories?.find((item) => item.slug === categorySlug) ?? null;
      if (!categories || !professionals) {
        setCategory(null); setResponse(null); setState("error"); return;
      }
      if (!currentCategory) {
        setCategory(null); setResponse(null); setState("not-found"); return;
      }
      setCategory(currentCategory);
      setResponse(professionals);
      setState(professionals.items.length === 0 ? "empty" : "success");
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setCategory(null); setResponse(null); setState("error");
    }
  }, [categorySlug]);

  useEffect(() => {
    const controller = new AbortController();
    void load(page, controller.signal);
    return () => controller.abort();
  }, [load, page, retry]);

  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const title = category ? `Profissionais de ${category.name}` : "Profissionais por categoria";

  return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Voltar para categorias</Link>
    <header className="mt-5"><p className="font-semibold text-blue-600">Descubra profissionais</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Conheça profissionais disponíveis e veja seus perfis públicos antes de descrever o que você precisa.</p></header>
    <section className="mt-8" aria-live="polite" aria-busy={state === "loading"}>
      {state === "loading" ? <Loading label="Carregando profissionais..." /> : null}
      {state === "not-found" ? <NotFoundCategory /> : null}
      {state === "error" ? <LoadError onRetry={() => setRetry((value) => value + 1)} /> : null}
      {state === "empty" && category ? <EmptyCategory categoryName={category.name} /> : null}
      {state === "success" && response ? <><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{response.items.map((professional) => <article key={professional.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold text-slate-950">{professional.displayName}</h2>{professional.professionalTitle ? <p className="mt-1 text-sm font-semibold text-blue-700">{professional.professionalTitle}</p> : null}{professional.serviceArea ? <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><MapPin aria-hidden="true" className="size-4 shrink-0" />{professional.serviceArea}</p> : null}<p className="mt-4 flex items-center gap-2 text-sm text-slate-700"><Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-400" />{professional.reputation.reviewCount > 0 ? `${professional.reputation.averageRating.toFixed(1)} · ${professional.reputation.reviewCount} ${professional.reputation.reviewCount === 1 ? "avaliação" : "avaliações"}` : "Ainda sem avaliações"}</p>{professional.categories.length > 0 ? <ul className="mt-4 flex flex-wrap gap-2" aria-label="Categorias"><>{professional.categories.map((item) => <li key={item.id}><Link href={`/servicos/${encodeURIComponent(item.slug)}`} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{item.name}</Link></li>)}</></ul> : null}<Link href={`/profissionais/${encodeURIComponent(professional.id)}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Ver perfil</Link></article>)}</div><Pagination page={response.pagination.page} totalPages={totalPages} onPageChange={setPage} /></> : null}
    </section>
  </div></main>;
}

function Loading({ label }: { label: string }) { return <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm"><Loader2 aria-hidden="true" className="mr-3 size-5 animate-spin" />{label}</div>; }
function LoadError({ onRetry }: { onRetry: () => void }) { return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8"><div className="flex items-start gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" /><div><h2 className="text-xl font-bold text-red-950">Não foi possível carregar os profissionais</h2><p className="mt-2 leading-7 text-red-900/80">A listagem pública está indisponível no momento. Tente novamente em instantes.</p><button type="button" onClick={onRetry} className="mt-5 font-semibold text-red-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700">Tentar novamente</button></div></div></div>; }
function NotFoundCategory() { return <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><UsersRound aria-hidden="true" className="mx-auto size-10 text-slate-400" /><h2 className="mt-4 text-2xl font-bold text-slate-950">Categoria não encontrada</h2><p className="mt-3 leading-7 text-slate-600">Esta categoria não está disponível para descoberta pública.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Ver categorias</Link></div>; }
function EmptyCategory({ categoryName }: { categoryName: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><BriefcaseBusiness aria-hidden="true" className="mx-auto size-10 text-blue-600" /><h2 className="mt-4 text-2xl font-bold text-slate-950">Ainda não há profissionais disponíveis</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">Não encontramos perfis públicos disponíveis em {categoryName} neste momento.</p><Link href="/solicitacoes/nova" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Descrever o que preciso</Link></div>; }
function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) { if (totalPages <= 1) return null; return <nav aria-label="Paginação de profissionais" className="mt-8 flex items-center justify-between gap-4"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft aria-hidden="true" className="size-4" />Anterior</button><p className="text-sm text-slate-600">Página {page} de {totalPages}</p><button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Próxima<ChevronRight aria-hidden="true" className="size-4" /></button></nav>; }
