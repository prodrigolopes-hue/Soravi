export interface FavoriteViewer {
  roles: readonly string[];
  customerProfile: { id: string } | null;
}

export function canManageFavorite(viewer: FavoriteViewer | null): boolean {
  return Boolean(
    viewer?.roles.includes("CUSTOMER") && viewer.customerProfile !== null,
  );
}

export function favoriteRequestMethod(favoriteId: string | null): "POST" | "DELETE" {
  return favoriteId === null ? "POST" : "DELETE";
}
