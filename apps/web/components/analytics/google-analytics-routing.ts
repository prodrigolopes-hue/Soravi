import type { CookieConsentStorageValue } from "../cookies/cookie-consent.types";

const SAFE_ROUTES = new Set([
  "/",
  "/cadastro",
  "/cadastro/cliente",
  "/cadastro/profissional",
  "/entrar",
  "/recuperar-senha",
  "/redefinir-senha",
  "/termos-de-uso",
  "/politica-de-privacidade",
  "/solicitacoes",
  "/solicitacoes/nova",
  "/conversas",
  "/profissional",
  "/profissional/oportunidades",
  "/profissional/perfil",
  "/cliente",
  "/conta",
  "/conta/seguranca",
  "/conta/telefone",
  "/favoritos",
  "/notificacoes",
  "/verificar-telefone",
]);

const DYNAMIC_ROUTE_TEMPLATES: ReadonlyArray<readonly [string, string]> = [
  ["/solicitacoes/", "/solicitacoes/[serviceRequestId]"],
  ["/conversas/", "/conversas/[conversationId]"],
  [
    "/profissional/oportunidades/",
    "/profissional/oportunidades/[opportunityId]",
  ],
];

const ALLOWED_UTM_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

const SAFE_UTM_VALUE = /^[A-Za-z][A-Za-z0-9._~-]{0,79}$/u;

const ANALYTICS_PAGE_TITLES: Readonly<Record<string, string>> = {
  "/": "Soravi",
  "/cadastro": "Soravi | Cadastro",
  "/cadastro/cliente": "Soravi | Cadastro de cliente",
  "/cadastro/profissional": "Soravi | Cadastro profissional",
  "/entrar": "Soravi | Entrar",
  "/recuperar-senha": "Soravi | Recuperar senha",
  "/redefinir-senha": "Soravi | Redefinir senha",
  "/solicitacoes": "Soravi | Solicitações",
  "/solicitacoes/nova": "Soravi | Nova solicitação",
  "/solicitacoes/[serviceRequestId]": "Soravi | Solicitação",
  "/conversas": "Soravi | Conversas",
  "/conversas/[conversationId]": "Soravi | Conversa",
  "/profissional": "Soravi | Área profissional",
  "/profissional/oportunidades": "Soravi | Oportunidades",
  "/profissional/oportunidades/[opportunityId]": "Soravi | Oportunidade",
};

function normalizedPathname(pathname: string): string {
  const path = pathname.split(/[?#]/u, 1)[0] || "/";

  return path.startsWith("/") ? path : `/${path}`;
}

function matchesSingleDynamicSegment(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const segment = pathname.slice(prefix.length);

  return segment.length > 0 && !segment.includes("/");
}

export function isAdminPath(pathname: string): boolean {
  const normalizedPath = normalizedPathname(pathname);

  return normalizedPath === "/admin" || normalizedPath.startsWith("/admin/");
}

export function sanitizeAnalyticsPathname(pathname: string): string {
  const normalizedPath = normalizedPathname(pathname);

  if (SAFE_ROUTES.has(normalizedPath)) {
    return normalizedPath;
  }

  for (const [prefix, template] of DYNAMIC_ROUTE_TEMPLATES) {
    if (matchesSingleDynamicSegment(normalizedPath, prefix)) {
      return template;
    }
  }

  return "/other";
}

export function sanitizeAnalyticsUtmSearch(search: string): string {
  const input = new URLSearchParams(search);
  const sanitized = new URLSearchParams();

  for (const parameter of ALLOWED_UTM_PARAMETERS) {
    const value = input.get(parameter);

    if (value && SAFE_UTM_VALUE.test(value)) {
      sanitized.set(parameter, value);
    }
  }

  const serialized = sanitized.toString();

  return serialized ? `?${serialized}` : "";
}

export function createAnalyticsPageLocation(
  origin: string,
  pathname: string,
  search: string,
  includeCampaignParameters: boolean,
): string {
  const sanitizedOrigin = new URL(origin).origin;
  const sanitizedPathname = sanitizeAnalyticsPathname(pathname);
  const campaignSearch = includeCampaignParameters
    ? sanitizeAnalyticsUtmSearch(search)
    : "";

  return `${sanitizedOrigin}${sanitizedPathname}${campaignSearch}`;
}

export function safeAnalyticsPageTitle(pathname: string): string {
  return ANALYTICS_PAGE_TITLES[sanitizeAnalyticsPathname(pathname)] ?? "Soravi";
}

export function sanitizeAnalyticsReferrer(
  referrer: string,
  currentOrigin: string,
): string | undefined {
  if (!referrer) {
    return undefined;
  }

  try {
    const referrerUrl = new URL(referrer);
    const currentUrl = new URL(currentOrigin);

    if (
      referrerUrl.protocol !== "http:" &&
      referrerUrl.protocol !== "https:"
    ) {
      return undefined;
    }

    if (referrerUrl.origin === currentUrl.origin) {
      return `${referrerUrl.origin}${sanitizeAnalyticsPathname(referrerUrl.pathname)}`;
    }

    return `${referrerUrl.origin}/`;
  } catch {
    return undefined;
  }
}

export function googleAnalyticsCookieDomains(hostname: string): readonly string[] {
  if (hostname === "soravi.com.br") {
    return ["soravi.com.br", ".soravi.com.br"];
  }

  if (hostname === "www.soravi.com.br") {
    return [
      "www.soravi.com.br",
      ".www.soravi.com.br",
      "soravi.com.br",
      ".soravi.com.br",
    ];
  }

  return [hostname];
}

export function canTrackAnalytics(
  preference: CookieConsentStorageValue | null,
  pathname: string,
): boolean {
  return preference?.analytics === "accepted" && !isAdminPath(pathname);
}

export function shouldSendAnalyticsPageView(
  previousPathname: string | null,
  pathname: string,
): boolean {
  return previousPathname !== normalizedPathname(pathname);
}
