import assert from "node:assert/strict";
import test from "node:test";
import { canContinueProfessionalRegistrationContacts } from "./professional-registration-steps";

test("continua o cadastro apenas quando os dois contatos foram confirmados", () => {
  assert.equal(canContinueProfessionalRegistrationContacts({ emailVerified: false, phoneVerified: false }), false);
  assert.equal(canContinueProfessionalRegistrationContacts({ emailVerified: true, phoneVerified: false }), false);
  assert.equal(canContinueProfessionalRegistrationContacts({ emailVerified: false, phoneVerified: true }), false);
  assert.equal(canContinueProfessionalRegistrationContacts({ emailVerified: true, phoneVerified: true }), true);
});
