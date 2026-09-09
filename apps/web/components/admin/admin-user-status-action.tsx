"use client";

import { useState } from "react";

import {
  AdminUserStatusApiError,
  ManageableAdminUserStatus,
  updateAdminUserStatus,
} from "../../lib/admin-user-status";

interface AdminUserStatusActionProps {
  userId: string;
  userName: string;
  status: string;
  accessToken: string;
  onStatusChanged: (userId: string, status: ManageableAdminUserStatus) => void;
}

export function AdminUserStatusAction({
  userId,
  userName,
  status,
  accessToken,
  onStatusChanged,
}: AdminUserStatusActionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (status !== "ACTIVE" && status !== "BLOCKED") {
    return <span className="text-xs text-slate-500">Sem ação disponível</span>;
  }

  const isBlocking = status === "ACTIVE";
  const nextStatus: ManageableAdminUserStatus = isBlocking ? "BLOCKED" : "ACTIVE";

  const openConfirmation = () => {
    setError(null);
    setSuccess(null);
    setIsConfirming(true);
  };

  const cancel = () => {
    if (!isSubmitting) {
      setIsConfirming(false);
      setError(null);
    }
  };

  const confirm = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminUserStatus(accessToken, userId, nextStatus);
      setIsConfirming(false);
      onStatusChanged(userId, nextStatus);
      setSuccess(isBlocking ? "Conta bloqueada com sucesso." : "Conta reativada com sucesso.");
    } catch (caught) {
      setError(
        caught instanceof AdminUserStatusApiError
          ? caught.message
          : "Não foi possível alterar o status da conta agora. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionClass = isBlocking
    ? "border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-600"
    : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-600";

  return (
    <div className="min-w-48 text-left">
      {!isConfirming ? (
        <button
          type="button"
          onClick={openConfirmation}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${actionClass}`}
        >
          {isBlocking ? "Bloquear conta" : "Reativar conta"}
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-sm leading-6 text-slate-700">
            {isBlocking
              ? `Tem certeza que deseja bloquear a conta de ${userName}? As sessões atuais serão encerradas imediatamente.`
              : `Tem certeza que deseja reativar a conta de ${userName}? As sessões anteriores não serão restauradas. O usuário deverá entrar novamente.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={isSubmitting}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isBlocking ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-600" : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600"}`}
            >
              {isSubmitting
                ? isBlocking
                  ? "Bloqueando..."
                  : "Reativando..."
                : isBlocking
                  ? "Confirmar bloqueio"
                  : "Confirmar reativação"}
            </button>
          </div>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-emerald-700" role="status">{success}</p> : null}
    </div>
  );
}
