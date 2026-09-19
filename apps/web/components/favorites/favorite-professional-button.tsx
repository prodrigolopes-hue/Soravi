"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

import { favoriteProfessionalUrl, favoritesUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type FavoriteItem = { id: string; professional: { id: string } };

function favoritesFromPayload(payload: unknown): FavoriteItem[] | null {
  const root = typeof payload === "object" && payload !== null && "data" in payload && typeof (payload as { data?: unknown }).data === "object"
    ? (payload as { data: unknown }).data
    : payload;
  if (!Array.isArray(root)) return null;
  return root.every((item) => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string" && typeof (item as { professional?: { id?: unknown } }).professional?.id === "string") ? root as FavoriteItem[] : null;
}

export function FavoriteProfessionalButton({ professionalProfileId }: { professionalProfileId: string }) {
  const { accessToken, isAuthenticated, user } = useAuth();
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !isCustomer) return;
    let active = true;
    void fetch(favoritesUrl, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, payload: await response.json().catch(() => null) }))
      .then(({ ok, payload }) => {
        if (!active || !ok) return;
        setFavoriteId(favoritesFromPayload(payload)?.find((item) => item.professional.id === professionalProfileId)?.id ?? null);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken, isAuthenticated, isCustomer, professionalProfileId]);

  if (!isCustomer) return null;

  async function toggle(): Promise<void> {
    if (!accessToken || isSaving) return;
    setIsSaving(true); setError(null);
    const removing = favoriteId !== null;
    try {
      const response = await fetch(favoriteProfessionalUrl(professionalProfileId), { method: removing ? "DELETE" : "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error();
      setFavoriteId(removing ? null : (typeof payload === "object" && payload !== null && "data" in payload ? (payload as { data?: { id?: unknown } }).data?.id : (payload as { id?: unknown })?.id) as string ?? null);
    } catch { setError("Não foi possível atualizar os favoritos."); }
    finally { setIsSaving(false); }
  }

  const isFavorite = favoriteId !== null;
  return <div>
    <button type="button" onClick={() => void toggle()} disabled={isLoading || isSaving} aria-pressed={isFavorite} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
      <Heart aria-hidden="true" className={`size-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
      {isSaving ? "Salvando..." : isFavorite ? "Remover dos favoritos" : "Favoritar"}
    </button>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
  </div>;
}
