import assert from "node:assert/strict";
import test from "node:test";

import { professionalCategoryRegistrationPayload, professionalCategorySelectionError } from "./professional-registration-categories";

test("aceita somente sugestão e a inclui no payload da API", () => {
  const requests = [{ suggestedName: "Técnico solar", description: "Instala painéis" }];
  assert.equal(professionalCategorySelectionError([], requests), null);
  assert.deepEqual(professionalCategoryRegistrationPayload([], requests), { categorySlugs: [], categoryRequests: requests });
});

test("aceita somente categoria oficial", () => {
  assert.equal(professionalCategorySelectionError(["eletrica"], []), null);
});

test("aceita combinação de categorias oficiais e sugestões", () => {
  assert.equal(professionalCategorySelectionError(["eletrica", "pintura"], [{ suggestedName: "Técnico solar" }]), null);
});

test("rejeita quando não há escolha", () => {
  assert.equal(professionalCategorySelectionError([], []), "Selecione pelo menos uma categoria oficial ou sugira uma categoria.");
});

test("rejeita mais de três escolhas combinadas", () => {
  assert.equal(professionalCategorySelectionError(["eletrica", "pintura"], [{ suggestedName: "Técnico solar" }, { suggestedName: "Jardinagem" }]), "Selecione no máximo três categorias entre oficiais e sugeridas.");
});
