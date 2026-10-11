export const REGISTRATION_CONTACT_CONFLICT_CODE =
  "REGISTRATION_CONTACT_CONFLICT";

export const REGISTRATION_CONTACT_CONFLICT_MESSAGE =
  "Não foi possível usar os dados de contato informados. Se você já possui uma conta, entre para continuar ou utilize outros dados.";

export function isRegistrationContactConflict(
  responseStatus: number,
  errorCode: string | null,
): boolean {
  return (
    responseStatus === 409 &&
    errorCode === REGISTRATION_CONTACT_CONFLICT_CODE
  );
}
