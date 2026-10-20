"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  personalIdentityRecordingUrl,
  personalIdentityStatusUrl,
} from "../../lib/api";

type PersonalIdentityStatus =
  | { kind: "loading"; sessionKey: string }
  | { kind: "not-recorded"; sessionKey: string }
  | { kind: "recorded"; sessionKey: string }
  | { kind: "error"; sessionKey: string };

type SubmissionState = "idle" | "submitting";

const unexpectedSubmissionMessage = "Não foi possível concluir o cadastro do CPF agora.";

export function PersonalIdentityCollection({
  accessToken,
  userId,
}: {
  accessToken: string;
  userId: string;
}) {
  const sessionKey = useMemo(() => `${userId}:${accessToken}`, [accessToken, userId]);
  const activeSessionKey = useRef<string | null>(null);
  const postController = useRef<AbortController | null>(null);
  const statusRequestVersion = useRef(0);
  const preserveSubmissionMessageOnRefresh = useRef(false);
  const [status, setStatus] = useState<PersonalIdentityStatus>({ kind: "loading", sessionKey: "" });
  const [cpf, setCpf] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [refreshAttempt, setRefreshAttempt] = useState(0);

  const refreshStatus = useCallback((clearSubmissionMessage = true) => {
    if (clearSubmissionMessage) setSubmissionMessage(null);
    preserveSubmissionMessageOnRefresh.current = !clearSubmissionMessage;
    setRefreshAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const requestSessionKey = sessionKey;
    const requestVersion = ++statusRequestVersion.current;
    const preserveSubmissionMessage = preserveSubmissionMessageOnRefresh.current;
    preserveSubmissionMessageOnRefresh.current = false;

    postController.current?.abort();
    postController.current = null;
    activeSessionKey.current = requestSessionKey;
    setCpf("");
    setSubmissionState("idle");
    if (!preserveSubmissionMessage) setSubmissionMessage(null);
    setStatus({ kind: "loading", sessionKey: requestSessionKey });

    void fetch(personalIdentityStatusUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Personal identity status request failed.");
        const payload: unknown = await response.json();
        if (!isPersonalIdentityStatusResponse(payload)) {
          throw new Error("Invalid personal identity status response.");
        }
        return payload;
      })
      .then((payload) => {
        if (
          !isCurrent ||
          activeSessionKey.current !== requestSessionKey ||
          statusRequestVersion.current !== requestVersion
        ) return;
        setStatus({
          kind: payload.recorded ? "recorded" : "not-recorded",
          sessionKey: requestSessionKey,
        });
      })
      .catch(() => {
        if (
          isCurrent &&
          !controller.signal.aborted &&
          activeSessionKey.current === requestSessionKey &&
          statusRequestVersion.current === requestVersion
        ) {
          setStatus({ kind: "error", sessionKey: requestSessionKey });
        }
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [accessToken, refreshAttempt, sessionKey]);

  useEffect(() => () => postController.current?.abort(), []);

  const visibleStatus =
    activeSessionKey.current === sessionKey && status.sessionKey === sessionKey
      ? status
      : { kind: "loading" as const, sessionKey };
  const visibleCpf = activeSessionKey.current === sessionKey ? cpf : "";
  const visibleSubmissionMessage =
    activeSessionKey.current === sessionKey ? submissionMessage : null;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (
      submissionState === "submitting" ||
      visibleStatus.kind !== "not-recorded" ||
      activeSessionKey.current !== sessionKey
    ) {
      return;
    }

    const requestSessionKey = sessionKey;
    const controller = new AbortController();
    statusRequestVersion.current += 1;
    postController.current?.abort();
    postController.current = controller;
    setSubmissionState("submitting");
    setSubmissionMessage(null);

    try {
      const response = await fetch(personalIdentityRecordingUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ cpf: visibleCpf }),
      });

      if (activeSessionKey.current !== requestSessionKey) return;

      if (response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        if (
          controller.signal.aborted ||
          activeSessionKey.current !== requestSessionKey
        ) return;
        if (!isPersonalIdentityRecordingResponse(payload)) {
          setSubmissionMessage(unexpectedSubmissionMessage);
          refreshStatus(false);
          return;
        }
        setCpf("");
        setStatus({ kind: "recorded", sessionKey: requestSessionKey });
        return;
      }

      setSubmissionMessage(messageForStatus(response.status));
      if (response.status >= 500) {
        refreshStatus(false);
      }
    } catch {
      if (controller.signal.aborted || activeSessionKey.current !== requestSessionKey) return;
      setSubmissionMessage(unexpectedSubmissionMessage);
      // The server may have persisted the CPF despite a network failure.
      refreshStatus(false);
    } finally {
      if (activeSessionKey.current === requestSessionKey) {
        setSubmissionState("idle");
      }
      if (postController.current === controller) {
        postController.current = null;
      }
    }
  }

  return (
    <section
      className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      aria-labelledby="personal-identity-title"
    >
      <h2 id="personal-identity-title" className="text-xl font-bold text-slate-950">
        CPF para verificação profissional
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Seu CPF é usado no processo de verificação profissional, permanece privado e seu cadastro não significa que sua identidade foi verificada.
      </p>

      {visibleStatus.kind === "loading" ? (
        <p className="mt-4 text-sm text-slate-600" aria-live="polite">
          Consultando cadastro do CPF...
        </p>
      ) : null}

      {visibleStatus.kind === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3" aria-live="polite">
          <p className="text-sm text-slate-700">Não foi possível consultar o cadastro do CPF.</p>
          <button
            type="button"
            onClick={() => refreshStatus()}
            className="min-h-11 rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {visibleStatus.kind === "recorded" ? (
        <p className="mt-4 font-semibold text-emerald-800" aria-live="polite">
          CPF cadastrado para verificação
        </p>
      ) : null}

      {visibleSubmissionMessage ? (
        <p id="professional-verification-cpf-message" role="alert" className="mt-3 text-sm font-medium text-red-700">
          {visibleSubmissionMessage}
        </p>
      ) : null}

      {visibleStatus.kind === "not-recorded" ? (
        <form className="mt-5" onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor="professional-verification-cpf" className="block text-sm font-semibold text-slate-800">
            CPF
          </label>
          <input
            id="professional-verification-cpf"
            name="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            value={visibleCpf}
            onChange={(event) => {
              if (activeSessionKey.current !== sessionKey) return;
              setCpf(event.target.value);
              setSubmissionMessage(null);
            }}
            aria-describedby="professional-verification-cpf-help professional-verification-cpf-message"
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
          <p id="professional-verification-cpf-help" className="mt-2 text-sm leading-6 text-slate-600">
            Informe apenas os dígitos ou use a pontuação habitual.
          </p>
          <button
            type="submit"
            disabled={submissionState === "submitting"}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submissionState === "submitting" ? "Cadastrando..." : "Cadastrar CPF"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function isPersonalIdentityStatusResponse(
  value: unknown,
): value is { recorded: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    "recorded" in value &&
    typeof value.recorded === "boolean"
  );
}

function isPersonalIdentityRecordingResponse(
  value: unknown,
): value is { recorded: true } {
  return (
    typeof value === "object" &&
    value !== null &&
    "recorded" in value &&
    value.recorded === true
  );
}

function messageForStatus(status: number): string {
  if (status === 400) return "Informe um CPF válido.";
  if (status === 409) return "Não foi possível usar os dados informados.";
  if (status === 429) return "Você atingiu o limite de tentativas. Aguarde antes de tentar novamente.";
  if (status === 503) return "O cadastro de CPF está indisponível no momento.";
  return unexpectedSubmissionMessage;
}
