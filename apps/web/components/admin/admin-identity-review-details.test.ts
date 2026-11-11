import assert from "node:assert/strict";
import test from "node:test";

import { isDetails } from "./admin-identity-review-details";

test("aceita a resposta serializada de uma tentativa legada fechada sem selfie", () => {
  const legacyDetails = {
    attempt: {
      id: "attempt",
      status: "CLOSED",
      result: "CONFIRMED",
      createdAt: "2026-10-31T11:00:00.000Z",
      closedAt: "2026-10-31T12:00:00.000Z",
      requiresSelfie: false,
      hasActiveSelfie: false,
    },
    professionalName: "Ana",
    disposalSuspension: {
      active: true,
      events: [{ action: "APPLIED", reason: "Investigação aberta", createdAt: "2026-10-31T12:30:00.000Z", operator: { name: "Administradora" } }],
    },
    history: [{
      id: "attempt",
      status: "CLOSED",
      result: "CONFIRMED",
      createdAt: "2026-10-31T11:00:00.000Z",
      closedAt: "2026-10-31T12:00:00.000Z",
      requiresSelfie: false,
      documentSubmitted: true,
      selfieSubmitted: false,
      decisions: [{
        result: "CONFIRMED",
        reasonCode: "DOCUMENT_CHECKED",
        createdAt: "2026-10-31T12:00:00.000Z",
        operator: { name: "Administradora" },
      }],
    }],
  };

  assert.equal(isDetails(legacyDetails), true);
});

test("rejeita detalhes sem estado conhecido da suspensão de descarte", () => {
  assert.equal(isDetails({ attempt: {}, professionalName: "Ana", history: [] }), false);
});
