"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  adminCategoriesUrl,
  adminCategorySuggestionByIdUrl,
  adminCategoryRequestsUrl,
  adminCategoryRequestByIdUrl,
  adminCategorySuggestionsUrl,
} from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import { CategoryFeaturedToggle, CategoryManagementButtons, CategoryManagementDialog } from "./category-management-dialog";
import { AdminBackLink } from "./admin-back-link";

const PAGE_SIZE = 20;

type RequestState =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden";

type ApiRoot = Record<string, unknown>;

interface AdminCategoriesPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AdminCategoryItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isFeatured: boolean | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminCategoriesApiResponse {
  items: AdminCategoryItem[];
  pagination: AdminCategoriesPagination;
}

interface AdminCategoryRequestProfessionalUser {
  id: string;
  name: string;
  email: string;
}

interface AdminCategoryRequestProfessionalProfile {
  id: string;
  displayName: string;
  user: AdminCategoryRequestProfessionalUser;
}

interface AdminCategoryRequestResolvedCategory {
  id: string;
  name: string;
  slug: string;
}

interface AdminCategoryRequestItem {
  id: string;
  suggestedName: string;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  professionalProfile: AdminCategoryRequestProfessionalProfile;
  resolvedCategory: AdminCategoryRequestResolvedCategory | null;
}

interface AdminCategoryRequestsApiResponse {
  items: AdminCategoryRequestItem[];
  pagination: AdminCategoriesPagination;
}

interface AdminPublicCategorySuggestionItem {
  id: string;
  suggestedName: string;
  description: string | null;
  status: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
}

interface AdminPublicCategorySuggestionsApiResponse {
  items: AdminPublicCategorySuggestionItem[];
  pagination: AdminCategoriesPagination;
}

function isRecord(value: unknown): value is ApiRoot {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function parsePagination(value: unknown): AdminCategoriesPagination | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as Partial<AdminCategoriesPagination>;

  if (
    !isPositiveInteger(candidate.page) ||
    !isPositiveInteger(candidate.pageSize) ||
    !isNonNegativeInteger(candidate.total) ||
    !isNonNegativeInteger(candidate.totalPages)
  ) {
    return null;
  }

  return {
    page: candidate.page,
    pageSize: candidate.pageSize,
    total: candidate.total,
    totalPages: candidate.totalPages,
  };
}

function parseCategoriesRoot(payload: unknown): AdminCategoriesApiResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items)) {
    return null;
  }

  const items: AdminCategoryItem[] = [];

  for (const item of root.items) {
    if (!isRecord(item)) {
      return null;
    }

    const candidate = item as Partial<AdminCategoryItem>;

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.slug !== "string" ||
      typeof candidate.isActive !== "boolean" ||
      typeof candidate.displayOrder !== "number" ||
      !Number.isInteger(candidate.displayOrder) ||
      typeof candidate.createdAt !== "string" ||
      typeof candidate.updatedAt !== "string"
    ) {
      return null;
    }

    items.push({
      id: candidate.id,
      name: candidate.name,
      slug: candidate.slug,
      isActive: candidate.isActive,
      isFeatured: typeof candidate.isFeatured === "boolean" ? candidate.isFeatured : null,
      displayOrder: candidate.displayOrder,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    });
  }

  const pagination = parsePagination(root.pagination);

  if (!pagination) {
    return null;
  }

  return {
    items,
    pagination,
  };
}

