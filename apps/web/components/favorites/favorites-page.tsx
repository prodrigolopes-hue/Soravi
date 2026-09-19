"use client";

import { Heart, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { favoriteProfessionalUrl, favoritesUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type Favorite = { id: string; professional: { id: string; displayName: string; averageRating: number; reviewCount: number; categories: string[] } };
type LoadState = "loading" | "success" | "error";

function parseFavorites(payload: unknown): Favorite[] | null {
  const root = typeof payload === "object" && payload !== null && "data" in payload ? (payload as { data: unknown }).data : payload;
  if (!Array.isArray(root)) return null;
  return root.every((item) => typeof item === "object" && item !== null && typeof (item as Favorite).id === "string" && typeof (item as Favorite).professional?.id === "string" && typeof (item as Favorite).professional.displayName === "string" && typeof (item as Favorite).professional.averageRating === "number" && typeof (item as Favorite).professional.reviewCount === "number" && Array.isArray((item as Favorite).professional.categories)) ? root as Favorite[] : null;
}

export function FavoritesPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [items, setItems] = useState<Favorite[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));
  const load = useCallback(async () => {
    if (!accessToken) return;
    setState("loading");
    try {
      const response = await fetch(favoritesUrl, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" });
      const parsed = parseFavorites(await response.json().catch(() => null));
      if (!response.ok || !parsed) throw new Error();
      setItems(parsed); setState("success");
    } catch { setState("error"); }
  }, [accessToken]);
  useEffect(() => { if (isAuthenticated && isCustomer) void load(); }, [isAuthenticated, isCustomer, load]);
  async function remove(item: Favorite): Promise<void> {
    if (!accessToken) return;
    setRemovingId(item.id);
    try { const response = await fetch(favoriteProfessionalUrl(item.professional.id), { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" }); if (!response.ok) throw new Error(); setItems((current) => current.filter((favorite) => favorite.id !== item.id)); } finally { setRemovingId(null); }
  }
  if (isLoading || (isAuthenticated && isCustomer && state === "loading")) return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><p role="status" className="text-slate-600">Carregando favoritos...</p></main>;
  if (!isAuthenticated || !isCustomer) return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><h1 className="text-3xl font-bold text-slate-950">Favoritos</h1><p className="mt-3 text-slate-600">Esta página está disponível para clientes autenticados.</p></main>;
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><h1 className="text-3xl font-bold tracking-tight text-slate-950">Favoritos</h1><p className="mt-2 text-slate-600">Profissionais que você salvou para consultar depois.</p>{state === "error" ? <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><p>Não foi possível carregar seus favoritos.</p><button type="button" onClick={() => void load()} className="mt-3 font-semibold underline">Tentar novamente</button></div> : null}{state === "success" && items.length === 0 ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600"><Heart aria-hidden="true" className="size-6 text-slate-400" /><p className="mt-3 font-medium text-slate-900">Você ainda não tem profissionais favoritos.</p><p className="mt-1 text-sm">Use o botão Favoritar nas propostas recebidas.</p></div> : null}{state === "success" && items.length > 0 ? <ul className="mt-6 grid gap-4 sm:grid-cols-2">{items.map((item) => <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-950">{item.professional.displayName}</h2><p className="mt-2 flex items-center gap-1 text-sm text-slate-700"><Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-400" />{item.professional.averageRating.toFixed(1)} · {item.professional.reviewCount} {item.professional.reviewCount === 1 ? "avaliação" : "avaliações"}</p>{item.professional.categories.length > 0 ? <p className="mt-3 text-sm text-slate-600">{item.professional.categories.join(" · ")}</p> : null}<button type="button" disabled={removingId === item.id} onClick={() => void remove(item)} className="mt-5 inline-flex min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">{removingId === item.id ? "Removendo..." : "Remover dos favoritos"}</button></li>)}</ul> : null}</main>;
}
