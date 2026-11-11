const CPF_DIGITS_PATTERN = /^\d{11}$/;
const CPF_MASKED_PATTERN = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

export class CpfValidationError extends Error {
  constructor() {
    super("CPF inválido.");
    this.name = "CpfValidationError";
  }
}

/**
 * Normaliza e valida a estrutura de um CPF. A validação dos dígitos não
 * confirma a identidade da pessoa titular.
 */
export function normalizeCpf(value: unknown): string {
  if (typeof value !== "string") {
    throw new CpfValidationError();
  }

  const trimmedValue = value.trim();

  if (
    !CPF_DIGITS_PATTERN.test(trimmedValue) &&
    !CPF_MASKED_PATTERN.test(trimmedValue)
  ) {
    throw new CpfValidationError();
  }

  const cpf = trimmedValue.replace(/[.-]/g, "");

  if (new Set(cpf).size === 1 || !hasValidCheckDigits(cpf)) {
    throw new CpfValidationError();
  }

  return cpf;
}

function hasValidCheckDigits(cpf: string): boolean {
  const firstCheckDigit = calculateCheckDigit(cpf.slice(0, 9));
  const secondCheckDigit = calculateCheckDigit(
    cpf.slice(0, 9) + firstCheckDigit,
  );

  return cpf === cpf.slice(0, 9) + firstCheckDigit + secondCheckDigit;
}

function calculateCheckDigit(digits: string): number {
  const sum = digits
    .split("")
    .reduce(
      (total, digit, index) =>
        total + Number(digit) * (digits.length + 1 - index),
      0,
    );
  const remainder = sum % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}
