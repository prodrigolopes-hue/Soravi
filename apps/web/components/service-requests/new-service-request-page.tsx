"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  MapPin,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { categoriesUrl, serviceRequestsUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

interface ServiceCategory {
  id: string;
  name: string;
}

type CategoriesState = "loading" | "success" | "empty" | "error";
type SubmissionState = "idle" | "success" | "error";
type PostalCodeLookupState = "idle" | "loading" | "success" | "not-found" | "error";

interface ViaCepResponse {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

const serviceRequestSchema = z.object({
  categoryId: z.uuidv4("Selecione uma categoria válida."),
  title: z
    .string()
    .trim()
    .min(2, "O título deve possuir pelo menos 2 caracteres.")
    .max(160, "O título deve possuir no máximo 160 caracteres."),
  description: z
    .string()
    .trim()
    .max(2000, "A descrição deve possuir no máximo 2000 caracteres."),
  location: z.object({
    country: z.string().length(2, "O país deve possuir exatamente 2 caracteres."),
    state: z
      .string()
      .trim()
      .length(2, "Informe a sigla do estado com 2 caracteres."),
    city: z
      .string()
      .trim()
      .min(2, "A cidade deve possuir pelo menos 2 caracteres.")
      .max(120, "A cidade deve possuir no máximo 120 caracteres."),
    neighborhood: z
      .string()
      .trim()
      .min(1, "Informe o bairro.")
      .max(120, "O bairro deve possuir no máximo 120 caracteres."),
    postalCode: z
      .string()
      .trim()
      .min(1, "Informe o CEP.")
      .max(16, "O CEP deve possuir no máximo 16 caracteres."),
    addressLine: z
      .string()
      .trim()
      .min(1, "Informe o endereço.")
      .max(255, "O endereço deve possuir no máximo 255 caracteres."),
    addressNumber: z
      .string()
      .trim()
      .min(1, "Informe o número.")
      .max(32, "O número deve possuir no máximo 32 caracteres."),
    addressComplement: z
      .string()
      .trim()
      .max(255, "O complemento deve possuir no máximo 255 caracteres."),
  }),
});

type ServiceRequestFormData = z.infer<typeof serviceRequestSchema>;

const fieldClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function isServiceCategory(value: unknown): value is ServiceCategory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ServiceCategory>;

  return typeof candidate.id === "string" && typeof candidate.name === "string";
}

function isViaCepResponse(value: unknown): value is ViaCepResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ViaCepResponse>;

  return (
    typeof candidate.logradouro === "string" &&
    typeof candidate.bairro === "string" &&
    typeof candidate.localidade === "string" &&
    typeof candidate.uf === "string"
  );
}

function isViaCepNotFound(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "erro" in value &&
    value.erro === true
  );
}

function formatPostalCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const message = (payload as { message?: unknown }).message;

  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }

  if (Array.isArray(message)) {
    const firstMessage = message.find(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );

    return firstMessage?.trim() ?? null;
  }

  return null;
}

interface FieldErrorProps {
  id: string;
  message?: string;
}

function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-red-600">
      {message}
    </p>
  );
}