function parseCategoryRequestsRoot(payload: unknown): AdminCategoryRequestsApiResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items)) {
    return null;
  }

  const items: AdminCategoryRequestItem[] = [];

  for (const item of root.items) {
    if (!isRecord(item)) {
      return null;
    }

    const candidate = item as Partial<AdminCategoryRequestItem>;
    const professionalProfile = candidate.professionalProfile;
    const resolvedCategory = candidate.resolvedCategory;

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.suggestedName !== "string" ||
      typeof candidate.status !== "string" ||
      !isNullableString(candidate.reviewNotes) ||
      typeof candidate.createdAt !== "string" ||
      !isNullableString(candidate.reviewedAt) ||
      !isRecord(professionalProfile) ||
      !isRecord(professionalProfile.user)
    ) {
      return null;
    }

    const profileCandidate = professionalProfile as Partial<AdminCategoryRequestProfessionalProfile>;
    const profileUserCandidate = professionalProfile.user as Partial<AdminCategoryRequestProfessionalUser>;

    if (
      typeof profileCandidate.id !== "string" ||
      typeof profileCandidate.displayName !== "string" ||
      typeof profileUserCandidate.id !== "string" ||
      typeof profileUserCandidate.name !== "string" ||
      typeof profileUserCandidate.email !== "string"
    ) {
      return null;
    }

    let parsedResolvedCategory: AdminCategoryRequestResolvedCategory | null = null;

    if (resolvedCategory !== null && resolvedCategory !== undefined) {
      if (!isRecord(resolvedCategory)) {
        return null;
      }

      const resolvedCandidate = resolvedCategory as Partial<AdminCategoryRequestResolvedCategory>;

      if (
        typeof resolvedCandidate.id !== "string" ||
        typeof resolvedCandidate.name !== "string" ||
        typeof resolvedCandidate.slug !== "string"
      ) {
        return null;
      }

      parsedResolvedCategory = {
        id: resolvedCandidate.id,
        name: resolvedCandidate.name,
        slug: resolvedCandidate.slug,
      };
    }

    items.push({
      id: candidate.id,
      suggestedName: candidate.suggestedName,
      status: candidate.status,
      reviewNotes: candidate.reviewNotes,
      createdAt: candidate.createdAt,
      reviewedAt: candidate.reviewedAt,
      professionalProfile: {
        id: profileCandidate.id,
        displayName: profileCandidate.displayName,
        user: {
          id: profileUserCandidate.id,
          name: profileUserCandidate.name,
          email: profileUserCandidate.email,
        },
      },
      resolvedCategory: parsedResolvedCategory,
    });
  }

  const pagination = parsePagination(root.pagination);

  if (!pagination) {
    return null;
  }

  return {
    items,
    pagination,
  };
}

