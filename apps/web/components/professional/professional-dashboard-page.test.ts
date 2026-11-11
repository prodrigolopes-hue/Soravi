import assert from "node:assert/strict";
import test from "node:test";

import {
  getProfessionalVerificationCardContent,
  shouldShowProfessionalRegistrationPrompt,
} from "./professional-dashboard-page";

test("exibe o convite apos telefone confirmado somente para documentacao incompleta", () => {
  assert.equal(shouldShowProfessionalRegistrationPrompt(false), true);
  assert.equal(shouldShowProfessionalRegistrationPrompt(true), false);
  assert.equal(shouldShowProfessionalRegistrationPrompt(undefined), false);
});

test("não mostra aviso de cadastro incompleto para profissional aprovado", () => {
  assert.equal(getProfessionalVerificationCardContent("APPROVED", true), null);
});

test("mantém orientação de análise e rejeição sem depender de papel ADMIN", () => {
  assert.deepEqual(getProfessionalVerificationCardContent("PENDING", true), {
    actionLabel: "Acompanhar verificação",
    text: "Seu perfil está em análise. Acompanhe o estado e os próximos passos na página do perfil.",
  });
  assert.deepEqual(getProfessionalVerificationCardContent("REJECTED", true), {
    actionLabel: "Ver pendências",
    text: "Seu perfil profissional não foi aprovado. Consulte a orientação e os próximos passos na página do perfil.",
  });
});

test("não trata estado indisponível como cadastro incompleto", () => {
  assert.equal(getProfessionalVerificationCardContent(undefined, undefined), null);
});
