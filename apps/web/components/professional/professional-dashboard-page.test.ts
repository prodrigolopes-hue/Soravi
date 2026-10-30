import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowProfessionalRegistrationPrompt } from "./professional-dashboard-page";

test("exibe o convite apos telefone confirmado somente para documentacao incompleta", () => {
  assert.equal(shouldShowProfessionalRegistrationPrompt(false), true);
  assert.equal(shouldShowProfessionalRegistrationPrompt(true), false);
  assert.equal(shouldShowProfessionalRegistrationPrompt(undefined), false);
});
