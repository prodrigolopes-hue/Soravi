export function phoneVerificationDestination(roles: readonly string[]): string {
  if (roles.includes("CUSTOMER")) {
    return "/solicitacoes";
  }

  if (roles.includes("PROFESSIONAL")) {
    return "/profissional/oportunidades";
  }

  if (roles.includes("ADMIN")) {
    return "/admin";
  }

  return "/";
}

export function sanitizeVerificationCode(value: string): string {
  return value.replace(/\D/gu, "").slice(0, 6);
}
