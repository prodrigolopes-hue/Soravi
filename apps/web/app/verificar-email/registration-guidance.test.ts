import assert from "node:assert/strict";
import test from "node:test";

import { registrationGuidance } from "./registration-guidance";

test("orienta o cadastro profissional a confirmar e-mail, entrar e concluir o perfil", () => {
  const guidance = registrationGuidance(true);

  assert.match(guidance.message, /Confirme seu e-mail/u);
  assert.match(guidance.message, /faça login/u);
  assert.match(guidance.message, /conclua seu cadastro profissional/u);
  assert.equal(guidance.loginLabel, "Ir para login");
});

test("preserva a orientação de cadastro geral", () => {
  const guidance = registrationGuidance(false);

  assert.match(guidance.message, /Cadastro concluído/u);
  assert.equal(guidance.loginLabel, "Entrar");
});
