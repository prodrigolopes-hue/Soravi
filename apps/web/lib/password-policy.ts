export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_HELP_TEXT =
  "Use de 12 a 128 caracteres. Evite senhas comuns ou fáceis de adivinhar.";

export function passwordValidationMessage(password: string): string | null {
  if (!password) {
    return "Crie uma senha.";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }

  return null;
}
