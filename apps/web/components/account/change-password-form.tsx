"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import {
  CurrentUserPasswordApiError,
  updateCurrentUserPassword,
} from "../../lib/current-user-password";
import {
  PASSWORD_HELP_TEXT,
  PASSWORD_MAX_LENGTH,
  passwordValidationMessage,
} from "../../lib/password-policy";
import { z } from "../../lib/zod";
import { useAuth } from "../auth/auth-provider";

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Informe sua senha atual.")
      .max(PASSWORD_MAX_LENGTH, "A senha atual deve ter no máximo 128 caracteres."),
    newPassword: z.string().superRefine((value, context) => {
      const message = passwordValidationMessage(value);

      if (message) {
        context.addIssue({ code: "custom", message });
      }
    }),
    newPasswordConfirmation: z.string().min(1, "Confirme a nova senha."),
  })
  .superRefine((value, context) => {
    if (
      value.newPasswordConfirmation &&
      value.newPassword !== value.newPasswordConfirmation
    ) {
      context.addIssue({
        code: "custom",
        path: ["newPasswordConfirmation"],
        message: "As senhas não são iguais.",
      });
    }
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const {
    accessToken,
    isAuthenticated,
    isLoading,
    refreshSession,
  } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirmation, setShowNewPasswordConfirmation] =
    useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/entrar");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleValidSubmit(data: ChangePasswordFormData): Promise<void> {
    setFormError(null);
    setFormMessage(null);

    if (!accessToken) {
      setFormError("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }

    try {
      await updateCurrentUserPassword(accessToken, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      reset();
      setFormMessage(
        "Senha alterada com sucesso. As outras sessões da sua conta foram encerradas por segurança.",
      );
    } catch (error) {
      if (error instanceof CurrentUserPasswordApiError) {
        handleApiError(error);
        return;
      }

      setFormError(
        "Não foi possível alterar sua senha agora. Tente novamente em instantes.",
      );
    }
  }

  function handleInvalidSubmit(): void {
    setFormError(null);
    setFormMessage(null);
  }

  function handleApiError(error: CurrentUserPasswordApiError): void {
    if (error.status === 401) {
      reset();
      setFormError(error.message);
      void refreshSession();
      return;
    }

    if (error.code === "INVALID_CURRENT_PASSWORD") {
      setError("currentPassword", { type: "server", message: error.message });
      return;
    }

    if (
      error.code === "NEW_PASSWORD_MUST_DIFFER" ||
      error.code === "PASSWORD_TOO_COMMON"
    ) {
      setError("newPassword", { type: "server", message: error.message });
      return;
    }

    setFormError(error.message);
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Carregando dados da sua conta...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Redirecionando para entrar...
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      noValidate
    >
      <PasswordField
        id="currentPassword"
        label="Senha atual"
        autoComplete="current-password"
        placeholder="Digite sua senha atual"
        show={showCurrentPassword}
        setShow={setShowCurrentPassword}
        error={errors.currentPassword?.message}
        registration={register("currentPassword")}
      />

      <PasswordField
        id="newPassword"
        label="Nova senha"
        autoComplete="new-password"
        placeholder="Digite a nova senha"
        show={showNewPassword}
        setShow={setShowNewPassword}
        error={errors.newPassword?.message}
        describedBy="newPassword-help"
        registration={register("newPassword")}
      />

      <p id="newPassword-help" className="text-sm leading-6 text-slate-600">
        {PASSWORD_HELP_TEXT}
      </p>

      <PasswordField
        id="newPasswordConfirmation"
        label="Confirmar nova senha"
        autoComplete="new-password"
        placeholder="Digite a nova senha novamente"
        show={showNewPasswordConfirmation}
        setShow={setShowNewPasswordConfirmation}
        error={errors.newPasswordConfirmation?.message}
        registration={register("newPasswordConfirmation")}
      />

      {formMessage ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
        >
          {formMessage}
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
        >
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !accessToken}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        {isSubmitting ? "Alterando senha..." : "Alterar senha"}
      </button>
    </form>
  );
}

interface PasswordFieldProps {
  id: keyof ChangePasswordFormData;
  label: string;
  autoComplete: string;
  placeholder: string;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  error?: string;
  describedBy?: string;
  registration: UseFormRegisterReturn;
}

function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
  show,
  setShow,
  error,
  describedBy,
  registration,
}: PasswordFieldProps) {
  const errorId = `${id}-error`;
  const ariaDescribedBy = [describedBy, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>

      <div className="relative mt-2">
        <LockKeyhole
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
        />

        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={ariaDescribedBy}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          {...registration}
        />

        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={show}
          onClick={() => setShow((currentValue) => !currentValue)}
        >
          {show ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}