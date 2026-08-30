import { apiBaseUrl } from "./api";

const phoneVerificationUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/phone-verification`;
const currentUserPhoneUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/users/me/phone`;
const MAX_BRAZILIAN_PHONE_DIGITS = 11;

export function formatBrazilianPhoneInput(value: string): string {
  const digits = value.replace(/\D/gu, "").slice(0, MAX_BRAZILIAN_PHONE_DIGITS);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length === 1) {
    return `(${digits}`;
  }

  const areaCode = digits.slice(0, 2);
  const localNumber = digits.slice(2);

  if (localNumber.length === 0) {
    return `(${areaCode})`;
  }

  const prefixLength = localNumber.length <= 8 ? 4 : 5;
  const prefix = localNumber.slice(0, prefixLength);
  const suffix = localNumber.slice(prefixLength);

  return `(${areaCode}) ${prefix}${suffix ? `-${suffix}` : ""}`;
}

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

export class CurrentUserPhoneApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(currentUserPhoneErrorMessage(status, code));
    this.name = "CurrentUserPhoneApiError";
    this.status = status;
    this.code = code;
  }
}

export function currentUserPhoneErrorMessage(
  status: number,
  code?: string,
): string {
  switch (code) {
    case "INVALID_CURRENT_PASSWORD":
      return "Não foi possível confirmar sua senha.";
    case "INVALID_BRAZILIAN_PHONE":
      return "Informe um telefone brasileiro válido com DDD.";
    case "PHONE_ALREADY_IN_USE":
      return "Este telefone já está sendo utilizado.";
  }

  switch (status) {
    case 401:
      return "Sua sessão expirou. Entre novamente para continuar.";
    case 429:
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    default:
      return "Não foi possível alterar o telefone agora. Tente novamente em instantes.";
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

interface UpdateCurrentUserPhoneInput {
  phone: string;
  currentPassword: string;
}

export async function updateCurrentUserPhone(
  accessToken: string,
  input: UpdateCurrentUserPhoneInput,
): Promise<void> {
  try {
    const response = await fetch(currentUserPhoneUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        phone: input.phone,
        currentPassword: input.currentPassword,
      }),
    });

    if (!response.ok) {
      const code = await readKnownErrorCode(response);
      throw new CurrentUserPhoneApiError(response.status, code);
    }
  } catch (error) {
    if (error instanceof CurrentUserPhoneApiError) {
      throw error;
    }

    throw new CurrentUserPhoneApiError(0);
  }
}
