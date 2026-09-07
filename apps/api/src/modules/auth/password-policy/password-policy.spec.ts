import { SORAVI_COMMON_PASSWORDS_BLOCKLIST } from "./common-passwords";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ensurePasswordIsAllowed,
  isCommonPassword,
} from "./password-policy";
import { PasswordTooCommonException } from "./password-too-common.exception";

describe("password-policy", () => {
  it("possui exatamente 3000 entradas na blocklist", () => {
    expect(SORAVI_COMMON_PASSWORDS_BLOCKLIST).toHaveLength(3000);
  });

  it("todas as entradas possuem comprimento entre 12 e 128 caracteres", () => {
    for (const password of SORAVI_COMMON_PASSWORDS_BLOCKLIST) {
      expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
      expect(password.length).toBeLessThanOrEqual(PASSWORD_MAX_LENGTH);
    }
  });

  it("não possui duplicatas case-insensitive", () => {
    const lowered = SORAVI_COMMON_PASSWORDS_BLOCKLIST.map((password) =>
      password.toLowerCase(),
    );
    const unique = new Set(lowered);

    expect(unique.size).toBe(SORAVI_COMMON_PASSWORDS_BLOCKLIST.length);
  });

  it("rejeita uma entrada conhecida da própria blocklist", () => {
    const known = SORAVI_COMMON_PASSWORDS_BLOCKLIST[0];

    expect(isCommonPassword(known)).toBe(true);
    expect(() => ensurePasswordIsAllowed(known)).toThrow(
      PasswordTooCommonException,
    );
  });

  it("rejeita uma variante de caixa de uma entrada da blocklist", () => {
    const known = SORAVI_COMMON_PASSWORDS_BLOCKLIST[0];
    const upper = known.toUpperCase();

    expect(isCommonPassword(upper)).toBe(true);
    expect(() => ensurePasswordIsAllowed(upper)).toThrow(
      PasswordTooCommonException,
    );
  });

  it("aceita uma frase-senha não comum", () => {
    const passphrase = "SoraviAuditoria2026!";

    expect(isCommonPassword(passphrase)).toBe(false);
    expect(() => ensurePasswordIsAllowed(passphrase)).not.toThrow();
  });

  it("aceita uma senha somente numérica não comum com 12+ caracteres", () => {
    const numericPassword = "581047293618";

    expect(numericPassword.length).toBeGreaterThanOrEqual(
      PASSWORD_MIN_LENGTH,
    );
    expect(isCommonPassword(numericPassword)).toBe(false);
    expect(() => ensurePasswordIsAllowed(numericPassword)).not.toThrow();
  });

  it("aceita uma senha somente de símbolos não comum com 12+ caracteres", () => {
    const symbolPassword = "!@#$%^&*()_+";

    expect(symbolPassword.length).toBeGreaterThanOrEqual(
      PASSWORD_MIN_LENGTH,
    );
    expect(isCommonPassword(symbolPassword)).toBe(false);
    expect(() => ensurePasswordIsAllowed(symbolPassword)).not.toThrow();
  });

  it("não modifica o valor original recebido", () => {
    const known = SORAVI_COMMON_PASSWORDS_BLOCKLIST[0];
    const upperCopy = known.toUpperCase();
    const originalReference = upperCopy;

    expect(() => ensurePasswordIsAllowed(upperCopy)).toThrow();
    expect(upperCopy).toBe(originalReference);
    expect(upperCopy).toBe(known.toUpperCase());
  });
});
