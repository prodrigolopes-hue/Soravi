"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { confirmPasswordReset, extractPasswordResetToken, PasswordResetApiError, passwordConfirmationMessage, passwordValidationMessage } from "../../lib/password-reset";

const schema = z.object({
  password: z.string().superRefine((value, context) => { const message = passwordValidationMessage(value); if (message) context.addIssue({ code: "custom", message }); }),
  passwordConfirmation: z.string().min(1, "Confirme sua nova senha."),
}).refine((values) => !passwordConfirmationMessage(values.password, values.passwordConfirmation), { message: "As senhas não são iguais.", path: ["passwordConfirmation"] });
type FormData = z.infer<typeof schema>;
type TokenStatus = "capturing" | "ready" | "unavailable";
const unavailableLinkMessage = "Este link de redefinição é inválido ou não está mais disponível.";

export function ResetPasswordForm() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const capturedRef = useRef(false);
  const submittingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("capturing");
  const [unavailableMessage, setUnavailableMessage] = useState(unavailableLinkMessage);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { password: "", passwordConfirmation: "" }, mode: "onSubmit" });

  useEffect(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    const token = extractPasswordResetToken(window.location.hash);
    window.history.replaceState(window.history.state, "", window.location.pathname);
    tokenRef.current = token;
    setTokenStatus(token ? "ready" : "unavailable");
  }, []);

  useEffect(() => { if (formError) errorRef.current?.focus(); }, [formError]);

  async function submit(data: FormData): Promise<void> {
    const token = tokenRef.current;
    if (!token || submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    try {
      await confirmPasswordReset(token, data.password);
      reset();
      tokenRef.current = null;
      router.replace("/entrar");
    } catch (error) {
      const apiError = error instanceof PasswordResetApiError ? error : null;
      const message = apiError?.message ?? "Não foi possível redefinir sua senha agora. Tente novamente em instantes.";
      if (apiError?.code === "PASSWORD_RESET_INVALID_OR_EXPIRED") {
        tokenRef.current = null;
        reset();
        setUnavailableMessage(message);
        setTokenStatus("unavailable");
      } else setFormError(message);
    } finally { submittingRef.current = false; }
  }

  if (tokenStatus === "capturing") return <p className="mt-8 text-sm text-slate-600" role="status" aria-live="polite">Validando link...</p>;
  if (tokenStatus === "unavailable") return <div className="mt-8"><div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{unavailableMessage}</div><Link href="/recuperar-senha" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Solicitar novo link</Link></div>;

  return <form className="mt-8 space-y-5" onSubmit={handleSubmit(submit, () => setFormError(null))} noValidate>
    <PasswordField id="password" label="Nova senha" placeholder="Crie uma nova senha" show={showPassword} setShow={setShowPassword} error={errors.password?.message} describedBy="password-help" registration={register("password")} />
    <p id="password-help" className="-mt-3 text-xs leading-5 text-slate-500">Use de 12 a 128 caracteres, com pelo menos uma letra e um número.</p>
    <PasswordField id="passwordConfirmation" label="Confirmar nova senha" placeholder="Digite a nova senha novamente" show={showConfirmation} setShow={setShowConfirmation} error={errors.passwordConfirmation?.message} registration={register("passwordConfirmation")} />
    {formError ? <div ref={errorRef} role="alert" aria-live="assertive" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700 outline-none focus:ring-2 focus:ring-red-600">{formError}</div> : null}
    <button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400">{isSubmitting ? "Redefinindo..." : "Redefinir senha"}</button>
    <p className="text-center text-sm text-slate-600">Lembrou sua senha?{" "}<Link href="/entrar" className="font-semibold text-blue-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Voltar para entrar</Link></p>
  </form>;
}

interface FieldProps { id: string; label: string; placeholder: string; show: boolean; setShow: (value: boolean) => void; error?: string; describedBy?: string; registration: UseFormRegisterReturn; }
function PasswordField({ id, label, placeholder, show, setShow, error, describedBy, registration }: FieldProps) {
  const errorId = `${id}-error`;
  const ariaDescribedBy = [describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return <div><label htmlFor={id} className="block text-sm font-semibold text-slate-800">{label}</label><div className="relative mt-2"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input id={id} type={show ? "text" : "password"} autoComplete="new-password" placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={ariaDescribedBy} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" {...registration} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show} className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{show ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}</button></div>{error ? <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}</div>;
}
