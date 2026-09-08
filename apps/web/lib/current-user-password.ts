import { apiBaseUrl } from "./api";

const currentUserPasswordUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/users/me/password`;

export interface UpdateCurrentUserPasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface ApiErrorPayload {
  code?: unknown;
  error?: {
    code?: unknown;
  };
}

export class CurrentUserPasswordApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(currentUserPasswordErrorMessage(status, code));
    this.name = "CurrentUserPasswordApiError";
    this.status = status;
    this.code = code;
  }
}

export function currentUserPasswordErrorMessage(
  status: number,
  code?: string,
): string {
  switch (code) {
    case "INVALID_CURRENT_PASSWORD":
      return "Não foi possível confirmar sua senha atual.";
    case "NEW_PASSWORD_MUST_DIFFER":
      return "A nova senha deve ser diferente da senha atual.";
    case "PASSWORD_TOO_COMMON":
      return "Escolha uma senha menos comum e difícil de adivinhar.";
  }

  switch (status) {
    case 401:
      return "Sua sessão expirou. Entre novamente para continuar.";
    case 429:
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    default:
      return "Não foi possível alterar sua senha agora. Tente novamente em instantes.";
  }
}

function readPublicCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = payload as ApiErrorPayload;

  if (typeof value.code === "string") {
    return value.code;
  }

  return typeof value.error?.code === "string" ? value.error.code : undefined;
}

async function readKnownErrorCode(response: Response): Promise<string | undefined> {
  const payload: unknown = await response.json().catch(() => null);

  return readPublicCode(payload);
}

export async function updateCurrentUserPassword(
  accessToken: string,
  input: UpdateCurrentUserPasswordInput,
): Promise<void> {
  try {
    const response = await fetch(currentUserPasswordUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    });

    if (response.status === 204) {
      return;
    }

    const code = await readKnownErrorCode(response);
    throw new CurrentUserPasswordApiError(response.status, code);
  } catch (error) {
    if (error instanceof CurrentUserPasswordApiError) {
      throw error;
    }

    throw new CurrentUserPasswordApiError(0);
  }
}