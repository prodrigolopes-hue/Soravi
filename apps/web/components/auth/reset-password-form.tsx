"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, "Crie uma nova senha.")
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .regex(/[a-z]/, "A senha deve possuir uma letra minúscula.")
      .regex(/[A-Z]/, "A senha deve possuir uma letra maiúscula.")
      .regex(/\d/, "A senha deve possuir pelo menos um número."),
    passwordConfirmation: z
      .string()
      .min(1, "Confirme sua nova senha."),
  })
  .refine(
    (values) => values.password === values.passwordConfirmation,
    {
      message: "As senhas não são iguais.",
      path: ["passwordConfirmation"],
    },
  );

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  token: string | null;
}

export function ResetPasswordForm({
  token,
}: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const hasToken = Boolean(token);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      passwordConfirmation: "",
    },
    mode: "onSubmit",
  });

  function handleValidSubmit(): void {
    if (!hasToken) {
      setFormMessage(null);
      return;
    }

    setFormMessage(
      "Nova senha validada. A alteração da senha será conectada à API em uma próxima etapa.",
    );
  }

  function handleInvalidSubmit(): void {
    setFormMessage(null);
  }

  if (!hasToken) {
    return (
      <div className="mt-8">
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
        >
          Este link de redefinição não possui um token válido. Solicite um novo
          link de recuperação de senha.
        </div>

        <Link
          href="/recuperar-senha"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      noValidate
    >
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-slate-800"
        >
          Nova senha
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
            placeholder="Crie uma nova senha"
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
            onClick={() =>
              setShowPassword((currentValue) => !currentValue)
            }
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>

        <p
          id="password-help"
          className="mt-2 text-xs leading-5 text-slate-500"
        >
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
          Confirmar nova senha
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
            placeholder="Digite a nova senha novamente"
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
              setShowPasswordConfirmation(
                (currentValue) => !currentValue,
              )
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

      {formMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800"
        >
          {formMessage}
        </div>
      ) : null}

      <button
        type="submit"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Redefinir senha
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