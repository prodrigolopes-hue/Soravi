"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { apiBaseUrl } from "../../lib/api";

type State = "loading" | "success" | "invalid" | "missing";

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const token = parameters.get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token || !/^[A-Za-z0-9_-]{43}$/u.test(token)) {
      setState("missing");
      return;
    }

    void fetch(`${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/auth/email-verification/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    }).then((response) => setState(response.ok ? "success" : "invalid"))
      .catch(() => setState("invalid"));
  }, []);

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
        <h1 className="text-2xl font-bold text-slate-950">Confirmacao de e-mail</h1>
        {state === "loading" ? <p className="mt-3 text-slate-600">Confirmando seu e-mail...</p> : null}
        {state === "success" ? <p className="mt-3 text-emerald-800">E-mail confirmado. Voce ja pode entrar na sua conta.</p> : null}
        {state === "invalid" ? <p className="mt-3 text-red-700">Este link e invalido ou expirou. Solicite um novo link.</p> : null}
        {state === "missing" ? <p className="mt-3 text-slate-700">Abra o link completo enviado para seu e-mail.</p> : null}
        {state !== "success" ? (
          <form className="mt-5" onSubmit={(event) => void requestNewLink(event)}>
            <label htmlFor="verification-email" className="block text-sm font-semibold text-slate-800">E-mail</label>
            <input id="verification-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={resendState !== "idle"} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
            <button type="submit" disabled={resendState !== "idle"} className="mt-3 min-h-11 rounded-xl border border-blue-700 px-4 py-2 font-semibold text-blue-700 disabled:opacity-60">{resendState === "sending" ? "Enviando..." : "Enviar novo link"}</button>
            {resendState === "sent" ? <p className="mt-3 text-sm text-slate-700">Se houver uma conta nao confirmada com este e-mail, enviaremos as instrucoes.</p> : null}
          </form>
        ) : null}
        <Link href="/entrar" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white">Entrar</Link>
      </section>
    </main>
  );
}
