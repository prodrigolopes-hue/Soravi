export type Decision = {
  result: string;
  reasonCode: string;
  createdAt: string;
  operator: { name: string } | null;
};

export type History = {
  id: string;
  status: string;
  result: string;
  createdAt: string;
  closedAt: string | null;
  decisions: Decision[];
};

type DetailAttempt = Omit<History, "decisions"> & { hasActiveSelfie: boolean };
export type Details = { attempt: DetailAttempt; professionalName: string; history: History[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isDecision(value: unknown): value is Decision {
  return isRecord(value) && typeof value.result === "string" && typeof value.reasonCode === "string" && typeof value.createdAt === "string" && (value.operator === null || (isRecord(value.operator) && typeof value.operator.name === "string"));
}

function isHistory(value: unknown): value is History {
  return isRecord(value) && typeof value.id === "string" && typeof value.status === "string" && typeof value.result === "string" && typeof value.createdAt === "string" && isNullableString(value.closedAt) && Array.isArray(value.decisions) && value.decisions.every(isDecision);
}

export function isDetails(value: unknown): value is Details {
  return isRecord(value) && typeof value.professionalName === "string" && isHistory({ ...(isRecord(value.attempt) ? value.attempt : {}), decisions: [] }) && isRecord(value.attempt) && typeof value.attempt.hasActiveSelfie === "boolean" && Array.isArray(value.history) && value.history.every(isHistory);
}
