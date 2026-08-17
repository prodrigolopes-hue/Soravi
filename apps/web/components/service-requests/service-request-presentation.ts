export const serviceRequestStatuses = [
  "DRAFT",
  "OPEN",
  "RECEIVING_PROPOSALS",
  "IN_NEGOTIATION",
  "HIRED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];

export const serviceRequestStatusPresentation: Record<
  ServiceRequestStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Rascunho",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  OPEN: {
    label: "Aberta",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  RECEIVING_PROPOSALS: {
    label: "Recebendo propostas",
    className: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  IN_NEGOTIATION: {
    label: "Em negociação",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  HIRED: {
    label: "Contratada",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  IN_PROGRESS: {
    label: "Em andamento",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  COMPLETED: {
    label: "Concluída",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CANCELLED: {
    label: "Cancelada",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

export function isServiceRequestStatus(
  value: unknown,
): value is ServiceRequestStatus {
  return serviceRequestStatuses.some((status) => status === value);
}

export function formatServiceRequestDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}