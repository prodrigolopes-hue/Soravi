"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BriefcaseBusiness,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { apiBaseUrl, categoriesUrl } from "../../lib/api";
import { LEGAL_DOCUMENT_VERSIONS } from "../../lib/legal-document-versions";

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
}

type CategoriesLoadState =
  | "loading"
  | "success"
  | "empty"
  | "error";

function isServiceCategory(value: unknown): value is ServiceCategory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ServiceCategory>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.slug === "string" &&
    (typeof candidate.description === "string" || candidate.description === null) &&
    (typeof candidate.icon === "string" || candidate.icon === null) &&
    typeof candidate.displayOrder === "number" &&
    Number.isInteger(candidate.displayOrder)
  );
}

const professionalRegistrationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Informe seu nome completo.")
      .min(3, "O nome deve ter pelo menos 3 caracteres."),
    email: z
      .string()
      .trim()
      .min(1, "Informe seu e-mail.")
      .email("Digite um e-mail válido."),
    phone: z
      .string()
      .trim()
      .min(1, "Informe seu telefone.")
      .refine(
        (value) => /^\d{10,11}$/.test(value.replace(/\D/g, "")),
        "Digite um telefone com DDD.",
      ),
    professionalTitle: z
      .string()
      .trim()
      .min(1, "Informe seu serviço principal.")
      .min(3, "O serviço principal deve ter pelo menos 3 caracteres.")
      .max(80, "Use no máximo 80 caracteres."),
    serviceArea: z
      .string()
      .trim()
      .min(1, "Informe sua cidade ou região de atendimento.")
      .min(2, "Informe uma região válida.")
      .max(100, "Use no máximo 100 caracteres."),
    description: z
      .string()
      .trim()
      .min(1, "Escreva uma descrição profissional.")
      .min(30, "A descrição deve ter pelo menos 30 caracteres.")
      .max(500, "A descrição deve ter no máximo 500 caracteres."),
    categories: z
      .array(z.string())
      .min(1, "Selecione pelo menos uma categoria.")
      .max(3, "Selecione no máximo três categorias."),
    password: z
      .string()
      .min(1, "Crie uma senha.")
      .min(12, "A senha deve ter pelo menos 12 caracteres.")
      .regex(/[a-z]/, "A senha deve possuir uma letra minúscula.")
      .regex(/[A-Z]/, "A senha deve possuir uma letra maiúscula.")
      .regex(/\d/, "A senha deve possuir pelo menos um número."),
    passwordConfirmation: z.string().min(1, "Confirme sua senha."),
    acceptedTerms: z.boolean().refine((value) => value, {
      message:
        "Você precisa aceitar os Termos de Uso e a Política de Privacidade.",
    }),
  })
  .refine(
    (values) => values.password === values.passwordConfirmation,
    {
      message: "As senhas não são iguais.",
      path: ["passwordConfirmation"],
    },
  );

type ProfessionalRegistrationFormData = z.infer<
  typeof professionalRegistrationSchema
