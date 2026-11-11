export type IdentityStatus = {
  status: "NOT_STARTED" | "UNDER_REVIEW" | "CLOSED";
  result: "PENDING" | "CONFIRMED" | "NOT_CONFIRMED" | "INCONCLUSIVE";
  requiresSelfie?: boolean;
  documentSubmitted?: boolean;
  selfieSubmitted?: boolean;
};

export function isIdentityStatus(value: unknown): value is IdentityStatus {
  return typeof value === "object" && value !== null && "status" in value && "result" in value && ["NOT_STARTED", "UNDER_REVIEW", "CLOSED"].includes(String(value.status)) && ["PENDING", "CONFIRMED", "NOT_CONFIRMED", "INCONCLUSIVE"].includes(String(value.result));
}

export function canSubmitIdentityEvidence(status: IdentityStatus | null): boolean {
  return status !== null && status.status !== "UNDER_REVIEW" && !(status.status === "CLOSED" && status.result === "CONFIRMED");
}

export function shouldShowSelfieUpload(status: IdentityStatus | null): boolean {
  return status?.requiresSelfie === true;
}
