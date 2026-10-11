import assert from "node:assert/strict";
import test from "node:test";

import {
  isRegistrationContactConflict,
  REGISTRATION_CONTACT_CONFLICT_CODE,
  REGISTRATION_CONTACT_CONFLICT_MESSAGE,
} from "./registration-conflict";

test("reconhece apenas o conflito público de contatos do cadastro", () => {
  assert.equal(
    isRegistrationContactConflict(
      409,
      REGISTRATION_CONTACT_CONFLICT_CODE,
    ),
    true,
  );
  assert.equal(isRegistrationContactConflict(409, "EMAIL_ALREADY_IN_USE"), false);
  assert.equal(isRegistrationContactConflict(429, REGISTRATION_CONTACT_CONFLICT_CODE), false);
});

test("mantém a orientação pública sem identificar e-mail ou telefone", () => {
  assert.equal(
    REGISTRATION_CONTACT_CONFLICT_MESSAGE,
    "Não foi possível usar os dados de contato informados. Se você já possui uma conta, entre para continuar ou utilize outros dados.",
  );
  assert.equal(REGISTRATION_CONTACT_CONFLICT_MESSAGE.includes("e-mail"), false);
  assert.equal(REGISTRATION_CONTACT_CONFLICT_MESSAGE.includes("telefone"), false);
});
