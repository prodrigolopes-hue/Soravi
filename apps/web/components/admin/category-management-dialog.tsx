"use client";

import { useEffect, useState } from "react";
import { adminCategoriesUrl } from "../../lib/api";

export type CategoryManagementItem = { id: string; name: string; slug: string; isActive: boolean; isFeatured: boolean | null; displayOrder: number; createdAt: string; updatedAt: string };
type Mode = "edit" | "split";
type Preview = { serviceRequests: number; historicalRequests: number; professionals: Array<{ id: string; displayName: string; user: { email: string } }> };

export function CategoryManagementButtons({ item, onOpen }: { item: CategoryManagementItem; onOpen: (value: { item: CategoryManagementItem; mode: Mode }) => void }) {
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onOpen({ item, mode: "edit" })} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800">Editar nome</button><button type="button" disabled={!item.isActive} onClick={() => onOpen({ item, mode: "split" })} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Separar</button></div>;
}

export function CategoryFeaturedToggle({ item, accessToken, onSaved }: { item: CategoryManagementItem; accessToken: string; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (item.isFeatured === null) return <p className="text-xs text-slate-600">Controle da página inicial indisponível.</p>;
  async function toggle() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`${adminCategoriesUrl}/${encodeURIComponent(item.id)}/featured`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isFeatured: !item.isFeatured }) });
      if (!response.ok) { const body: unknown = await response.json().catch(() => null); throw new Error(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "Não foi possível alterar o destaque."); }
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível alterar o destaque."); } finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy || (!item.isActive && !item.isFeatured)} onClick={() => void toggle()} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">{busy ? "Salvando..." : item.isFeatured ? "Retirar da página inicial" : "Mostrar na página inicial"}</button>{error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}</div>;
}

export function CategoryManagementDialog({ item, mode, accessToken, onClose, onSaved }: { item: CategoryManagementItem; mode: Mode; accessToken: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(item.name);
  const [newName, setNewName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === "split");
  useEffect(() => {
    if (mode !== "split") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${adminCategoriesUrl}/${encodeURIComponent(item.id)}/split-preview`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Não foi possível consultar os vínculos da categoria.");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("professionals" in data) || !Array.isArray(data.professionals) || !("serviceRequests" in data) || typeof data.serviceRequests !== "number" || !("historicalRequests" in data) || typeof data.historicalRequests !== "number" || !data.professionals.every((p: unknown) => p && typeof p === "object" && "id" in p && typeof p.id === "string" && "displayName" in p && typeof p.displayName === "string" && "user" in p && !!p.user && typeof p.user === "object" && "email" in p.user && typeof p.user.email === "string")) throw new Error("Resposta inválida. Tente novamente.");
        setPreview(data as Preview);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Erro ao consultar os vínculos."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [mode, item.id, accessToken]);

  async function save() {
    if (!name.trim() || (mode === "split" && !newName.trim())) { setError("Preencha os nomes das categorias."); return; }
    setBusy(true); setError(null);
    try {
      const url = `${adminCategoriesUrl}/${encodeURIComponent(item.id)}${mode === "split" ? "/split" : ""}`;
      const response = await fetch(url, { method: mode === "split" ? "POST" : "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(mode === "split" ? { expectedName: item.name, originalName: name.trim(), newName: newName.trim(), professionalProfileIds: selected } : { expectedName: item.name, name: name.trim() }) });
      if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string } | null; throw new Error(typeof body?.message === "string" ? body.message : "Não foi possível salvar a alteração."); }
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar a alteração."); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="manage-category-title"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><h3 id="manage-category-title" className="text-xl font-bold">{mode === "edit" ? "Editar categoria" : "Separar categoria"}</h3><p className="mt-2 text-sm text-slate-600">O endereço atual ({item.slug}) e os vínculos existentes serão preservados.</p><label className="mt-5 block text-sm font-semibold">{mode === "split" ? "Nome da categoria original" : "Nome da categoria"}<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>{mode === "split" ? <><label className="mt-4 block text-sm font-semibold">Nome da nova categoria<input maxLength={120} value={newName} onChange={(event) => setNewName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>{loading ? <p className="mt-4">Consultando vínculos…</p> : null}{preview ? <><p className="mt-4 text-sm text-slate-700">{preview.serviceRequests} solicitações de serviço e {preview.historicalRequests} sugestões com esta categoria como resolução principal continuarão na categoria original. Selecione quem também deve receber a nova categoria:</p><ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">{preview.professionals.map((professional) => <li key={professional.id}><label className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(professional.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, professional.id] : current.filter((id) => id !== professional.id))} />{professional.displayName} <span className="text-sm text-slate-600">({professional.user.email})</span></label></li>)}</ul>{preview.professionals.length === 0 ? <p className="mt-2 text-sm text-slate-600">Nenhum profissional vinculado.</p> : null}</> : null}</> : null}{error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border px-4 py-2">Cancelar</button><button type="button" onClick={() => void save()} disabled={busy || loading || (mode === "split" && !preview)} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Salvando…" : "Confirmar"}</button></div></div></div>;
}