export function NewServiceRequestPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoriesState, setCategoriesState] =
    useState<CategoriesState>("loading");
  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [postalCodeLookupState, setPostalCodeLookupState] =
    useState<PostalCodeLookupState>("idle");
  const lastLookedUpPostalCodeRef = useRef<string | null>(null);
  const postalCodeAbortControllerRef = useRef<AbortController | null>(null);

  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ServiceRequestFormData>({
    resolver: zodResolver(serviceRequestSchema),
    defaultValues: {
      categoryId: "",
      title: "",
      description: "",
      location: {
        country: "BR",
        state: "",
        city: "",
        neighborhood: "",
        postalCode: "",
        addressLine: "",
        addressNumber: "",
        addressComplement: "",
      },
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) {
      return;
    }

    const abortController = new AbortController();

    async function loadCategories(): Promise<void> {
      setCategoriesState("loading");

      try {
        const response = await fetch(categoriesUrl, {
          signal: abortController.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          setCategories([]);
          setCategoriesState("error");
          return;
        }

        const payload: unknown = await response.json();

        if (!Array.isArray(payload)) {
          setCategories([]);
          setCategoriesState("error");
          return;
        }

        const parsedCategories = payload.filter(isServiceCategory);

        setCategories(parsedCategories);
        setCategoriesState(parsedCategories.length > 0 ? "success" : "empty");
      } catch {
        if (!abortController.signal.aborted) {
          setCategories([]);
          setCategoriesState("error");
        }
      }
    }

    void loadCategories();

    return () => abortController.abort();
  }, [categoriesReloadKey, isAuthenticated, isCustomer]);

  useEffect(() => {
    return () => postalCodeAbortControllerRef.current?.abort();
  }, []);

  async function lookupPostalCode(postalCode: string): Promise<void> {
    if (lastLookedUpPostalCodeRef.current === postalCode) {
      return;
    }

    lastLookedUpPostalCodeRef.current = postalCode;
    postalCodeAbortControllerRef.current?.abort();

    const abortController = new AbortController();
    postalCodeAbortControllerRef.current = abortController;
    setPostalCodeLookupState("loading");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, {
        signal: abortController.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        setPostalCodeLookupState("error");
        return;
      }

      const payload: unknown = await response.json();

      if (isViaCepNotFound(payload)) {
        setPostalCodeLookupState("not-found");
        return;
      }

      if (!isViaCepResponse(payload)) {
        setPostalCodeLookupState("error");
        return;
      }

      if (payload.logradouro) {
        setValue("location.addressLine", payload.logradouro, {
          shouldDirty: true,
        });
      }

      if (payload.bairro) {
        setValue("location.neighborhood", payload.bairro, {
          shouldDirty: true,
        });
      }

      if (payload.localidade) {
        setValue("location.city", payload.localidade, {
          shouldDirty: true,
        });
      }

      if (payload.uf) {
        setValue("location.state", payload.uf, {
          shouldDirty: true,
        });
      }

      clearErrors([
        "location.addressLine",
        "location.neighborhood",
        "location.city",
        "location.state",
      ]);
      setPostalCodeLookupState("success");
    } catch {
      if (!abortController.signal.aborted) {
        setPostalCodeLookupState("error");
      }
    }
  }

  function handlePostalCodeChange(event: ChangeEvent<HTMLInputElement>): void {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);

    setValue("location.postalCode", formatPostalCode(digits), {
      shouldDirty: true,
    });

    if (digits.length !== 8) {
      postalCodeAbortControllerRef.current?.abort();
      setPostalCodeLookupState("idle");
      return;
    }

    void lookupPostalCode(digits);
  }

  async function submitServiceRequest(data: ServiceRequestFormData): Promise<void> {
    if (!accessToken || isSubmitting) {
      return;
    }

    const selectedCategoryIsAvailable = categories.some(
      (category) => category.id === data.categoryId,
    );

    if (!selectedCategoryIsAvailable) {
      setError("categoryId", {
        type: "manual",
        message: "Selecione uma categoria disponível.",
      });
      return;
    }

    setSubmissionState("idle");
    setFormMessage(null);

    const description = data.description.trim();
    const addressComplement = data.location.addressComplement.trim();

    try {
      const response = await fetch(serviceRequestsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          categoryId: data.categoryId,
          title: data.title,
          ...(description ? { description } : {}),
          location: {
            country: "BR",
            state: data.location.state.toUpperCase(),
            city: data.location.city,
            neighborhood: data.location.neighborhood,
            postalCode: data.location.postalCode,
            addressLine: data.location.addressLine,
            addressNumber: data.location.addressNumber,
            ...(addressComplement ? { addressComplement } : {}),
          },
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const backendMessage = extractErrorMessage(payload);
        const fallbackMessage =
          response.status === 401
            ? "Sua sessão expirou. Entre novamente para continuar."
            : response.status === 403
              ? "Sua conta não possui permissão para criar solicitações."
              : "Não foi possível salvar a solicitação. Tente novamente.";

        setSubmissionState("error");
        setFormMessage(backendMessage ?? fallbackMessage);
        return;
      }

      setSubmissionState("success");
      setFormMessage(
        "Solicitação criada e salva como rascunho. Ela ainda não foi publicada.",
      );
      reset();
      setPostalCodeLookupState("idle");
      lastLookedUpPostalCodeRef.current = null;
    } catch {
      setSubmissionState("error");
      setFormMessage(
        "Não foi possível conectar à Soravi. Tente novamente em instantes.",
      );
    }
  }

  const hasPostalCodeLookupFeedback =
    postalCodeLookupState === "loading" ||
    postalCodeLookupState === "not-found" ||
    postalCodeLookupState === "error";
  const postalCodeDescribedBy = [
    errors.location?.postalCode ? "postalCode-error" : null,
    hasPostalCodeLookupFeedback ? "postalCode-lookup-feedback" : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  if (isLoading) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="flex items-center gap-3 text-slate-700" aria-live="polite">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            Carregando sua conta...
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-amber-950">Entre para criar uma solicitação</h1>
            <p className="mt-3 leading-7 text-amber-900/80">
              A nova solicitação fica vinculada à sua conta de cliente.
            </p>
            <Link href="/entrar" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              Entrar
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (!isCustomer) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-red-950">Acesso exclusivo para clientes</h1>
            <p className="mt-3 leading-7 text-red-900/80">
              Esta página requer uma conta com perfil de cliente.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar
        </Link>

        <header className="mt-6">
          <p className="font-semibold text-blue-600">Solicitação de serviço</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Nova solicitação
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Descreva o que você precisa. Sua solicitação será salva como rascunho para você revisar antes de publicar.
          </p>
        </header>

        <form onSubmit={handleSubmit(submitServiceRequest)} noValidate className="mt-8 space-y-8">
          <section aria-labelledby="request-details-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 id="request-details-title" className="text-xl font-bold text-slate-950">O que você precisa?</h2>

            <div className="mt-6">
              <label htmlFor="categoryId" className="text-sm font-semibold text-slate-800">Categoria</label>
              <select id="categoryId" disabled={categoriesState !== "success" || isSubmitting} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "categoryId-error" : undefined} className={fieldClassName} {...register("categoryId")}>
                <option value="">
                  {categoriesState === "loading" ? "Carregando categorias..." : "Selecione uma categoria"}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <FieldError id="categoryId-error" message={errors.categoryId?.message} />
              {categoriesState === "error" ? (
                <div className="mt-3 flex flex-wrap items-center gap-3" role="alert">
                  <p className="text-sm font-medium text-red-600">Não foi possível carregar as categorias.</p>
                  <button type="button" onClick={() => setCategoriesReloadKey((value) => value + 1)} className="text-sm font-semibold text-blue-600 underline underline-offset-4">Tentar novamente</button>
                </div>
              ) : null}
              {categoriesState === "empty" ? <p className="mt-2 text-sm text-amber-700" role="status">Nenhuma categoria está disponível no momento.</p> : null}
            </div>

            <div className="mt-5">
              <label htmlFor="title" className="text-sm font-semibold text-slate-800">Título</label>
              <input id="title" type="text" maxLength={160} placeholder="Ex.: Instalação de tomada na sala" disabled={isSubmitting} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "title-error" : undefined} className={fieldClassName} {...register("title")} />
              <FieldError id="title-error" message={errors.title?.message} />
            </div>

            <div className="mt-5">
              <label htmlFor="description" className="text-sm font-semibold text-slate-800">Descrição <span className="font-normal text-slate-500">(opcional)</span></label>
              <textarea id="description" rows={5} maxLength={2000} placeholder="Conte os detalhes que ajudam a entender o serviço" disabled={isSubmitting} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} className={fieldClassName} {...register("description")} />
              <FieldError id="description-error" message={errors.description?.message} />
            </div>
          </section>

          <fieldset disabled={isSubmitting} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <legend className="sr-only">Localização do serviço</legend>
            <div className="flex items-start gap-3">
              <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-slate-950">Onde o serviço será realizado?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Informe o endereço do local do serviço.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="country" className="text-sm font-semibold text-slate-800">País</label>
                <input id="country" type="text" readOnly className={fieldClassName} {...register("location.country")} />
              </div>
              <div>
                <label htmlFor="state" className="text-sm font-semibold text-slate-800">Estado (UF)</label>
                <input id="state" type="text" maxLength={2} autoCapitalize="characters" placeholder="SP" aria-invalid={Boolean(errors.location?.state)} aria-describedby={errors.location?.state ? "state-error" : undefined} className={fieldClassName} {...register("location.state")} />
                <FieldError id="state-error" message={errors.location?.state?.message} />
              </div>
              <div>
                <label htmlFor="city" className="text-sm font-semibold text-slate-800">Cidade</label>
                <input id="city" type="text" maxLength={120} autoComplete="address-level2" aria-invalid={Boolean(errors.location?.city)} aria-describedby={errors.location?.city ? "city-error" : undefined} className={fieldClassName} {...register("location.city")} />
                <FieldError id="city-error" message={errors.location?.city?.message} />
              </div>
              <div>
                <label htmlFor="neighborhood" className="text-sm font-semibold text-slate-800">Bairro</label>
                <input id="neighborhood" type="text" maxLength={120} aria-invalid={Boolean(errors.location?.neighborhood)} aria-describedby={errors.location?.neighborhood ? "neighborhood-error" : undefined} className={fieldClassName} {...register("location.neighborhood")} />
                <FieldError id="neighborhood-error" message={errors.location?.neighborhood?.message} />
              </div>
              <div>
                <label htmlFor="postalCode" className="text-sm font-semibold text-slate-800">CEP</label>
                <input id="postalCode" type="text" maxLength={9} inputMode="numeric" autoComplete="postal-code" aria-invalid={Boolean(errors.location?.postalCode)} aria-describedby={postalCodeDescribedBy} className={fieldClassName} {...register("location.postalCode")} onChange={handlePostalCodeChange} />
                <FieldError id="postalCode-error" message={errors.location?.postalCode?.message} />
                {postalCodeLookupState === "loading" ? (
                  <p id="postalCode-lookup-feedback" role="status" className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Buscando endereço...
                  </p>
                ) : null}
                {postalCodeLookupState === "not-found" ? (
                  <p id="postalCode-lookup-feedback" role="alert" className="mt-2 text-sm font-medium text-amber-700">
                    CEP não encontrado. Confira o número ou preencha o endereço manualmente.
                  </p>
                ) : null}
                {postalCodeLookupState === "error" ? (
                  <p id="postalCode-lookup-feedback" role="status" className="mt-2 text-sm text-slate-600">
                    Não foi possível buscar o CEP agora. Continue preenchendo o endereço manualmente.
                  </p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="addressLine" className="text-sm font-semibold text-slate-800">Endereço</label>
                <input id="addressLine" type="text" maxLength={255} autoComplete="address-line1" placeholder="Rua, avenida ou travessa" aria-invalid={Boolean(errors.location?.addressLine)} aria-describedby={errors.location?.addressLine ? "addressLine-error" : undefined} className={fieldClassName} {...register("location.addressLine")} />
                <FieldError id="addressLine-error" message={errors.location?.addressLine?.message} />
              </div>
              <div>
                <label htmlFor="addressNumber" className="text-sm font-semibold text-slate-800">Número</label>
                <input id="addressNumber" type="text" maxLength={32} aria-invalid={Boolean(errors.location?.addressNumber)} aria-describedby={errors.location?.addressNumber ? "addressNumber-error" : undefined} className={fieldClassName} {...register("location.addressNumber")} />
                <FieldError id="addressNumber-error" message={errors.location?.addressNumber?.message} />
              </div>
              <div>
                <label htmlFor="addressComplement" className="text-sm font-semibold text-slate-800">Complemento <span className="font-normal text-slate-500">(opcional)</span></label>
                <input id="addressComplement" type="text" maxLength={255} autoComplete="address-line2" aria-invalid={Boolean(errors.location?.addressComplement)} aria-describedby={errors.location?.addressComplement ? "addressComplement-error" : undefined} className={fieldClassName} {...register("location.addressComplement")} />
                <FieldError id="addressComplement-error" message={errors.location?.addressComplement?.message} />
              </div>
            </div>
          </fieldset>

          {formMessage ? (
            <div role={submissionState === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-4 ${submissionState === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {submissionState === "success" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : null}
              <p className="font-medium leading-6">{formMessage}</p>
            </div>
          ) : null}

          <button type="submit" disabled={isSubmitting || categoriesState !== "success"} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto">
            {isSubmitting ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Send aria-hidden="true" className="size-5" />}
            {isSubmitting ? "Salvando..." : "Salvar como rascunho"}
          </button>
        </form>
      </div>
    </main>
  );
}