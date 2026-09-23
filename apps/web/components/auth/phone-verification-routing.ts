export function phoneVerificationDestination(
  roles: readonly string[],
): string {
  if (roles.includes("ADMIN")) {
    return "/admin";
  }

  if (roles.includes("PROFESSIONAL")) {
    return "/profissional";
  }

  if (roles.includes("CUSTOMER")) {
    return "/cliente";
  }

  return "/";
}

interface PostLoginUser {
  phoneVerified: boolean;
  roles: readonly string[];
}

export function postLoginDestination(
  user: PostLoginUser,
): string {
  // ADMIN fica temporariamente fora da exigência de telefone no MVP.
  if (user.roles.includes("ADMIN")) {
    return "/admin";
  }

  if (!user.phoneVerified) {
    return "/verificar-telefone";
  }

  return phoneVerificationDestination(user.roles);
}

export type PhoneVerificationGuardDecision =
  | { type: "pending" }
  | { type: "allow" }
  | { type: "redirect"; destination: string };

interface PhoneVerificationGuardInput {
  isLoading: boolean;
  pathname: string;
  user: PostLoginUser | null;
}

const PUBLIC_ROUTE_PREFIXES = ["/cadastro"] as const;

const PUBLIC_ROUTES = new Set([
  "/",
  "/entrar",
  "/recuperar-senha",
  "/redefinir-senha",
  "/termos-de-uso",
  "/politica-de-privacidade",
]);

const PROTECTED_ROUTE_PREFIXES = [
  "/cliente",
  "/solicitacoes",
  "/profissional",
  "/conversas",
  "/notificacoes",
  "/admin",
] as const;

function matchesRoutePrefix(
  pathname: string,
  prefix: string,
): boolean {
  return (
    pathname === prefix ||
    pathname.startsWith(`${prefix}/`)
  );
}

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) =>
      matchesRoutePrefix(pathname, prefix),
    )
  );
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    matchesRoutePrefix(pathname, prefix),
  );
}

function redirectDecision(
  pathname: string,
  destination: string,
): PhoneVerificationGuardDecision {
  return pathname === destination
    ? { type: "allow" }
    : {
      type: "redirect",
      destination,
    };
}

export function phoneVerificationGuardDecision({
  isLoading,
  pathname,
  user,
}: PhoneVerificationGuardInput): PhoneVerificationGuardDecision {
  if (isLoading) {
    return { type: "pending" };
  }

  if (!user) {
    return { type: "allow" };
  }

  // Exceção explícita do MVP para evitar lockout administrativo.
  if (user.roles.includes("ADMIN")) {
    return pathname === "/verificar-telefone"
      ? redirectDecision(pathname, "/admin")
      : { type: "allow" };
  }

  if (isPublicRoute(pathname)) {
    return { type: "allow" };
  }

  if (!user.phoneVerified) {
    if (pathname === "/verificar-telefone") {
      return { type: "allow" };
    }

    return isProtectedRoute(pathname)
      ? redirectDecision(
        pathname,
        "/verificar-telefone",
      )
      : { type: "allow" };
  }

  if (pathname === "/verificar-telefone") {
    return redirectDecision(
      pathname,
      phoneVerificationDestination(user.roles),
    );
  }

  return { type: "allow" };
}

export function sanitizeVerificationCode(
  value: string,
): string {
  return value.replace(/\D/gu, "").slice(0, 6);
}