function parseAdminCategorySuggestionsRoot(payload: unknown): AdminPublicCategorySuggestionsApiResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items)) {
    return null;
  }

  const items: AdminPublicCategorySuggestionItem[] = [];

  for (const item of root.items) {
    if (!isRecord(item)) {
      return null;
    }

    const candidate = item as Partial<AdminPublicCategorySuggestionItem>;

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.suggestedName !== "string" ||
      !isNullableString(candidate.description) ||
      typeof candidate.status !== "string" ||
      typeof candidate.createdAt !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.email !== "string" ||
      !isNullableString(candidate.phone) ||
      !isNullableString(candidate.reviewNotes) ||
      !isNullableString(candidate.reviewedAt)
    ) {
      return null;
    }

    items.push({
      id: candidate.id,
      suggestedName: candidate.suggestedName,
      description: candidate.description,
      status: candidate.status,
      createdAt: candidate.createdAt,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      reviewNotes: candidate.reviewNotes,
      reviewedAt: candidate.reviewedAt,
    });
  }

  const pagination = parsePagination(root.pagination);

  if (!pagination) {
    return null;
  }

  return {
    items,
    pagination,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function translateCategoryRequestStatus(value: string): string {
  if (value === "PENDING") {
    return "Pendente";
  }

  if (value === "APPROVED") {
    return "Aprovada";
  }

  if (value === "REJECTED") {
    return "Rejeitada";
  }

  if (value === "MERGED") {
    return "Mesclada";
  }

  return value;
}

function getCategoryStatusTone(isActive: boolean): string {
  return isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-700";
}

function getRequestStatusTone(status: string): string {
  if (status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "MERGED") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function buildErrorMessage(state: RequestState, sectionLabel: string): string {
  if (state === "unauthorized") {
    return `Sessão inválida ou expirada para a seção ${sectionLabel}. Faça login novamente.`;
  }

  if (state === "forbidden") {
    return `Acesso não autorizado para visualizar ${sectionLabel.toLowerCase()}.`;
  }

  return `Não foi possível carregar ${sectionLabel.toLowerCase()} agora. Tente novamente.`;
}

function getPaginationText(page: number, totalPages: number): string {
  return `Página ${page} de ${totalPages}`;
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="py-12">
      <div className="flex items-center gap-3 text-slate-700">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium">Carregando {label.toLowerCase()}...</p>
      </div>
    </div>
  );
}

function SectionError({
  label,
  state,
  onRetry,
  retryHref,
}: {
  label: string;
  state: RequestState;
  onRetry: () => void;
  retryHref?: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
      <p className="text-sm font-medium leading-6 text-red-700">{buildErrorMessage(state, label)}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Tentar novamente
        </button>

        {state === "unauthorized" && retryHref ? (
          <Link
            href={retryHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            Ir para login
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="py-12">
      <p className="text-sm leading-6 text-slate-600">Nenhum registro encontrado em {label.toLowerCase()}.</p>
    </div>
  );
}

function renderCategoryStatus(isActive: boolean): string {
  return isActive ? "Ativa" : "Inativa";
}

function AdminCategoriesSection() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<AdminCategoriesApiResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [management, setManagement] = useState<{ item: AdminCategoryItem; mode: "edit" | "split" } | null>(null);

  const isLoadingState = requestState === "loading";
  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const fetchCategories = useCallback(async (targetPage: number): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setRequestState("loading");

    try {
      const url = new URL(adminCategoriesUrl);
      url.searchParams.set("page", String(targetPage));
      url.searchParams.set("pageSize", String(PAGE_SIZE));

      const httpResponse = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        cache: "no-store",
      });

      if (httpResponse.status === 401) {
        setResponse(null);
        setRequestState("unauthorized");
        return;
      }

      if (httpResponse.status === 403) {
        setResponse(null);
        setRequestState("forbidden");
        return;
      }

      const payload = (await httpResponse.json().catch(() => null)) as unknown;

      if (!httpResponse.ok) {
        setResponse(null);
        setRequestState("error");
        return;
      }

      const parsed = parseCategoriesRoot(payload);

      if (!parsed) {
        setResponse(null);
        setRequestState("error");
        return;
      }

      setResponse(parsed);
      setRequestState(parsed.items.length === 0 ? "empty" : "success");
    } catch {
      setResponse(null);
      setRequestState("error");
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setResponse(null);
      setRequestState("idle");
      return;
    }

    void fetchCategories(page);
  }, [accessToken, fetchCategories, page]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Categorias oficiais</h2>
          <p className="mt-1 text-sm text-slate-600">Total de categorias: {response?.pagination.total ?? 0}</p>
        </div>

        <div className="text-sm text-slate-600">{getPaginationText(response?.pagination.page ?? page, totalPages)}</div>
      </div>

      {isLoadingState ? <SectionLoading label="categorias" /> : null}

      {requestState === "error" || requestState === "unauthorized" || requestState === "forbidden" ? (
        <SectionError
          label="Categorias oficiais"
          state={requestState}
          onRetry={() => void fetchCategories(page)}
          retryHref="/entrar"
        />
      ) : null}

      {requestState === "empty" ? <SectionEmpty label="Categorias oficiais" /> : null}

      {requestState === "success" && response ? (
        <>
          <div className="mt-6 space-y-4 md:hidden">
            {response.items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-950">{item.name}</h3>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <p><span className="font-medium text-slate-900">Slug:</span> {item.slug}</p>
                  <p>
                    <span className="font-medium text-slate-900">Status:</span>{" "}
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${getCategoryStatusTone(item.isActive)}`}>
                      {renderCategoryStatus(item.isActive)}
                    </span>
                  </p>
                  <p><span className="font-medium text-slate-900">Ordem:</span> {item.displayOrder}</p>
                  <p><span className="font-medium text-slate-900">Criada em:</span> {formatDate(item.createdAt)}</p>
                  <p><span className="font-medium text-slate-900">Atualizada em:</span> {formatDate(item.updatedAt)}</p>
                  <CategoryManagementButtons item={item} onOpen={setManagement} />
                  {accessToken ? <CategoryFeaturedToggle item={item} accessToken={accessToken} onSaved={() => fetchCategories(page)} /> : null}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 hidden md:block">
            <table className="min-w-full border-separate border-spacing-0">
              <caption className="sr-only">Lista administrativa de categorias oficiais</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Categoria</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Slug</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Status</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Ordem</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Criada em</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Atualizada em</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {response.items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-900"><p className="font-semibold">{item.name}</p></td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.slug}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${getCategoryStatusTone(item.isActive)}`}>{renderCategoryStatus(item.isActive)}</span></td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.displayOrder}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{formatDate(item.createdAt)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{formatDate(item.updatedAt)}</td>
                    <td className="space-y-2 border-b border-slate-100 px-3 py-4"><CategoryManagementButtons item={item} onOpen={setManagement} />{accessToken ? <CategoryFeaturedToggle item={item} accessToken={accessToken} onSaved={() => fetchCategories(page)} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={isLoadingState || isFirstPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>

            <p className="text-sm text-slate-600">{getPaginationText(response?.pagination.page ?? page, totalPages)}</p>

            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={isLoadingState || isLastPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </>
      ) : null}
      {management && accessToken ? <CategoryManagementDialog item={management.item} mode={management.mode} accessToken={accessToken} onClose={() => setManagement(null)} onSaved={async () => { setManagement(null); await fetchCategories(page); }} /> : null}
    </section>
  );
}

function AdminCategoryRequestsSection() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<AdminCategoryRequestsApiResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [resolutionItem, setResolutionItem] = useState<AdminCategoryRequestItem | null>(null);

  const isLoadingState = requestState === "loading";
  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const fetchCategoryRequests = useCallback(async (targetPage: number): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setRequestState("loading");

    try {
      const url = new URL(adminCategoryRequestsUrl);
      url.searchParams.set("page", String(targetPage));
      url.searchParams.set("pageSize", String(PAGE_SIZE));

      const httpResponse = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        cache: "no-store",
      });

      if (httpResponse.status === 401) {
        setResponse(null);
        setRequestState("unauthorized");
        return;
      }

      if (httpResponse.status === 403) {
        setResponse(null);
        setRequestState("forbidden");
        return;
      }

      const payload = (await httpResponse.json().catch(() => null)) as unknown;

      if (!httpResponse.ok) {
        setResponse(null);
        setRequestState("error");
        return;
      }

      const parsed = parseCategoryRequestsRoot(payload);

      if (!parsed) {
        setResponse(null);
        setRequestState("error");
        return;
      }

      setResponse(parsed);
      setRequestState(parsed.items.length === 0 ? "empty" : "success");
    } catch {
      setResponse(null);
      setRequestState("error");
    }
  }, [accessToken]);

  const decideRequest = useCallback(async (item: AdminCategoryRequestItem, decision: "CREATE" | "ASSOCIATE" | "REJECT"): Promise<void> => {
    if (!accessToken || decidingId) return;
    const reviewNotes = decision === "REJECT" ? window.prompt("Motivo da recusa (obrigatório):") : window.prompt("Nota de decisão (opcional):");
    if (decision === "REJECT" && !reviewNotes?.trim()) return;
    const categoryId = decision === "ASSOCIATE" ? window.prompt("ID da categoria oficial ativa: ") : null;
    if (decision === "ASSOCIATE" && !categoryId?.trim()) return;
    setDecidingId(item.id);
    try {
        const result = await fetch(adminCategoryRequestByIdUrl(item.id), { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, credentials: "include", body: JSON.stringify({ decision, ...(categoryId ? { categoryId } : {}), ...(reviewNotes?.trim() ? { reviewNotes: reviewNotes.trim() } : {}) }) });
      if (!result.ok) { window.alert("Não foi possível registrar a decisão. Confira o limite de categorias e tente novamente."); return; }
      await fetchCategoryRequests(page);
    } finally { setDecidingId(null); }
  }, [accessToken, decidingId, fetchCategoryRequests, page]);

  const completeResolution = useCallback(async (): Promise<void> => {
    await fetchCategoryRequests(page);
    setResolutionItem(null);
  }, [fetchCategoryRequests, page]);

  useEffect(() => {
    if (!accessToken) {
      setResponse(null);
      setRequestState("idle");
      return;
    }

    void fetchCategoryRequests(page);
  }, [accessToken, fetchCategoryRequests, page]);

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
      {resolutionItem && accessToken ? <CategoryResolutionDialog item={resolutionItem} accessToken={accessToken} isSubmitting={decidingId !== null} onClose={() => setResolutionItem(null)} onComplete={completeResolution} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Solicitações de categoria</h2>
          <p className="mt-1 text-sm text-slate-600">Total de solicitações: {response?.pagination.total ?? 0}</p>
        </div>

        <div className="text-sm text-slate-600">{getPaginationText(response?.pagination.page ?? page, totalPages)}</div>
      </div>

      {isLoadingState ? <SectionLoading label="solicitações de categoria" /> : null}

      {requestState === "error" || requestState === "unauthorized" || requestState === "forbidden" ? (
        <SectionError
          label="Solicitações de categoria"
          state={requestState}
          onRetry={() => void fetchCategoryRequests(page)}
          retryHref="/entrar"
        />
      ) : null}

      {requestState === "empty" ? <SectionEmpty label="Solicitações de categoria" /> : null}

      {requestState === "success" && response ? (
        <>
          <div className="mt-6 space-y-4 md:hidden">
            {response.items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-950">{item.suggestedName}</h3>
                {item.reviewNotes ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.reviewNotes}</p> : null}
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <p>
                    <span className="font-medium text-slate-900">Profissional:</span> {item.professionalProfile.displayName}
                  </p>
                  <p className="pl-0">
                    <span className="font-medium text-slate-900">Usuário:</span> {item.professionalProfile.user.name} · {item.professionalProfile.user.email}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Status:</span>{" "}
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${getRequestStatusTone(item.status)}`}>
                      {translateCategoryRequestStatus(item.status)}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Categoria resolvida:</span> {item.resolvedCategory ? item.resolvedCategory.name : "Não definida"}
                    {item.resolvedCategory ? <span className="block text-xs text-slate-500">{item.resolvedCategory.slug}</span> : null}
                  </p>
                  <p><span className="font-medium text-slate-900">Criada em:</span> {formatDate(item.createdAt)}</p>
                  <p><span className="font-medium text-slate-900">Revisada em:</span> {item.reviewedAt ? formatDate(item.reviewedAt) : "Ainda não revisada"}</p>
                </div>
                {item.status === "PENDING" ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={decidingId !== null} onClick={() => void decideRequest(item, "CREATE")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Criar e aprovar</button><button type="button" disabled={decidingId !== null} onClick={() => void decideRequest(item, "ASSOCIATE")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Associar existente</button><button type="button" disabled={decidingId !== null} onClick={() => setResolutionItem(item)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Resolver em várias</button><button type="button" disabled={decidingId !== null} onClick={() => void decideRequest(item, "REJECT")} className="rounded-lg border px-3 py-2 text-sm font-semibold text-red-700">Recusar</button></div> : null}
              </article>
            ))}
          </div>

          <div className="mt-6 hidden md:block">
            <table className="min-w-full border-separate border-spacing-0">
              <caption className="sr-only">Lista administrativa de solicitações de categoria</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Solicitação</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Profissional</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Status</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Categoria resolvida</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Criada em</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Revisada em</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {response.items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-900">
                      <p className="font-semibold">{item.suggestedName}</p>
                      {item.reviewNotes ? <p className="mt-1 text-slate-600">{item.reviewNotes}</p> : <p className="mt-1 text-xs text-slate-500">Sem observações</p>}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{item.professionalProfile.displayName}</p>
                      <p className="mt-1">{item.professionalProfile.user.name}</p>
                      <p className="mt-1 text-slate-600">{item.professionalProfile.user.email}</p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${getRequestStatusTone(item.status)}`}>
                        {translateCategoryRequestStatus(item.status)}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                      {item.resolvedCategory ? (
                        <>
                          <p className="font-medium text-slate-900">{item.resolvedCategory.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.resolvedCategory.slug}</p>
                        </>
                      ) : (
                        <p className="text-slate-600">Não definida</p>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{formatDate(item.createdAt)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.reviewedAt ? formatDate(item.reviewedAt) : "Ainda não revisada"}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.status === "PENDING" ? <div className="flex flex-wrap gap-2"><button type="button" disabled={decidingId !== null} onClick={() => void decideRequest(item, "CREATE")} className="rounded-lg border px-2 py-1 text-xs font-semibold">Criar e aprovar</button><button type="button" disabled={decidingId !== null} onClick={() => void decideRequest(item, "ASSOCIATE")} className="rounded-lg border px-2 py-1 text-xs font-semibold">Associar</button><button type="button" disabled={decidingId !== null} onClick={() => setResolutionItem(item)} className="rounded-lg border px-2 py-1 text-xs font-semibold">Resolver em várias</button><button type="button" disabled={decidingId !== null} onClick={() => void decideRequest(item, "REJECT")} className="rounded-lg border px-2 py-1 text-xs font-semibold text-red-700">Recusar</button></div> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={isLoadingState || isFirstPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>

            <p className="text-sm text-slate-600">{getPaginationText(response?.pagination.page ?? page, totalPages)}</p>

            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={isLoadingState || isLastPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function CategoryResolutionDialog({ item, accessToken, isSubmitting, onClose, onComplete }: { item: AdminCategoryRequestItem; accessToken: string; isSubmitting: boolean; onClose: () => void; onComplete: () => Promise<void> }) {
  const [options, setOptions] = useState<AdminCategoryItem[]>([]); const [search, setSearch] = useState(""); const [choices, setChoices] = useState<Array<{ id?: string; name: string; slug: string }>>([]); const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [notes, setNotes] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { void (async () => { try { const response = await fetch(`${adminCategoriesUrl}?page=1&pageSize=100`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" }); const parsed = response.ok ? parseCategoriesRoot(await response.json()) : null; if (!parsed) throw new Error(); setOptions(parsed.items.filter((category) => category.isActive)); } catch { setError("Não foi possível carregar categorias oficiais."); } })(); }, [accessToken]);
  const addExisting = (category: AdminCategoryItem) => { if (choices.length < 3 && !choices.some((choice) => choice.id === category.id)) setChoices((current) => [...current, { id: category.id, name: category.name, slug: category.slug }]); };
  const submit = async () => { if (choices.length < 1 || choices.length > 3) { setError("Escolha de uma a três categorias."); return; } setSaving(true); setError(null); try { const response = await fetch(adminCategoryRequestByIdUrl(item.id), { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, credentials: "include", body: JSON.stringify({ decision: "RESOLVE", categories: choices.map((choice) => choice.id ? { categoryId: choice.id } : { create: { name: choice.name, ...(choice.slug ? { slug: choice.slug } : {}) } }), ...(notes.trim() ? { reviewNotes: notes.trim() } : {}) }) }); if (!response.ok) { const payload = await response.json().catch(() => null) as { message?: string } | null; setError(payload?.message ?? "Não foi possível salvar. Confira o limite de categorias."); return; } await onComplete(); } finally { setSaving(false); } };
  const filtered = options.filter((category) => `${category.name} ${category.slug}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="resolve-category-title"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between gap-4"><div><h3 id="resolve-category-title" className="text-lg font-bold">Resolver em várias categorias</h3><p className="mt-1 text-sm text-slate-600">Selecione de 1 a 3 categorias para “{item.suggestedName}”.</p></div><button type="button" onClick={onClose} disabled={saving || isSubmitting}>Fechar</button></div>{error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}<label className="mt-5 block text-sm font-semibold">Pesquisar categoria existente<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Nome ou slug" /></label><div className="mt-2 max-h-32 overflow-y-auto rounded-lg border">{filtered.map((category) => <button key={category.id} type="button" onClick={() => addExisting(category)} disabled={choices.length >= 3 || choices.some((choice) => choice.id === category.id)} className="block w-full border-b px-3 py-2 text-left text-sm disabled:opacity-50">{category.name} <span className="text-slate-500">{category.slug}</span></button>)}</div><div className="mt-5 rounded-lg border p-3"><p className="text-sm font-semibold">Nova categoria</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" className="rounded border p-2" /><input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Slug opcional" className="rounded border p-2" /></div><button type="button" disabled={!name.trim() || choices.length >= 3} onClick={() => { setChoices((current) => [...current, { name: name.trim(), slug: slug.trim() }]); setName(""); setSlug(""); }} className="mt-2 rounded border px-3 py-2 text-sm font-semibold">Adicionar</button></div><p className="mt-5 text-sm font-semibold">Escolhas ({choices.length}/3)</p><ul className="mt-2 space-y-2">{choices.map((choice, index) => <li key={`${choice.id ?? choice.name}-${index}`} className="flex justify-between rounded bg-slate-50 p-2 text-sm">{choice.name}<button type="button" onClick={() => setChoices((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="font-semibold text-red-700">Remover</button></li>)}</ul><label className="mt-5 block text-sm font-semibold">Nota opcional<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded border p-2" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={saving || isSubmitting}>Cancelar</button><button type="button" onClick={() => void submit()} disabled={saving || isSubmitting || choices.length < 1} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white">{saving ? "Salvando..." : "Confirmar decisão"}</button></div></div></div>;
}

function AdminPublicCategorySuggestionsSection() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<AdminPublicCategorySuggestionsApiResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [moderatingSuggestionId, setModeratingSuggestionId] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const isLoadingState = requestState === "loading";
  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const fetchAdminCategorySuggestions = useCallback(async (targetPage: number): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setRequestState("loading");

    try {
      const url = new URL(adminCategorySuggestionsUrl);
      url.searchParams.set("page", String(targetPage));
      url.searchParams.set("pageSize", String(PAGE_SIZE));

      const httpResponse = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        cache: "no-store",
      });

      if (httpResponse.status === 401) {
        setResponse(null);
        setRequestState("unauthorized");
        return;
      }

      if (httpResponse.status === 403) {
        setResponse(null);
        setRequestState("forbidden");
        return;
      }

      const payload = (await httpResponse.json().catch(() => null)) as unknown;

      if (!httpResponse.ok) {
        setResponse(null);
        setRequestState("error");
        return;
      }

      const parsed = parseAdminCategorySuggestionsRoot(payload);

      if (!parsed) {
        setResponse(null);
        setRequestState("error");
        return;
      }

      setResponse(parsed);
      setRequestState(parsed.items.length === 0 ? "empty" : "success");
      setActionErrorMessage(null);
    } catch {
      setResponse(null);
      setRequestState("error");
    }
  }, [accessToken]);

  const handleModerateSuggestion = useCallback(async (
    item: AdminPublicCategorySuggestionItem,
    nextStatus: "APPROVED" | "REJECTED",
  ): Promise<void> => {
    if (!accessToken || moderatingSuggestionId !== null || item.status !== "PENDING") {
      return;
    }

    const actionLabel = nextStatus === "APPROVED" ? "aprovar" : "rejeitar";
    const confirmed = window.confirm(`Deseja ${actionLabel} esta sugestão pública de categoria?`);

    if (!confirmed) {
      return;
    }

    const reviewNotesInput = window.prompt("Nota de revisão (opcional):") ?? "";
    const reviewNotes = reviewNotesInput.trim();

    setModeratingSuggestionId(item.id);
    setActionErrorMessage(null);

    try {
      const httpResponse = await fetch(adminCategorySuggestionByIdUrl(item.id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          status: nextStatus,
          ...(reviewNotes.length > 0 ? { reviewNotes } : {}),
        }),
      });

      const payload = (await httpResponse.json().catch(() => null)) as unknown;

      if (!httpResponse.ok) {
        setActionErrorMessage("Não foi possível atualizar a sugestão agora. Tente novamente.");

        if (httpResponse.status === 401 || httpResponse.status === 403 || httpResponse.status === 409 || httpResponse.status === 404) {
          void fetchAdminCategorySuggestions(page);
        }

        return;
      }

      const data = isRecord(payload) && isRecord(payload.data)
        ? payload.data
        : payload;

      if (!isRecord(data)) {
        setActionErrorMessage("Não foi possível atualizar a sugestão agora. Tente novamente.");
        return;
      }

      const candidate = data as Partial<AdminPublicCategorySuggestionItem>;

      if (
        typeof candidate.id !== "string" ||
        typeof candidate.suggestedName !== "string" ||
        !isNullableString(candidate.description) ||
        typeof candidate.status !== "string" ||
        typeof candidate.createdAt !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.email !== "string" ||
        !isNullableString(candidate.phone) ||
        !isNullableString(candidate.reviewNotes) ||
        !isNullableString(candidate.reviewedAt)
      ) {
        setActionErrorMessage("Não foi possível atualizar a sugestão agora. Tente novamente.");
        return;
      }

      setResponse((currentResponse) => {
        if (!currentResponse) {
          return currentResponse;
        }

        const moderatedItemId = candidate.id;

        return {
          ...currentResponse,
          items: currentResponse.items.map((currentItem) =>
            currentItem.id === moderatedItemId
              ? {
                ...currentItem,
                status: nextStatus,
                reviewNotes: candidate.reviewNotes ?? currentItem.reviewNotes ?? null,
                reviewedAt: candidate.reviewedAt ?? currentItem.reviewedAt ?? null,
              }
              : currentItem,
          ),
        };
      });
    } catch {
      setActionErrorMessage("Não foi possível atualizar a sugestão agora. Tente novamente.");
    } finally {
      setModeratingSuggestionId(null);
    }
  }, [accessToken, fetchAdminCategorySuggestions, moderatingSuggestionId, page]);

  useEffect(() => {
    if (!accessToken) {
      setResponse(null);
      setRequestState("idle");
      return;
    }

    void fetchAdminCategorySuggestions(page);
  }, [accessToken, fetchAdminCategorySuggestions, page]);

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Sugestões públicas de categoria</h2>
          <p className="mt-1 text-sm text-slate-600">Total de sugestões públicas: {response?.pagination.total ?? 0}</p>
        </div>

        <div className="text-sm text-slate-600">{getPaginationText(response?.pagination.page ?? page, totalPages)}</div>
      </div>

      {isLoadingState ? <SectionLoading label="sugestões públicas de categoria" /> : null}

      {requestState === "error" || requestState === "unauthorized" || requestState === "forbidden" ? (
        <SectionError
          label="Sugestões públicas de categoria"
          state={requestState}
          onRetry={() => void fetchAdminCategorySuggestions(page)}
          retryHref="/entrar"
        />
      ) : null}

      {requestState === "empty" ? <SectionEmpty label="Sugestões públicas de categoria" /> : null}

      {actionErrorMessage ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-700">{actionErrorMessage}</p>
        </div>
      ) : null}

      {requestState === "success" && response ? (
        <>
          <div className="mt-6 space-y-4 md:hidden">
            {response.items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-950">{item.suggestedName}</h3>
                {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <p>
                    <span className="font-medium text-slate-900">Status:</span>{" "}
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${getRequestStatusTone(item.status)}`}>
                      {translateCategoryRequestStatus(item.status)}
                    </span>
                  </p>
                  <p><span className="font-medium text-slate-900">Nome:</span> {item.name}</p>
                  <p><span className="font-medium text-slate-900">E-mail:</span> {item.email}</p>
                  <p><span className="font-medium text-slate-900">Telefone:</span> {item.phone ?? "Não informado"}</p>
                  <p><span className="font-medium text-slate-900">Criada em:</span> {formatDate(item.createdAt)}</p>
                  {item.reviewNotes ? <p><span className="font-medium text-slate-900">Nota:</span> {item.reviewNotes}</p> : null}
                  <p><span className="font-medium text-slate-900">Revisada em:</span> {item.reviewedAt ? formatDate(item.reviewedAt) : "Ainda não revisada"}</p>
                </div>
                {item.status === "PENDING" ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleModerateSuggestion(item, "APPROVED")}
                      disabled={moderatingSuggestionId !== null}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {moderatingSuggestionId === item.id ? "Salvando..." : "Aprovar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleModerateSuggestion(item, "REJECTED")}
                      disabled={moderatingSuggestionId !== null}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {moderatingSuggestionId === item.id ? "Salvando..." : "Rejeitar"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-6 hidden md:block">
            <table className="min-w-full border-separate border-spacing-0">
              <caption className="sr-only">Lista administrativa de sugestões públicas de categoria</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Sugestão</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Descrição</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Status</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Nome</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">E-mail</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Telefone</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Criada em</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Revisada em</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {response.items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-900"><p className="font-semibold">{item.suggestedName}</p></td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                      <p>{item.description ?? "Sem descrição"}</p>
                      {item.reviewNotes ? <p className="mt-1 text-xs text-slate-500">Nota: {item.reviewNotes}</p> : null}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${getRequestStatusTone(item.status)}`}>{translateCategoryRequestStatus(item.status)}</span></td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.name}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.email}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.phone ?? "Não informado"}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{formatDate(item.createdAt)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">{item.reviewedAt ? formatDate(item.reviewedAt) : "Ainda não revisada"}</td>
                    <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                      {item.status === "PENDING" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleModerateSuggestion(item, "APPROVED")}
                            disabled={moderatingSuggestionId !== null}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {moderatingSuggestionId === item.id ? "Salvando..." : "Aprovar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleModerateSuggestion(item, "REJECTED")}
                            disabled={moderatingSuggestionId !== null}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {moderatingSuggestionId === item.id ? "Salvando..." : "Rejeitar"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500">Sem ações</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={isLoadingState || isFirstPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>

            <p className="text-sm text-slate-600">{getPaginationText(response?.pagination.page ?? page, totalPages)}</p>

            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={isLoadingState || isLastPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function AdminCategoriesPage() {
  const { isLoading, isAuthenticated, user } = useAuth();

  const isAdmin = Boolean(user?.roles.includes("ADMIN"));

  if (isLoading) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm" aria-live="polite">
            <div className="flex items-center gap-3 text-slate-700">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              <p className="text-sm font-medium">Carregando sessão administrativa...</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8" aria-labelledby="admin-categories-signin-required-title">
            <h1 id="admin-categories-signin-required-title" className="text-2xl font-bold tracking-tight text-amber-900 sm:text-3xl">
              Área administrativa
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-amber-800">
              Para visualizar as categorias, é necessário entrar com uma conta administrativa.
            </p>
            <Link
              href="/entrar"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Entrar
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-red-200 bg-red-50 p-8" role="alert" aria-labelledby="admin-categories-forbidden-title">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
              <div>
                <h1 id="admin-categories-forbidden-title" className="text-2xl font-bold tracking-tight text-red-900 sm:text-3xl">
                  Acesso não autorizado
                </h1>
                <p className="mt-3 max-w-2xl leading-7 text-red-800">
                  Sua conta não possui permissão para acessar a gestão administrativa de categorias.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <AdminBackLink />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Categorias</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Gerencie a visão administrativa das categorias oficiais e acompanhe solicitações internas e sugestões públicas.
          </p>
        </header>

        <div className="mt-8">
          <AdminCategoriesSection />
          <AdminCategoryRequestsSection />
          <AdminPublicCategorySuggestionsSection />
        </div>
      </div>
    </main>
  );
}
