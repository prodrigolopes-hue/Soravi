import assert from "node:assert/strict";
import test from "node:test";

import { confirmationSessionState } from "./confirmation-session-state";

test("mantem a sessao quando o link confirma o e-mail da conta conectada", () => {
  assert.equal(confirmationSessionState(true, true), "current-account");
});

test("encerra a sessao atual quando o link e de outra conta", () => {
  assert.equal(confirmationSessionState(true, false), "other-account");
  assert.equal(confirmationSessionState(true, null), "other-account");
});

test("oferece entrada quando nao ha sessao", () => {
  assert.equal(confirmationSessionState(false, null), "signed-out");
});
