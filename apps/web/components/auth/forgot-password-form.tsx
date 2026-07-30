"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("Digite um e-mail válido."),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
    mode: "onSubmit",
  });

  function handleValidSubmit(): void {
    setFormMessage(
      "Solicitação validada. O envio do e-mail de recuperação será conectado à API em uma próxima etapa.",
    );
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
          htmlFor="email"
          className="block text-sm font-semibold text-slate-800"
        >
          E-mail da conta
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
            aria-describedby={errors.email ? "email-error" : "email-help"}
            {...register("email")}
          />
        </div>

        <p id="email-help" className="mt-2 text-sm leading-6 text-slate-500">
          Informe o mesmo e-mail utilizado no cadastro da Soravi.
        </p>

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
        Enviar instruções
      </button>

      <p className="text-center text-sm text-slate-600">
        Lembrou sua senha?{" "}
        <Link
          href="/entrar"
          className="font-semibold text-blue-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Voltar para entrar
        </Link>
      </p>
    </form>
  );
}