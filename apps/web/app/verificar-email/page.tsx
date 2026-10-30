"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "../../components/auth/auth-provider";
import { phoneVerificationDestination } from "../../components/auth/phone-verification-routing";
import { apiBaseUrl } from "../../lib/api";
import { safeDirectedRequestReturnTo, withDirectedRequestReturnTo } from "../../lib/directed-service-request";
import {
  confirmationSessionState,
  type ConfirmationSessionState,
} from "./confirmation-session-state";

type State = "loading" | "registration" | "invalid" | "missing" | "success";

export default function VerifyEmailPage() {
  const { accessToken, isAuthenticated, isLoading, signOut, user } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sessionState, setSessionState] = useState<ConfirmationSessionState | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [loginHref, setLoginHref] = useState("/entrar");
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const hasStartedConfirmation = useRef(false);

  useEffect(() => {
    const receivedToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    const fromRegistration = new URLSearchParams(window.location.search).get("from") === "registration";
    const returnTo = safeDirectedRequestReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    setReturnTo(returnTo);
    setLoginHref(withDirectedRequestReturnTo("/entrar", returnTo));
    window.history.replaceState(null, "", window.location.pathname);
    if (!receivedToken || !/^[A-Za-z0-9_-]{43}$/u.test(receivedToken)) {
      setState(fromRegistration ? "registration" : "missing");
      return;
    }
    setToken(receivedToken);
  }, []);

  useEffect(() => {
    if (email.length === 0 && user?.email) setEmail(user.email);
  }, [email.length, user?.email]);

  useEffect(() => {
    if (!token || isLoading || hasStartedConfirmation.current) return;
    hasStartedConfirmation.current = true;
    const hasSession = isAuthenticated && Boolean(accessToken);
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (hasSession && accessToken) headers.Authorization = `Bearer ${accessToken}`;

    void fetch(`${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/auth/email-verification/confirm`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token }),
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Email verification failed.");
        const payload: unknown = await response.json().catch(() => null);
        const nextSessionState = confirmationSessionState(hasSession, getCurrentSessionMatches(payload));
        if (nextSessionState === "other-account") await signOut();
        setSessionState(nextSessionState);
        setState("success");
      })
      .catch(() => setState("invalid"));
  }, [accessToken, isAuthenticated, isLoading, signOut, token]);

  async function requestNewLink(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch(`${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/auth/email-verification/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      });
    } finally {
      setResendState("sent");
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
        <h1 className="text-2xl font-bold text-slate-950">Confirmação de e-mail</h1>
        {state === "loading" ? <p className="mt-3 text-slate-600">Confirmando seu e-mail...</p> : null}
        {state === "registration" ? <p className="mt-3 leading-6 text-slate-700">Cadastro concluído. Confira seu e-mail e a caixa de spam para encontrar o link de confirmação. Se não o receber, solicite um novo link abaixo.</p> : null}
        {state === "invalid" ? <p className="mt-3 text-red-700">Este link é inválido ou expirou. Solicite um novo link.</p> : null}
        {state === "missing" ? <p className="mt-3 text-slate-700">Abra o link completo enviado para seu e-mail.</p> : null}
        {state === "success" && sessionState === "current-account" ? <><p className="mt-3 text-emerald-800">E-mail confirmado. Sua sessão foi mantida.</p>{user?.roles.includes("PROFESSIONAL") && user.professionalRegistrationCompleted === false ? <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950"><h2 className="font-semibold">Complete seu cadastro profissional</h2><p className="mt-2 text-sm leading-6">Cadastre seu CPF e envie um documento com foto para a análise privada. Isso não significa aprovação automática da identidade.</p><div className="mt-4 flex flex-wrap gap-3"><ResultLink href="/profissional/perfil" label="Completar cadastro" compact /><ResultLink href={phoneVerificationDestination(user.roles, returnTo)} label="Fazer depois" compact /></div></div> : <ResultLink href="/conta" label="Ir para minha conta" />}</> : null}
        {state === "success" && sessionState === "other-account" ? <><p className="mt-3 text-emerald-800">E-mail confirmado. Para proteger as contas, encerramos somente a sessão que estava aberta neste navegador. Entre na conta correspondente.</p><ResultLink href={loginHref} label="Entrar" /></> : null}
        {state === "success" && sessionState === "signed-out" ? <><p className="mt-3 text-emerald-800">E-mail confirmado.</p><ResultLink href={loginHref} label="Entrar" /></> : null}
        {state !== "success" ? (
          <form className="mt-5" onSubmit={(event) => void requestNewLink(event)}>
            <label htmlFor="verification-email" className="block text-sm font-semibold text-slate-800">E-mail</label>
            <input id="verification-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={resendState !== "idle"} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
            <button type="submit" disabled={resendState !== "idle"} className="mt-3 min-h-11 rounded-xl border border-blue-700 px-4 py-2 font-semibold text-blue-700 disabled:opacity-60">{resendState === "sending" ? "Enviando..." : "Enviar novo link"}</button>
            {resendState === "sent" ? <p className="mt-3 text-sm text-slate-700">Se houver uma conta não confirmada com este e-mail, enviaremos as instruções.</p> : null}
          </form>
        ) : null}
        {state !== "success" ? <ResultLink href={loginHref} label="Entrar" /> : null}
      </section>
    </main>
  );
}

function getCurrentSessionMatches(payload: unknown): boolean | null {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) return null;
  const data = payload.data;
  if (typeof data !== "object" || data === null || !("currentSessionMatches" in data)) return null;
  return typeof data.currentSessionMatches === "boolean" ? data.currentSessionMatches : null;
}

function ResultLink({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  return <Link href={href} className={`${compact ? "" : "mt-6 "}inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white`}>{label}</Link>;
}
