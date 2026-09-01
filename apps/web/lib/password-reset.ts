import { apiBaseUrl } from "./api";

const confirmUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/auth/password-reset/confirm`;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export class PasswordResetApiError extends Error {
  constructor(readonly status: number, readonly code?: string) { super(passwordResetErrorMessage(status, code)); this.name = "PasswordResetApiError"; }
}

export function extractPasswordResetToken(fragment: string): string | null {
  if (!fragment.startsWith("#")) return null;
  const token = new URLSearchParams(fragment.slice(1)).get("token");
  return token && tokenPattern.test(token) ? token : null;
}

export function passwordValidationMessage(password: string): string | null {
  if (!password) return "Crie uma nova senha.";
  if (password.length < 12) return "A senha deve ter pelo menos 12 caracteres.";
  if (password.length > 128) return "A senha deve ter no máximo 128 caracteres.";
  if (!/\p{L}/u.test(password)) return "A senha deve possuir pelo menos uma letra.";
  if (!/\d/u.test(password)) return "A senha deve possuir pelo menos um número.";
  return null;
}

export function passwordConfirmationMessage(password: string, confirmation: string): string | null { return password === confirmation ? null : "As senhas não são iguais."; }

export function passwordResetErrorMessage(status: number, code?: string): string {
  if (code === "PASSWORD_RESET_INVALID_OR_EXPIRED") return "O link de redefinição é inválido ou expirou. Solicite um novo link.";
  if (status === 429) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (status === 400) return "A nova senha deve ter de 12 a 128 caracteres, com pelo menos uma letra e um número.";
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
