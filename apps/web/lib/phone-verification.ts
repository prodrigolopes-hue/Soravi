import { apiBaseUrl } from "./api";

const phoneVerificationUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/phone-verification`;

interface ApiErrorPayload {
  code?: unknown;
}

export class PhoneVerificationApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(phoneVerificationErrorMessage(status));
    this.name = "PhoneVerificationApiError";
    this.status = status;
    this.code = code;
  }
}

export function phoneVerificationErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "O código é inválido ou expirou. Confira os seis dígitos ou solicite um novo código.";
    case 401:
      return "Sua sessão expirou. Entre novamente para continuar.";
    case 429:
      return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
    case 503:
      return "Não foi possível enviar o código agora. Aguarde alguns instantes e tente novamente.";
    default:
      return "Não foi possível concluir a verificação agora. Tente novamente em instantes.";
  }
}

async function readKnownErrorCode(response: Response): Promise<string | undefined> {
  const payload: unknown = await response.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const { code } = payload as ApiErrorPayload;
  return typeof code === "string" ? code : undefined;
}

async function throwSanitizedApiError(response: Response): Promise<never> {
  const code = await readKnownErrorCode(response);
  throw new PhoneVerificationApiError(response.status, code);
}

export async function requestPhoneVerification(
  accessToken: string,
): Promise<void> {
  try {
    const response = await fetch(`${phoneVerificationUrl}/request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
    });

    if (response.status !== 202) {
      await throwSanitizedApiError(response);
    }
  } catch (error) {
    if (error instanceof PhoneVerificationApiError) {
      throw error;
    }

    throw new PhoneVerificationApiError(0);
  }
}

export async function confirmPhoneVerification(
  accessToken: string,
  code: string,
): Promise<void> {
  try {
    const response = await fetch(`${phoneVerificationUrl}/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ code }),
    });

    if (response.status !== 204) {
      await throwSanitizedApiError(response);
    }
  } catch (error) {
    if (error instanceof PhoneVerificationApiError) {
      throw error;
    }

    throw new PhoneVerificationApiError(0);
  }
}
