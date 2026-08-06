"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import {
  type FieldErrors,
  type Path,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import {
  BriefcaseBusiness,
  Check,
  UserRound,
  UsersRound,
} from "lucide-react";

import { launchInterestsUrl } from "../../lib/api";

const launchInterestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(120, "O nome deve ter no máximo 120 caracteres."),

  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("Digite um e-mail válido."),

  phone: z
    .string()
    .trim()
    .max(32, "O telefone deve ter no máximo 32 caracteres.")
    .default(""),

  audienceType: z.enum([
    "CUSTOMER",
    "PROFESSIONAL",
    "BOTH",
  ]),

  city: z
    .string()
    .trim()
    .min(2, "A cidade deve ter pelo menos 2 caracteres.")
    .max(120, "A cidade deve ter no máximo 120 caracteres."),

  state: z
    .string()
    .trim()
    .max(2, "Informe uma UF válida com exatamente 2 letras.")
    .regex(
      /^$|^[A-Za-z]{2}$/,
      "Informe uma UF válida com exatamente 2 letras.",
    )
    .transform((value) =>
      value ? value.toUpperCase() : "",
    )
    .default(""),

  serviceInterest: z
    .string()
    .trim()
    .max(500, "O interesse deve ter no máximo 500 caracteres.")
    .default(""),

  professionalCategoryInterest: z
    .string()
    .trim()
    .max(500, "O interesse deve ter no máximo 500 caracteres.")
    .default(""),

  privacyNoticeAccepted: z
    .boolean()
    .refine(
      (value) => value === true,
      "Você precisa aceitar o aviso de privacidade.",
    )
    .default(false),

  marketingConsent: z.boolean().default(false),
});

type LaunchInterestFormInput = z.input<
  typeof launchInterestSchema
>;

export type LaunchInterestFormData = z.output<
  typeof launchInterestSchema
>;

const audienceOptions = [
  {
    value: "CUSTOMER",
    label: "Sou cliente",
    description:
      "Quero acompanhar a Soravi como quem busca serviços.",
    Icon: UserRound,
  },
  {
    value: "PROFESSIONAL",
    label: "Sou profissional",
    description:
      "Quero acompanhar a Soravi como quem oferece serviços.",
    Icon: BriefcaseBusiness,
  },
  {
    value: "BOTH",
    label: "Cliente e profissional",
    description:
      "Quero acompanhar a Soravi como cliente e profissional.",
    Icon: UsersRound,
  },
] as const;

