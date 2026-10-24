const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isUuidV4(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_V4_PATTERN.test(value);
}

export function directedServiceRequestDestination(
  professionalProfileId: string | null | undefined,
): string | null {
  if (!isUuidV4(professionalProfileId)) {
    return null;
  }

  return `/solicitacoes/nova?professionalProfileId=${encodeURIComponent(professionalProfileId)}`;
}

export function safeDirectedRequestReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  try {
    const url = new URL(value, "https://soravi.invalid");

    if (url.origin !== "https://soravi.invalid" || url.pathname !== "/solicitacoes/nova") {
      return null;
    }

    const professionalProfileIds = url.searchParams.getAll("professionalProfileId");
    if (
      Array.from(url.searchParams.keys()).some((key) => key !== "professionalProfileId") ||
      professionalProfileIds.length !== 1
    ) {
      return null;
    }

    return directedServiceRequestDestination(professionalProfileIds[0]);
  } catch {
    return null;
  }
}

export function withDirectedRequestReturnTo(
  path: "/entrar" | "/cadastro" | "/cadastro/cliente" | "/verificar-telefone",
  returnTo: string | null,
): string {
  const safeReturnTo = safeDirectedRequestReturnTo(returnTo);
  return safeReturnTo ? `${path}?returnTo=${encodeURIComponent(safeReturnTo)}` : path;
}