>;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function ProfessionalRegistrationForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoriesLoadState, setCategoriesLoadState] =
    useState<CategoriesLoadState>("loading");

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<ProfessionalRegistrationFormData>({
    resolver: zodResolver(professionalRegistrationSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      professionalTitle: "",
      serviceArea: "",
      description: "",
      categories: [],
      password: "",
      passwordConfirmation: "",
      acceptedTerms: false,
    },
    mode: "onSubmit",
  });

  const descriptionLength = watch("description").length;
  const selectedCategories = watch("categories");
  const phoneField = register("phone");
  const categorySlugs = useMemo(
    () => new Set(categories.map((category) => category.slug)),
    [categories],
  );
  const selectedCategoryCount = selectedCategories.length;
  const canSubmitWithCategories =
    categoriesLoadState === "success" && categories.length > 0;

  useEffect(() => {
    const abortController = new AbortController();

    async function loadCategories(): Promise<void> {
      setCategoriesLoadState("loading");

      try {
        const response = await fetch(categoriesUrl, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          setCategories([]);
          setCategoriesLoadState("error");
          return;
        }

        const payload: unknown = await response.json();

        if (!Array.isArray(payload)) {
          setCategories([]);
          setCategoriesLoadState("error");
          return;
        }

        const parsedCategories = payload.filter(isServiceCategory);

        if (parsedCategories.length === 0) {
          setCategories([]);
          setCategoriesLoadState("empty");
          return;
        }

        setCategories(parsedCategories);
        setCategoriesLoadState("success");
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        setCategories([]);
        setCategoriesLoadState("error");
      }
    }

    void loadCategories();

    return () => {
      abortController.abort();
    };
  }, []);

  async function handleValidSubmit(
    data: ProfessionalRegistrationFormData,
  ): Promise<void> {
    if (!canSubmitWithCategories) {
      setError("categories", {
        type: "manual",
        message:
          "Não foi possível validar as categorias agora. Tente novamente em instantes.",
      });
      setFormMessage(null);
      return;
    }

    const hasInvalidCategory = data.categories.some(
      (categorySlug) => !categorySlugs.has(categorySlug),
    );

    if (hasInvalidCategory) {
      setError("categories", {
        type: "manual",
        message: "Selecione apenas categorias disponíveis.",
      });
      setFormMessage(null);
      return;
    }

    clearErrors("categories");

    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone,
            password: data.password,
            initialRole: "PROFESSIONAL",
            acceptedTermsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
            acceptedPrivacyPolicyVersion:
              LEGAL_DOCUMENT_VERSIONS.privacyPolicy,
            categorySlugs: data.categories,
          }),
        },
      );

      if (!response.ok) {
        setFormMessage(
          "Não foi possível concluir seu cadastro profissional no momento.",
        );
        return;
      }

      setFormMessage(
        "Cadastro profissional enviado com sucesso. Você já pode entrar na Soravi.",
      );
    } catch {
      setFormMessage(
        "Não foi possível conectar à Soravi. Tente novamente em instantes.",
      );
    }
  }

  function handleInvalidSubmit(): void {
    setFormMessage(null);
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      noValidate
    >
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-semibold text-slate-800"
        >
          Nome completo
        </label>

        <div className="relative mt-2">
          <UserRound
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />

          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Digite seu nome completo"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
        </div>

        {errors.name ? (
          <p
            id="name-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-slate-800"
        >
          E-mail
        </label>

        <div className="relative mt-2">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />

          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
        </div>

        {errors.email ? (
          <p
            id="email-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-semibold text-slate-800"
        >
          Telefone
        </label>

        <div className="relative mt-2">
          <Phone
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />

          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            maxLength={15}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            name={phoneField.name}
            ref={phoneField.ref}
            onBlur={phoneField.onBlur}
            onChange={(event) => {
              event.target.value = formatPhone(event.target.value);
              void phoneField.onChange(event);
            }}
          />
        </div>

        {errors.phone ? (
          <p
            id="phone-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.phone.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="professionalTitle"
          className="block text-sm font-semibold text-slate-800"
        >
          Serviço principal
        </label>

        <div className="relative mt-2">
          <BriefcaseBusiness
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />

          <input
            id="professionalTitle"
            type="text"
            placeholder="Exemplo: Eletricista residencial"
            maxLength={80}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.professionalTitle)}
            aria-describedby={
              errors.professionalTitle
                ? "professional-title-error"
                : undefined
            }
            {...register("professionalTitle")}
          />
        </div>

        {errors.professionalTitle ? (
          <p
            id="professional-title-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.professionalTitle.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="serviceArea"
          className="block text-sm font-semibold text-slate-800"
        >
          Cidade ou região de atendimento
        </label>

        <div className="relative mt-2">
          <MapPin
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />

          <input
            id="serviceArea"
            type="text"
            placeholder="Exemplo: São Paulo e região"
            maxLength={100}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.serviceArea)}
            aria-describedby={
              errors.serviceArea ? "service-area-error" : undefined
            }
            {...register("serviceArea")}
          />
        </div>

        {errors.serviceArea ? (
          <p
            id="service-area-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.serviceArea.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-semibold text-slate-800"
        >
          Descrição profissional
        </label>

        <textarea
          id="description"
          rows={5}
          maxLength={500}
          placeholder="Conte sobre sua experiência, especialidades e forma de trabalho."
          className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={
            errors.description
              ? "description-help description-error"
              : "description-help"
          }
          {...register("description")}
        />

        <div
          id="description-help"
          className="mt-2 flex items-center justify-between gap-4 text-xs text-slate-500"
        >
          <span>Mínimo de 30 caracteres.</span>
          <span>{descriptionLength}/500</span>
        </div>

        {errors.description ? (
          <p
            id="description-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">
          Categorias atendidas
        </legend>

        <p className="mt-1 text-sm text-slate-500">
          Selecione de uma a três categorias.
        </p>

        {categoriesLoadState === "loading" ? (
          <p className="mt-3 text-sm text-slate-500">
            Carregando categorias oficiais...
          </p>
        ) : null}

        {categoriesLoadState === "error" ? (
          <p className="mt-3 text-sm text-slate-500">
            Não foi possível carregar as categorias no momento.
          </p>
        ) : null}

        {categoriesLoadState === "empty" ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhuma categoria disponível no momento.
          </p>
        ) : null}

        {categoriesLoadState === "success" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {categories.map((category) => (
              (() => {
                const isSelected = selectedCategories.includes(category.slug);
                const isDisabled =
                  !canSubmitWithCategories ||
                  (!isSelected && selectedCategoryCount >= 3);

                return (
                  <label
                    key={category.id}
                    className={`flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors ${
                      isDisabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={category.slug}
                      className="size-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:cursor-not-allowed"
                      disabled={isDisabled}
                      {...register("categories")}
                    />

                    <span className="text-sm font-medium text-slate-700">
                      {category.name}
                    </span>
                  </label>
                );
              })()
            ))}
          </div>
        ) : null}

        {errors.categories ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {errors.categories.message}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-slate-800"
        >
          Senha
        </label>

        <div className="relative mt-2">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />

          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Crie uma senha"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password
                ? "password-help password-error"
                : "password-help"
            }
            {...register("password")}
          />

          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((currentValue) => !currentValue)}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>

        <p id="password-help" className="mt-2 text-xs leading-5 text-slate-500">
          Use pelo menos 12 caracteres, com letra maiúscula, minúscula e número.
        </p>

        {errors.password ? (
          <p
            id="password-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="passwordConfirmation"
          className="block text-sm font-semibold text-slate-800"
        >
          Confirmar senha
        </label>

        <div className="relative mt-2">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />

          <input
            id="passwordConfirmation"
            type={showPasswordConfirmation ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.passwordConfirmation)}
            aria-describedby={
              errors.passwordConfirmation
                ? "password-confirmation-error"
                : undefined
            }
            {...register("passwordConfirmation")}
          />

          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label={
              showPasswordConfirmation
                ? "Ocultar confirmação da senha"
                : "Mostrar confirmação da senha"
            }
            aria-pressed={showPasswordConfirmation}
            onClick={() =>
              setShowPasswordConfirmation((currentValue) => !currentValue)
            }
          >
            {showPasswordConfirmation ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>

        {errors.passwordConfirmation ? (
          <p
            id="password-confirmation-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.passwordConfirmation.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            aria-invalid={Boolean(errors.acceptedTerms)}
            aria-describedby={
              errors.acceptedTerms ? "accepted-terms-error" : undefined
            }
            {...register("acceptedTerms")}
          />

          <span className="text-sm leading-6 text-slate-600">
            Li e aceito os{" "}
            <Link
              href="/termos-de-uso"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link
              href="/politica-de-privacidade"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Política de Privacidade
            </Link>
            .
          </span>
        </label>

        {errors.acceptedTerms ? (
          <p
            id="accepted-terms-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-600"
          >
            {errors.acceptedTerms.message}
          </p>
        ) : null}
      </div>

      {formMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800"
        >
          {formMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmitWithCategories}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
      >
        Criar conta profissional
      </button>

      <p className="text-center text-sm text-slate-600">
        Já possui uma conta?{" "}
        <Link
          href="/entrar"
          className="font-semibold text-blue-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}