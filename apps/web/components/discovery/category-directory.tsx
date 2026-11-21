"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { categoriesUrl, parsePublicCategories, type PublicCategory } from "../../lib/professional-discovery";
import { filterCategoryDirectory } from "./category-directory-filter";

export function CategoryDirectory() {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "za">("az");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => { try { const response = await fetch(categoriesUrl, { cache: "no-store", signal: controller.signal }); const parsed = response.ok ? parsePublicCategories(await response.json()) : null; if (!parsed) throw new Error(); setCategories(parsed); setState("ready"); } catch { if (!controller.signal.aborted) setState("error"); } })();
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => filterCategoryDirectory(categories, query, sort), [categories, query, sort]);
  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <Link href="/" className="text-sm font-semibold text-blue-700">← Voltar para a página inicial</Link>
    <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Todas as categorias</h1>
    <p className="mt-3 text-slate-600">Encontre o serviço que você precisa e conheça os profissionais disponíveis.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto]"><label className="text-sm font-semibold text-slate-800">Pesquisar categoria<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: eletricista" className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-normal" /></label><label className="text-sm font-semibold text-slate-800">Ordenar<select value={sort} onChange={(event) => setSort(event.target.value === "za" ? "za" : "az")} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-normal"><option value="az">A a Z</option><option value="za">Z a A</option></select></label></div>
    {state === "loading" ? <p role="status" className="mt-8 text-slate-600">Carregando categorias...</p> : state === "error" ? <p role="alert" className="mt-8 text-red-700">Não foi possível carregar as categorias. Atualize a página para tentar novamente.</p> : <><p aria-live="polite" className="mt-8 text-sm text-slate-600">{filtered.length} {filtered.length === 1 ? "categoria encontrada" : "categorias encontradas"}</p>{filtered.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <li key={item.id}><Link href={`/servicos/${encodeURIComponent(item.slug)}`} className="block rounded-2xl border border-slate-200 bg-white p-5 font-semibold text-slate-950 hover:border-blue-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{item.name} <span aria-hidden="true">→</span></Link></li>)}</ul> : <p className="mt-4 text-slate-600">Nenhuma categoria encontrada. Tente outro nome.</p>}</>}
  </div></main>;
}
