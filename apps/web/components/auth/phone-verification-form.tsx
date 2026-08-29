"use client";

import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  confirmPhoneVerification,
  PhoneVerificationApiError,
  requestPhoneVerification,
} from "../../lib/phone-verification";
import { useAuth } from "./auth-provider";
import {
  phoneVerificationDestination,
  sanitizeVerificationCode,
} from "./phone-verification-routing";

const RESEND_COOLDOWN_SECONDS = 60;
const GENERIC_ERROR_MESSAGE =
  "Não foi possível concluir a verificação agora. Tente novamente em instantes.";

function publicErrorMessage(error: unknown): string {
  return error instanceof PhoneVerificationApiError
    ? error.message
    : GENERIC_ERROR_MESSAGE;
}

export function PhoneVerificationForm() {
  const router = useRouter();
  const {
    accessToken,
    isAuthenticated,
    isLoading,
    refreshSession,
    user,
  } = useAuth();
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);
  const confirmationInFlightRef = useRef(false);

  const destination = phoneVerificationDestination(user?.roles ?? []);
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !accessToken || !user) {
      router.replace("/entrar");
      return;
    }

    if (isAdmin || user.phoneVerified) {
      router.replace(destination);
    }
  }, [accessToken, destination, isAdmin, isAuthenticated, isLoading, router, user]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearTimeout(timerId);
  }, [cooldownSeconds]);

  async function handleRequestCode(): Promise<void> {
    if (
      requestInFlightRef.current ||
      !accessToken ||
      cooldownSeconds > 0
    ) {
      return;
    }

    requestInFlightRef.current = true;
    setIsRequesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await requestPhoneVerification(accessToken);
      setCodeSent(true);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setErrorMessage(publicErrorMessage(error));
    } finally {
      requestInFlightRef.current = false;
      setIsRequesting(false);
    }
  }

  async function handleConfirmCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (confirmationInFlightRef.current || !accessToken) {
      return;
    }

    if (!/^\d{6}$/u.test(code)) {
      setErrorMessage("Digite os 6 dígitos do código de verificação.");
      return;
    }

    confirmationInFlightRef.current = true;
    setIsConfirming(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await confirmPhoneVerification(accessToken, code);
      setCode("");
      setSuccessMessage("Telefone verificado com sucesso.");
      await refreshSession();
      router.replace(destination);
    } catch (error) {
      setErrorMessage(publicErrorMessage(error));
    } finally {
      confirmationInFlightRef.current = false;
      setIsConfirming(false);
    }
  }

  if (
    isLoading ||
    !isAuthenticated ||
    !accessToken ||
    !user ||
    isAdmin ||
    user.phoneVerified
  ) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-slate-600" role="status">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            <span>Carregando verificação...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <section
          aria-labelledby="phone-verification-title"
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8"
        >
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <MessageCircle aria-hidden="true" className="size-6" />
          </div>

          <h1
            id="phone-verification-title"
            className="mt-5 text-3xl font-bold tracking-tight text-slate-950"
          >
            Verifique seu telefone
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Enviaremos um código de 6 dígitos para o seu WhatsApp.
          </p>

          <div aria-live="polite">
            {successMessage ? (
              <div className="mt-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <span>{successMessage}</span>
              </div>
            ) : null}

            {errorMessage ? (
              <div
                id="phone-verification-error"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {errorMessage}
              </div>
            ) : null}
          </div>

          {!codeSent ? (
            <button
              type="button"
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRequesting}
              onClick={() => void handleRequestCode()}
            >
              {isRequesting ? (
                <>
                  <Loader2 aria-hidden="true" className="size-5 animate-spin" />
                  <span>Enviando código...</span>
                </>
              ) : (
                "Enviar código"
              )}
            </button>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleConfirmCode} noValidate>
              <div>
                <label
                  htmlFor="phone-verification-code"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Código de verificação
                </label>
                <input
                  id="phone-verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  aria-describedby={errorMessage ? "phone-verification-error" : "phone-verification-hint"}
                  aria-invalid={Boolean(errorMessage)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-2xl font-semibold tracking-[0.35em] text-slate-950 outline-none transition focus:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  onChange={(event) => {
                    setCode(sanitizeVerificationCode(event.target.value));
                    setErrorMessage(null);
                  }}
                />
                <p id="phone-verification-hint" className="mt-2 text-sm text-slate-600">
                  O código é válido por alguns minutos.
                </p>
              </div>

              <button
                type="submit"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-5 animate-spin" />
                    <span>Confirmando código...</span>
                  </>
                ) : (
                  "Confirmar código"
                )}
              </button>

              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-500"
                disabled={isRequesting || cooldownSeconds > 0}
                onClick={() => void handleRequestCode()}
              >
                {isRequesting
                  ? "Reenviando código..."
                  : cooldownSeconds > 0
                    ? `Reenviar código em ${cooldownSeconds}s`
                    : "Reenviar código"}
              </button>

              <p className="sr-only" aria-live="polite">
                {cooldownSeconds > 0
                  ? `Você poderá reenviar o código em ${cooldownSeconds} segundos.`
                  : "Você já pode reenviar o código."}
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
