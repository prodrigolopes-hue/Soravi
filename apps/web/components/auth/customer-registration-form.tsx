"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const phonePattern = /^\d{10,11}$/;

const customerRegistrationSchema = z
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
      .transform((value) => value.replace(/\D/g, ""))
      .refine(
        (value) => phonePattern.test(value),
        "Digite um telefone com DDD.",
      ),
    password: z
      .string()
      .min(1, "Crie uma senha.")
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .regex(/[a-z]/, "A senha deve possuir uma letra minúscula.")
      .regex(/[A-Z]/, "A senha deve possuir uma letra maiúscula.")
      .regex(/\d/, "A senha deve possuir pelo menos um número."),
    passwordConfirmation: z
      .string()
      .min(1, "Confirme sua senha."),
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

type CustomerRegistrationFormData = z.infer<
  typeof customerRegistrationSchema
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

export function CustomerRegistrationForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CustomerRegistrationFormData>({
    resolver: zodResolver(customerRegistrationSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      passwordConfirmation: "",
      acceptedTerms: false,
    },
    mode: "onSubmit",
  });

  function handleValidSubmit(): void {
    setFormMessage(
      "Cadastro validado. A criação da conta será conectada à API em uma próxima etapa.",
    );
  }

  function handleInvalidSubmit(): void {
    setFormMessage(null);
  }

  const phoneField = register("phone");

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
              const formattedPhone = formatPhone(event.target.value);

              setValue("phone", formattedPhone, {
                shouldDirty: true,
                shouldValidate: false,
              });
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
          Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.
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
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Criar conta de cliente
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