export function LaunchInterestForm() {
  const [submissionState, setSubmissionState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: {
      errors,
      isSubmitting,
      isDirty,
    },
    reset,
  } = useForm<
    LaunchInterestFormInput,
    undefined,
    LaunchInterestFormData
  >({
    resolver: zodResolver(launchInterestSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      audienceType: "CUSTOMER",
      city: "",
      state: "",
      serviceInterest: "",
      professionalCategoryInterest: "",
      privacyNoticeAccepted: false,
      marketingConsent: false,
    },
    mode: "onTouched",
  });

  const audienceType = watch("audienceType");

  useEffect(() => {
    if (
      submissionState === "success" &&
      isDirty
    ) {
      setSubmissionState("idle");
      setErrorMessage(null);
    }
  }, [isDirty, submissionState]);

  function handleInvalidSubmit(
    validationErrors: FieldErrors<LaunchInterestFormInput>,
  ): void {
    const firstField = Object.keys(
      validationErrors,
    )[0] as Path<LaunchInterestFormInput> | undefined;

    if (firstField) {
      setFocus(firstField);
    }
  }

  async function onSubmit(
    data: LaunchInterestFormData,
  ): Promise<void> {
    setErrorMessage(null);
    setSubmissionState("submitting");

    const payload = {
      ...data,
      state: data.state || null,
      phone: data.phone || null,
      serviceInterest:
        data.serviceInterest || null,
      professionalCategoryInterest:
        data.professionalCategoryInterest || null,
      source: "HOME" as const,
      marketingConsent: Boolean(
        data.marketingConsent,
      ),
    };

    try {
      const response = await fetch(
        launchInterestsUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body: unknown = await response
          .json()
          .catch(() => null);

        const message =
          typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof body.message === "string"
            ? body.message
            : "Não foi possível registrar seu interesse no lançamento. Tente novamente mais tarde.";

        throw new Error(message);
      }

      setSubmissionState("success");
      reset();
    } catch (error: unknown) {
      setSubmissionState("error");

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar seu interesse no lançamento. Tente novamente mais tarde.",
      );
    }
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <div className="mb-8">
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
          Acompanhe o lançamento
        </span>

        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Seja avisado quando a Soravi estiver disponível.
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Deixe seu contato para ser avisado sobre o
          lançamento da Soravi. Você também poderá escolher
          se deseja receber novidades e oportunidades.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={handleSubmit(
          onSubmit,
          handleInvalidSubmit,
        )}
        noValidate
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-slate-900"
            >
              Nome
            </label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Seu nome completo"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name
                  ? "name-error"
                  : undefined
              }
              {...register("name")}
            />

            {errors.name ? (
              <p
                id="name-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-slate-900"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email
                  ? "email-error"
                  : undefined
              }
              {...register("email")}
            />

            {errors.email ? (
              <p
                id="email-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {errors.email.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-semibold text-slate-900"
            >
              Telefone (opcional)
            </label>

            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              maxLength={32}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={
                errors.phone
                  ? "phone-error"
                  : undefined
              }
              {...register("phone")}
            />

            {errors.phone ? (
              <p
                id="phone-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {errors.phone.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="city"
                className="block text-sm font-semibold text-slate-900"
              >
                Cidade
              </label>

              <input
                id="city"
                type="text"
                autoComplete="address-level2"
                placeholder="Sua cidade"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                aria-invalid={Boolean(errors.city)}
                aria-describedby={
                  errors.city
                    ? "city-error"
                    : undefined
                }
                {...register("city")}
              />

              {errors.city ? (
                <p
                  id="city-error"
                  role="alert"
                  className="mt-2 text-sm text-red-600"
                >
                  {errors.city.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="state"
                className="block text-sm font-semibold text-slate-900"
              >
                UF (opcional)
              </label>

              <input
                id="state"
                type="text"
                autoComplete="address-level1"
                placeholder="SP"
                maxLength={2}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 uppercase outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                aria-invalid={Boolean(errors.state)}
                aria-describedby={
                  errors.state
                    ? "state-error"
                    : undefined
                }
                onInput={(event) => {
                  event.currentTarget.value =
                    event.currentTarget.value.toUpperCase();
                }}
                {...register("state", {
                  setValueAs: (value: unknown) =>
                    typeof value === "string"
                      ? value.toUpperCase()
                      : value,
                })}
              />

              {errors.state ? (
                <p
                  id="state-error"
                  role="alert"
                  className="mt-2 text-sm text-red-600"
                >
                  {errors.state.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <fieldset
          className="space-y-4"
          aria-describedby={
            errors.audienceType
              ? "audienceType-error"
              : undefined
          }
        >
          <legend className="text-sm font-semibold text-slate-900">
            Público
          </legend>

          <div className="grid gap-3 sm:grid-cols-3">
            {audienceOptions.map((option) => {
              const selected =
                audienceType === option.value;

              const Icon = option.Icon;

              return (
                <label
                  key={option.value}
                  className={`group relative flex min-h-[4.5rem] cursor-pointer items-start rounded-3xl border p-4 transition focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 ${selected
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300"
                    }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value={option.value}
                    {...register("audienceType")}
                  />

                  <div className="flex w-full items-start gap-3">
                    <span
                      className={`mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border ${selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                        }`}
                    >
                      <Icon
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </span>

                    <div className="min-w-0">
                      <span
                        className={`block text-sm font-semibold ${selected
                          ? "text-blue-900"
                          : "text-slate-900"
                          }`}
                      >
                        {option.label}
                      </span>

                      <span
                        className={`mt-1 block text-sm leading-6 ${selected
                          ? "text-blue-700"
                          : "text-slate-600"
                          }`}
                      >
                        {option.description}
                      </span>
                    </div>

                    {selected ? (
                      <span className="ml-auto mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </span>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          {errors.audienceType ? (
            <p
              id="audienceType-error"
              role="alert"
              className="text-sm text-red-600"
            >
              {errors.audienceType.message}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="serviceInterest"
              className="block text-sm font-semibold text-slate-900"
            >
              Interesse de serviço (opcional)
            </label>

            <textarea
              id="serviceInterest"
              rows={3}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-invalid={Boolean(
                errors.serviceInterest,
              )}
              aria-describedby={
                errors.serviceInterest
                  ? "serviceInterest-error"
                  : undefined
              }
              {...register("serviceInterest")}
            />

            {errors.serviceInterest ? (
              <p
                id="serviceInterest-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {errors.serviceInterest.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="professionalCategoryInterest"
              className="block text-sm font-semibold text-slate-900"
            >
              Interesse como profissional (opcional)
            </label>

            <textarea
              id="professionalCategoryInterest"
              rows={3}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-invalid={Boolean(
                errors.professionalCategoryInterest,
              )}
              aria-describedby={
                errors.professionalCategoryInterest
                  ? "professionalCategoryInterest-error"
                  : undefined
              }
              {...register(
                "professionalCategoryInterest",
              )}
            />

            {errors.professionalCategoryInterest ? (
              <p
                id="professionalCategoryInterest-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {
                  errors
                    .professionalCategoryInterest
                    .message
                }
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              aria-invalid={Boolean(
                errors.privacyNoticeAccepted,
              )}
              aria-describedby={
                errors.privacyNoticeAccepted
                  ? "privacyNoticeAccepted-error"
                  : undefined
              }
              {...register(
                "privacyNoticeAccepted",
              )}
            />

            <span className="text-sm leading-7 text-slate-700">
              Li e aceito o{" "}
              <a
                href="/politica-de-privacidade"
                className="font-semibold text-blue-600 underline transition hover:text-blue-700"
              >
                aviso de privacidade
              </a>
              .
            </span>
          </label>

          {errors.privacyNoticeAccepted ? (
            <p
              id="privacyNoticeAccepted-error"
              role="alert"
              className="text-sm text-red-600"
            >
              {
                errors.privacyNoticeAccepted
                  .message
              }
            </p>
          ) : null}

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              {...register("marketingConsent")}
            />

            <span className="text-sm leading-7 text-slate-700">
              Quero receber atualizações por e-mail
              sobre novidades da Soravi.
            </span>
          </label>
        </div>

        {submissionState === "success" ? (
          <div
            role="status"
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
          >
            Seu interesse no lançamento da Soravi foi
            registrado.
          </div>
        ) : null}

        {submissionState === "error" &&
          errorMessage ? (
          <div
            role="alert"
            className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
          >
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            submissionState === "submitting" ||
            (submissionState === "success" &&
              !isDirty)
          }
          className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {submissionState === "submitting"
            ? "Registrando..."
            : submissionState === "success" &&
              !isDirty
              ? "Interesse registrado"
              : "Acompanhe o lançamento"}
        </button>
      </form>
    </div>
  );
}