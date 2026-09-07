import { SORAVI_COMMON_PASSWORDS_BLOCKLIST } from "./common-passwords";
import { PasswordTooCommonException } from "./password-too-common.exception";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS_LOOKUP: ReadonlySet<string> = new Set(
  SORAVI_COMMON_PASSWORDS_BLOCKLIST.map((password) =>
    password.toLowerCase(),
  ),
);

/**
 * Verifica a senha recebida contra a blocklist, usando lowercase somente
 * para o lookup. O valor original nunca é modificado.
 */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS_LOOKUP.has(password.toLowerCase());
}

/**
 * Aplica a política oficial de senha da Soravi (comprimento já validado
 * pelos DTOs) rejeitando senhas presentes na blocklist de senhas comuns.
 */
export function ensurePasswordIsAllowed(password: string): void {
  if (isCommonPassword(password)) {
    throw new PasswordTooCommonException();
  }
}
