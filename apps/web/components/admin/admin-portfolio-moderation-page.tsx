"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type Photo = {
  id: string;
  caption: string | null;
  createdAt: string;
  moderationVersion: number;
};

type Group = {
  id: string;
  displayName: string;
  portfolioItems: Photo[];
};

type Queue = {
  items: Group[];
  pagination: {
    page: number;
    limit: number;
    totalProfessionals: number;
    totalPendingPhotos: number;
    totalPages: number;
  };
};

type History = {
  result: string;
  reasonCode: string | null;
  contentVersion: number;
  createdAt: string;
  operator: { name: string };
};

const base = apiBaseUrl.replace(/\/+$/u, "");
const reasons = [
  "INAPPROPRIATE_CONTENT",
  "PERSONAL_DATA_EXPOSED",
  "NOT_A_WORK_PHOTO",
  "LOW_QUALITY",
];

export function AdminPortfolioModerationPage() {
  const { accessToken, user, isLoading } = useAuth();
  const admin = Boolean(user?.roles.includes("ADMIN"));
  const [queue, setQueue] = useState<Queue | null>(null);
  const [page, setPage] = useState(1);
  const [urls, setUrls] = useState<Record<string, string | null | undefined>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ group: Group; index: number } | null>(null);
  const [history, setHistory] = useState<{ id: string; items: History[] } | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reason, setReason] = useState(reasons[0]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const generation = useRef(0);

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  const load = useCallback(async () => {
    if (!accessToken) return;

    generation.current += 1;

    const response = await fetch(
      `${base}/api/v1/users/admin/professional-portfolios/grouped?page=${page}&limit=5`,
      { headers: headers(), credentials: "include", cache: "no-store" },
    );
    const body: unknown = await response.json();

    if (
      !response.ok ||
      typeof body !== "object" ||
      body === null ||
      !("items" in body) ||
      !Array.isArray(body.items) ||
      !("pagination" in body)
    ) {
      throw new Error();
    }

    const nextQueue = body as Queue;
    if (
      nextQueue.items.length === 0 &&
      nextQueue.pagination.page > 1 &&
      nextQueue.pagination.totalPages < nextQueue.pagination.page
    ) {
      setPage(nextQueue.pagination.totalPages);
      return;
    }

    setQueue(nextQueue);
    setSelected(new Set());
    setUrls({});
  }, [accessToken, headers, page]);

  useEffect(() => {
    if (!admin) return;

    void load().catch(() => setMessage("Não foi possível carregar a fila."));
  }, [admin, load]);

  useEffect(() => {
    if (!queue || !accessToken) return;

    const current = ++generation.current;
    const photos = queue.items.flatMap((group) => group.portfolioItems);
    let next = 0;

    const worker = async () => {
      while (next < photos.length) {
        const photo = photos[next++];

        try {
          const response = await fetch(
            `${base}/api/v1/users/admin/professional-portfolios/${photo.id}/evidence`,
            { headers: headers(), credentials: "include", cache: "no-store" },
          );
          const body: unknown = await response.json();
          const url =
            response.ok &&
            typeof body === "object" &&
            body !== null &&
            "url" in body &&
            typeof body.url === "string"
              ? body.url
              : null;

          if (generation.current === current) {
            setUrls((old) => ({ ...old, [photo.id]: url }));
          }
        } catch {
          if (generation.current === current) {
            setUrls((old) => ({ ...old, [photo.id]: null }));
          }
        }
      }
    };

    void Promise.all(Array.from({ length: Math.min(3, photos.length) }, worker));

    return () => {
      generation.current += 1;
    };
  }, [accessToken, headers, queue]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };

    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const toggle = (id: string) => {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const markPreviewUnavailable = useCallback((id: string) => {
    setUrls((old) => ({ ...old, [id]: null }));
    setSelected((old) => {
      const next = new Set(old);
      next.delete(id);
      return next;
    });
  }, []);

  const retry = async (photo: Photo) => {
    setUrls((old) => ({ ...old, [photo.id]: undefined }));

    try {
      const response = await fetch(
        `${base}/api/v1/users/admin/professional-portfolios/${photo.id}/evidence`,
        { headers: headers(), credentials: "include", cache: "no-store" },
      );
      const body: unknown = await response.json();
      const url =
        response.ok &&
        typeof body === "object" &&
        body !== null &&
        "url" in body &&
        typeof body.url === "string"
          ? body.url
          : null;

      setUrls((old) => ({ ...old, [photo.id]: url }));
    } catch {
      markPreviewUnavailable(photo.id);
    }
  };

  const decide = async () => {
    if (!queue || !selected.size || saving) return;

    setSaving(true);
    setMessage(null);

    const photos = queue.items
      .flatMap((group) => group.portfolioItems)
      .filter((photo) => selected.has(photo.id));
    const successes: string[] = [];
    const failures: string[] = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < photos.length) {
        const photo = photos[cursor++];

        try {
          const response = await fetch(
            `${base}/api/v1/users/admin/professional-portfolios/${photo.id}/decision`,
            {
              method: "POST",
              headers: { ...headers(), "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                result: decision,
                reasonCode: decision === "REJECTED" ? reason : undefined,
                version: photo.moderationVersion,
              }),
            },
          );

          if (response.ok) {
            successes.push(photo.id);
          } else {
            failures.push(photo.id);
          }
        } catch {
          failures.push(photo.id);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(3, photos.length) }, worker));

    setConfirming(false);
    setSaving(false);
    setMessage(
      `${successes.length} decisão(ões) registrada(s).${
        failures.length
          ? ` ${failures.length} foto(s) precisam de nova análise.`
          : ""
      }`,
    );
    await load();
    setSelected(new Set(failures));
  };

  const openHistory = async (id: string) => {
    const response = await fetch(
      `${base}/api/v1/users/admin/professional-portfolios/${id}/history`,
      { headers: headers(), credentials: "include", cache: "no-store" },
    );
    const body: unknown = await response.json();

    if (response.ok && Array.isArray(body)) {
      setHistory({ id, items: body as History[] });
    }
  };

  if (isLoading) return <p>Carregando…</p>;
  if (!admin) return <p>Acesso restrito à administração.</p>;

  if (!queue) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p>{message ?? "Carregando fila…"}</p>
        {message ? (
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-blue-700 underline"
            onClick={() =>
              void load().catch(() =>
                setMessage("Não foi possível carregar a fila."),
              )
            }
          >
            Tentar novamente
          </button>
        ) : null}
      </main>
    );
  }

  const previewPhoto = preview?.group.portfolioItems[preview.index];
  const previewUrl = previewPhoto ? urls[previewPhoto.id] : undefined;
  const selectedCount = selected.size;

  return (
    <main className="mx-auto max-w-7xl p-6">
      <Link
        href="/admin"
        className="text-sm font-semibold text-blue-700 underline"
      >
        Voltar ao painel
      </Link>

      <h1 className="mt-4 text-3xl font-bold">Moderação do portfólio</h1>
      <p className="mt-2 text-slate-600">
        {queue.pagination.totalProfessionals} profissionais ·{" "}
        {queue.pagination.totalPendingPhotos} fotos pendentes
      </p>

      {message ? (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      {queue.items.length === 0 ? (
        <section className="mt-6 rounded-2xl border bg-white p-8 text-slate-600">
          Não há fotos pendentes nesta página.
        </section>
      ) : (
        <div className="mt-6 space-y-5">
          {queue.items.map((group) => {
            const selectable = group.portfolioItems.filter(
              (photo) => typeof urls[photo.id] === "string",
            );
            const allSelected =
              selectable.length > 0 &&
              selectable.every((photo) => selected.has(photo.id));

            return (
              <section
                key={group.id}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{group.displayName}</h2>
                    <p className="text-sm text-slate-600">
                      {group.portfolioItems.length} pendente(s) · mais antiga em{" "}
                      {new Date(
                        group.portfolioItems[0].createdAt,
                      ).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <label className="text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={!selectable.length || saving}
                      onChange={() => {
                        setSelected((old) => {
                          const next = new Set(old);
                          for (const photo of selectable) {
                            if (allSelected) {
                              next.delete(photo.id);
                            } else {
                              next.add(photo.id);
                            }
                          }
                          return next;
                        });
                      }}
                    />{" "}
                    Selecionar todas
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.portfolioItems.map((photo, index) => {
                    const photoUrl = urls[photo.id];

                    return (
                      <article
                        key={photo.id}
                        className="overflow-hidden rounded-xl border"
                      >
                        <button
                          type="button"
                          disabled={typeof photoUrl !== "string"}
                          onClick={() => setPreview({ group, index })}
                          className="block w-full disabled:cursor-default"
                        >
                          {typeof photoUrl === "string" ? (
                            <img
                              src={photoUrl}
                              alt={photo.caption ?? "Foto do trabalho"}
                              className="aspect-square w-full object-cover"
                              onError={() => markPreviewUnavailable(photo.id)}
                            />
                          ) : photoUrl === null ? (
                            <span className="flex aspect-square items-center justify-center bg-slate-100 p-2 text-xs">
                              Prévia indisponível
                            </span>
                          ) : (
                            <span className="flex aspect-square items-center justify-center bg-slate-100 text-xs">
                              Carregando…
                            </span>
                          )}
                        </button>

                        <div className="p-3">
                          <p className="min-h-5 text-sm">
                            {photo.caption ?? "Sem legenda"}
                          </p>
                          {photoUrl === null ? (
                            <button
                              type="button"
                              onClick={() => void retry(photo)}
                              className="mt-2 text-xs underline"
                            >
                              Tentar novamente
                            </button>
                          ) : null}
                          <label className="mt-2 block text-xs">
                            <input
                              type="checkbox"
                              checked={selected.has(photo.id)}
                              disabled={
                                saving || typeof photoUrl !== "string"
                              }
                              onChange={() => toggle(photo.id)}
                            />{" "}
                            Selecionar
                          </label>
                          <button
                            type="button"
                            onClick={() => void openHistory(photo.id)}
                            className="mt-2 text-xs underline"
                          >
                            Histórico
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <nav className="mt-6 flex justify-between">
        <button
          type="button"
          disabled={page <= 1 || saving}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </button>
        <span>
          Página {queue.pagination.page} de{" "}
          {Math.max(1, queue.pagination.totalPages)}
        </span>
        <button
          type="button"
          disabled={page >= queue.pagination.totalPages || saving}
          onClick={() => setPage((value) => value + 1)}
        >
          Próxima
        </button>
      </nav>

      {selectedCount ? (
        <section className="sticky bottom-4 mt-6 rounded-2xl border bg-white p-4 shadow-lg">
          <p>{selectedCount} foto(s) selecionada(s)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDecision("APPROVED");
                setConfirming(true);
              }}
            >
              Aprovar selecionadas
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDecision("REJECTED");
                setConfirming(true);
              }}
            >
              Rejeitar selecionadas
            </button>
          </div>
        </section>
      ) : null}

      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
        >
          <section className="w-full max-w-md rounded-2xl bg-white p-5">
            <h2 className="text-xl font-bold">Confirmar decisão</h2>
            <p className="mt-2">
              {decision === "APPROVED" ? "Aprovar" : "Rejeitar"}{" "}
              {selectedCount} foto(s)?
            </p>
            {decision === "REJECTED" ? (
              <select
                className="mt-3 w-full border p-2"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {reasons.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            ) : null}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void decide()}
              >
                {saving ? "Registrando…" : "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {previewPhoto && typeof previewUrl === "string" ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4"
        >
          <section className="max-w-4xl">
            <img
              src={previewUrl}
              alt={previewPhoto.caption ?? "Foto do trabalho"}
              className="max-h-[75vh] max-w-full rounded-xl"
              onError={() => markPreviewUnavailable(previewPhoto.id)}
            />
            <p className="mt-2 rounded bg-white p-3">
              {previewPhoto.caption ?? "Sem legenda"}
            </p>
            <div className="mt-3 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  setPreview((value) => {
                    if (!value) return value;
                    return {
                      ...value,
                      index: Math.max(0, value.index - 1),
                    };
                  });
                }}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview((value) => {
                    if (!value) return value;
                    return {
                      ...value,
                      index: Math.min(
                        value.group.portfolioItems.length - 1,
                        value.index + 1,
                      ),
                    };
                  });
                }}
              >
                Próxima
              </button>
              <button type="button" onClick={() => setPreview(null)}>
                Fechar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {history ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
        >
          <section className="max-w-lg rounded-2xl bg-white p-5">
            <h2 className="font-bold">Histórico</h2>
            {history.items.map((entry, index) => (
              <p key={index} className="mt-2 text-sm">
                {entry.result} · {entry.reasonCode ?? "sem motivo"} · v
                {entry.contentVersion} · {entry.operator.name} ·{" "}
                {new Date(entry.createdAt).toLocaleString("pt-BR")}
              </p>
            ))}
            <button
              type="button"
              className="mt-4"
              onClick={() => setHistory(null)}
            >
              Fechar
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}