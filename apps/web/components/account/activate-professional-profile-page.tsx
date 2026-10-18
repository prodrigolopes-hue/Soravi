"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, BriefcaseBusiness, LoaderCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { categoriesUrl, professionalProfileActivationUrl } from "../../lib/api";
import { parseProfessionalCategories, type ProfessionalCategory } from "../../lib/professional-profile";
import { z } from "../../lib/zod";
import { useAuth } from "../auth/auth-provider";

const schema = z.object({
  professionalTitle: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(80, "Use no máximo 80 caracteres."),
  serviceArea: z.string().trim().min(2, "Informe uma área de atendimento válida.").max(100, "Use no máximo 100 caracteres."),
  bio: z.string().trim().min(30, "A biografia deve ter pelo menos 30 caracteres.").max(500, "Use no máximo 500 caracteres."),
  categorySlugs: z.array(z.string()).min(1, "Selecione pelo menos uma categoria.").max(3, "Selecione no máximo três categorias.").refine((items) => new Set(items).size === items.length, "Não selecione categorias duplicadas."),
});

type FormData = z.infer<typeof schema>;
type CategoriesState = "loading" | "ready" | "error" | "empty";

export function ActivateProfessionalProfilePage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading, refreshSession, user } = useAuth();
  const [categories, setCategories] = useState<ProfessionalCategory[]>([]);
  const [categoriesState, setCategoriesState] = useState<CategoriesState>("loading");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activationComplete, setActivationComplete] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { register, handleSubmit, setError, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema), defaultValues: { professionalTitle: "", serviceArea: "", bio: "", categorySlugs: [] }, mode: "onTouched",
  });
  const selectedCategories = watch("categorySlugs");
  const bioLength = watch("bio").length;
  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));
  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));

  useEffect(() => {
    if (!isLoading && isAuthenticated && isProfessional) router.replace("/profissional");
  }, [isAuthenticated, isLoading, isProfessional, router]);

  useEffect(() => {
    if (!isAuthenticated || isProfessional) return;
    const controller = new AbortController();
    async function load(): Promise<void> {
      setCategoriesState("loading");
      try {
        const response = await fetch(categoriesUrl, { cache: "no-store", signal: controller.signal });
        const parsed = response.ok ? parseProfessionalCategories(await response.json().catch(() => null)) : null;
        if (!parsed) throw new Error();
        setCategories(parsed); setCategoriesState(parsed.length ? "ready" : "empty");
      } catch {
        if (!controller.signal.aborted) { setCategories([]); setCategoriesState("error"); }
      }
    }
    void load();
    return () => controller.abort();
  }, [isAuthenticated, isProfessional]);

  function toggleCategory(slug: string): void {
    const next = selectedCategories.includes(slug) ? selectedCategories.filter((item) => item !== slug) : [...selectedCategories, slug];
    if (next.length <= 3) setValue("categorySlugs", next, { shouldValidate: true, shouldDirty: true });
  }

  async function updateSession(): Promise<void> {
    setIsRefreshing(true); setRefreshError(null);
    try {
      const refreshed = await refreshSession();
      if (!refreshed) throw new Error();
      router.replace("/profissional");
    } catch {
      setRefreshError("Seu perfil foi criado, mas não foi possível atualizar sua sessão. Tente atualizar novamente antes de acessar o painel.");
    } finally { setIsRefreshing(false); }
  }

  async function submit(data: FormData): Promise<void> {
    if (!accessToken || isSubmitting || categoriesState !== "ready") return;
    if (data.categorySlugs.some((slug) => !categories.some((category) => category.slug === slug))) {
      setError("categorySlugs", { message: "Selecione apenas categorias ativas disponíveis." }); return;
    }
    setSubmitError(null);
    try {
      const response = await fetch(professionalProfileActivationUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = getCode(payload);
        throw new Error(code === "PROFESSIONAL_CATEGORY_OPEN_SERVICE_REQUEST" ? "Há uma solicitação sua em aberto em uma das categorias escolhidas. Escolha outra categoria ou conclua/cancele a solicitação antes de continuar." : getMessage(payload) ?? "Não foi possível ativar seu perfil profissional agora. Revise os dados e tente novamente.");
      }
      setActivationComplete(true);
      await updateSession();
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Não foi possível ativar seu perfil profissional agora."); }
  }

  if (isLoading) return <Message title="Carregando sua conta..." />;
  if (isAuthenticated && isProfessional) return <Message title="Redirecionando para o painel profissional..." />;
  if (activationComplete) return <Message title="Perfil profissional criado" description={refreshError ?? "Atualizando sua sessão para abrir o painel profissional..."} action={refreshError ? { label: isRefreshing ? "Atualizando sessão..." : "Atualizar sessão", onClick: () => void updateSession(), disabled: isRefreshing } : undefined} secondaryAction={refreshError ? { label: "Entrar novamente", href: "/entrar" } : undefined} />;
  if (!isAuthenticated || !accessToken || !isCustomer) return <Message title="Entre com uma conta de cliente" description="A ativação do perfil profissional está disponível para clientes autenticados." action={{ label: "Entrar", href: "/entrar" }} />;

  return <main className="min-h-full bg-slate-50"><div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <Link href="/conta" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Voltar para conta</Link>
    <header className="mt-5"><p className="font-semibold text-blue-700">Perfil profissional</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Também quero trabalhar</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Seu perfil de cliente será mantido. A criação do perfil profissional não representa aprovação. Após criar seu perfil, acesse o painel profissional para solicitar sua verificação.</p></header>
    <form className="mt-8 space-y-6" noValidate onSubmit={handleSubmit(submit)}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold text-slate-950">Informações profissionais</h2><Field label="Título profissional" id="professionalTitle" error={errors.professionalTitle?.message}><div className="relative"><BriefcaseBusiness aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input id="professionalTitle" maxLength={80} className={inputClass} aria-invalid={Boolean(errors.professionalTitle)} aria-describedby={errors.professionalTitle ? "professionalTitle-error" : undefined} {...register("professionalTitle")} /></div></Field><Field label="Área de atendimento" id="serviceArea" error={errors.serviceArea?.message}><div className="relative"><MapPin aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input id="serviceArea" maxLength={100} className={inputClass} aria-invalid={Boolean(errors.serviceArea)} aria-describedby={errors.serviceArea ? "serviceArea-error" : undefined} {...register("serviceArea")} /></div></Field><Field label="Biografia profissional" id="bio" error={errors.bio?.message}><textarea id="bio" rows={6} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? "bio-error" : undefined} {...register("bio")} /><p className="mt-2 text-right text-xs text-slate-500" aria-live="polite">{bioLength}/500 caracteres</p></Field></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold text-slate-950">Categorias de serviço</h2><p className="mt-2 text-sm leading-6 text-slate-600">Selecione de 1 a 3 categorias ativas. Você escolheu {selectedCategories.length} de 3.</p>{categoriesState === "loading" ? <p className="mt-4 text-sm text-slate-600">Carregando categorias...</p> : null}{categoriesState === "error" || categoriesState === "empty" ? <p role="alert" className="mt-4 text-sm text-red-700">Não foi possível carregar categorias ativas. Atualize a página e tente novamente.</p> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2">{categories.map((category) => { const selected = selectedCategories.includes(category.slug); const disabled = !selected && selectedCategories.length >= 3; return <label key={category.id} className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 ${selected ? "border-blue-500 bg-blue-50" : "border-slate-300"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}><input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleCategory(category.slug)} aria-describedby={errors.categorySlugs ? "categorySlugs-error" : undefined} className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" /><span className="text-sm font-semibold text-slate-800">{category.name}</span></label>; })}</div>{errors.categorySlugs ? <p id="categorySlugs-error" role="alert" className="mt-3 text-sm font-medium text-red-700">{errors.categorySlugs.message}</p> : null}</section>
      {submitError ? <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertCircle aria-hidden="true" className="size-5 shrink-0" />{submitError}</div> : null}
      <button type="submit" disabled={isSubmitting || categoriesState !== "ready"} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">{isSubmitting ? <><LoaderCircle aria-hidden="true" className="size-5 animate-spin" />Criando perfil...</> : "Criar perfil profissional"}</button>
    </form>
  </div></main>;
}

const inputClass = "min-h-12 w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";
function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) { return <div className="mt-5"><label htmlFor={id} className="block text-sm font-semibold text-slate-800">{label}</label>{children}{error ? <p id={`${id}-error`} role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}</div>; }
function Message({ title, description, action, secondaryAction }: { title: string; description?: string; action?: { label: string; href?: string; onClick?: () => void; disabled?: boolean }; secondaryAction?: { label: string; href: string } }) { return <main className="min-h-full bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">{title}</h1>{description ? <p className="mt-3 text-slate-600">{description}</p> : null}<div className="mt-5 flex flex-wrap gap-3">{action?.href ? <Link href={action.href} className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">{action.label}</Link> : null}{action?.onClick ? <button type="button" disabled={action.disabled} onClick={action.onClick} className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{action.label}</button> : null}{secondaryAction ? <Link href={secondaryAction.href} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-100">{secondaryAction.label}</Link> : null}</div></section></div></main>; }
function getCode(payload: unknown): string | null { return typeof payload === "object" && payload !== null && "code" in payload && typeof payload.code === "string" ? payload.code : null; }
function getMessage(payload: unknown): string | null { return typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string" ? payload.message : null; }
