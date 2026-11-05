import assert from "node:assert/strict";
import test from "node:test";

import { canSubmitIdentityEvidence, shouldShowSelfieUpload } from "./professional-identity-upload-state";

test("permite selfie pendente em tentativa aguardando evidência", () => {
  const status = { status: "NOT_STARTED" as const, result: "PENDING" as const, requiresSelfie: true, documentSubmitted: true, selfieSubmitted: false };

  assert.equal(shouldShowSelfieUpload(status), true);
  assert.equal(canSubmitIdentityEvidence(status), true);
});

test("preserva tentativa antiga sem requisito de selfie", () => {
  const status = { status: "NOT_STARTED" as const, result: "PENDING" as const, requiresSelfie: false, documentSubmitted: false, selfieSubmitted: false };

  assert.equal(shouldShowSelfieUpload(status), false);
  assert.equal(canSubmitIdentityEvidence(status), true);
});

test("bloqueia envio para identidade já confirmada", () => {
  const status = { status: "CLOSED" as const, result: "CONFIRMED" as const, requiresSelfie: false, documentSubmitted: true, selfieSubmitted: false };

  assert.equal(canSubmitIdentityEvidence(status), false);
});
