import { apiBaseUrl } from "./api";

export { passwordValidationMessage } from "./password-policy";

const confirmUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/auth/password-reset/confirm`;
const requestUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/auth/password-reset/request`;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export const passwordResetRequestSuccessMessage =
  "Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.";

export function passwordResetRequestErrorMessage(status: number): string {
  if (status === 429) {
    return "Muitas solicitações. Aguarde um pouco antes de tentar novamente.";
  }

  if (status === 400) {
    return "Digite um e-mail válido.";
  }

  return "Não foi possível processar sua solicitação agora. Tente novamente em instantes.";
}

export class PasswordResetRequestApiError extends Error {
  constructor(readonly status: number) {
    super(passwordResetRequestErrorMessage(status));
    this.name = "PasswordResetRequestApiError";
  }
}

export class PasswordResetApiError extends Error {
  constructor(readonly status: number, readonly code?: string) { super(passwordResetErrorMessage(status, code)); this.name = "PasswordResetApiError"; }
}

export function extractPasswordResetToken(fragment: string): string | null {
  if (!fragment.startsWith("#")) return null;
  const token = new URLSearchParams(fragment.slice(1)).get("token");
  return token && tokenPattern.test(token) ? token : null;
}

export function passwordConfirmationMessage(password: string, confirmation: string): string | null { return password === confirmation ? null : "As senhas não são iguais."; }

export function passwordResetErrorMessage(status: number, code?: string): string {
  if (code === "PASSWORD_RESET_INVALID_OR_EXPIRED") return "O link de redefinição é inválido ou expirou. Solicite um novo link.";
  if (code === "PASSWORD_TOO_COMMON") return "Escolha uma senha menos comum e difícil de adivinhar.";
  if (status === 429) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (status === 400) return "A nova senha deve ter de 12 a 128 caracteres.";
  return "Não foi possível redefinir sua senha agora. Tente novamente em instantes.";
}

function publicCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = payload as { code?: unknown; error?: { code?: unknown } };
  if (typeof value.code === "string") return value.code;
  return typeof value.error?.code === "string" ? value.error.code : undefined;
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  try {
    const response = await fetch(confirmUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword }) });
    if (response.status === 204) return;
    const payload: unknown = await response.json().catch(() => null);
    throw new PasswordResetApiError(response.status, publicCode(payload));
  } catch (error) {
    if (error instanceof PasswordResetApiError) throw error;
    throw new PasswordResetApiError(0);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    if (response.status === 202) return;
    throw new PasswordResetRequestApiError(response.status);
  } catch (error) {
    if (error instanceof PasswordResetRequestApiError) throw error;
    throw new PasswordResetRequestApiError(0);
  }
}
