import test from "node:test";
import assert from "node:assert/strict";
import { canLoadMetaPixel } from "./meta-pixel-policy.ts";

test("publicidade exige aceite explícito e identificador válido", () => {
  for (const consent of [undefined, "rejected"]) assert.equal(canLoadMetaPixel("123456789", consent, "/"), false);
  assert.equal(canLoadMetaPixel("invalid", "accepted", "/"), false);
  assert.equal(canLoadMetaPixel("123456789", "accepted", "/"), true);
});

test("não habilita rastreamento em áreas sensíveis", () => {
  for (const path of ["/admin", "/admin/profissionais", "/cadastro/profissional/identidade", "/profissional/perfil", "/verificar-email", "/verificar-telefone"]) {
    assert.equal(canLoadMetaPixel("123456789", "accepted", path), false);
  }
});
