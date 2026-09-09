import { apiBaseUrl } from "./api";

export type ManageableAdminUserStatus = "ACTIVE" | "BLOCKED";

interface ApiErrorPayload {
  code?: unknown;
  error?: { code?: unknown };
}

export class AdminUserStatusApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(adminUserStatusErrorMessage(status, code));
    this.name = "AdminUserStatusApiError";
    this.status = status;
    this.code = code;
  }
}

export function adminUserStatusErrorMessage(
  status: number,
  code?: string,
): string {
  switch (code) {
    case "ADMIN_SELF_STATUS_CHANGE_FORBIDDEN":
      return "Você não pode alterar o status da própria conta administrativa.";
    case "ADMIN_TARGET_STATUS_CHANGE_FORBIDDEN":
      return "Contas administrativas não podem ser alteradas por esta ação.";
    case "USER_STATUS_TRANSITION_NOT_ALLOWED":
      return "Esta conta não pode ter o status alterado por esta ação.";
  }

  switch (status) {
    case 401:
      return "Sua sessão expirou. Entre novamente para continuar.";
    case 403:
      return "Você não tem permissão para realizar esta ação.";
    case 404:
      return "A conta não foi encontrada ou não está mais disponível.";
    default:
      return "Não foi possível alterar o status da conta agora. Tente novamente.";
  }
}

function readPublicCode(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const value = payload as ApiErrorPayload;
  if (typeof value.code === "string") {
    return value.code;
  }

  return typeof value.error?.code === "string" ? value.error.code : undefined;
}

export async function updateAdminUserStatus(
  accessToken: string,
  userId: string,
  status: ManageableAdminUserStatus,
): Promise<void> {
  const url = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/users/admin/${encodeURIComponent(userId)}/status`;

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ status }),
    });

    if (response.status === 204) {
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    throw new AdminUserStatusApiError(response.status, readPublicCode(payload));
  } catch (error) {
    if (error instanceof AdminUserStatusApiError) {
      throw error;
    }

    throw new AdminUserStatusApiError(0);
  }
}
