export type ConfirmationSessionState =
  | "current-account"
  | "other-account"
  | "signed-out";

export function confirmationSessionState(
  hasSession: boolean,
  currentSessionMatches: boolean | null,
): ConfirmationSessionState {
  if (!hasSession) return "signed-out";
  return currentSessionMatches === true ? "current-account" : "other-account";
}
