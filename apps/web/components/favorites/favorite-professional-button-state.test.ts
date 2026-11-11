import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageFavorite,
  favoriteRequestMethod,
} from "./favorite-professional-button-state";

test("nao permite favoritos para visitante ou conta sem perfil de cliente", () => {
  assert.equal(canManageFavorite(null), false);
  assert.equal(
    canManageFavorite({ roles: ["CUSTOMER"], customerProfile: null }),
    false,
  );
  assert.equal(
    canManageFavorite({ roles: ["PROFESSIONAL"], customerProfile: { id: "customer-1" } }),
    false,
  );
});

test("permite favoritos somente ao cliente autenticado com perfil", () => {
  assert.equal(
    canManageFavorite({ roles: ["CUSTOMER"], customerProfile: { id: "customer-1" } }),
    true,
  );
});

test("alterna entre criar e remover o favorito conforme seu estado", () => {
  assert.equal(favoriteRequestMethod(null), "POST");
  assert.equal(favoriteRequestMethod("favorite-1"), "DELETE");
});
