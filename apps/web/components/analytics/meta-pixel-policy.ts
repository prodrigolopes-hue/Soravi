const PUBLIC_PATHS = new Set(["/", "/cadastro", "/cadastro/profissional", "/categorias"]);

export function canLoadMetaPixel(id: string, advertising: string | undefined, pathname: string): boolean {
  return /^\d{5,25}$/.test(id) && advertising === "accepted" && PUBLIC_PATHS.has(pathname);
}
