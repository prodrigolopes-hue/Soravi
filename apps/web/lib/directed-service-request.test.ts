import assert from "node:assert/strict";
import test from "node:test";

import {
  directedServiceRequestDestination,
  safeDirectedRequestReturnTo,
} from "./directed-service-request";

const professionalProfileId = "725afb87-2b81-4de7-9606-8f382fff3341";
const destination = `/solicitacoes/nova?professionalProfileId=${professionalProfileId}`;

test("aceita somente o retorno interno de pedido direcionado com UUID v4", () => {
  assert.equal(directedServiceRequestDestination(professionalProfileId), destination);
  assert.equal(safeDirectedRequestReturnTo(destination), destination);
});

test("rejeita retorno externo, caminho arbitrário e UUID inválido", () => {
  for (const value of [
    "https://example.com/solicitacoes/nova?professionalProfileId=" + professionalProfileId,
    "//example.com",
    "/cliente",
    "/solicitacoes/nova?professionalProfileId=invalid",
    "/solicitacoes/nova?professionalProfileId=" + professionalProfileId + "&next=/cliente",
    "/solicitacoes/nova?professionalProfileId=" + professionalProfileId + "&professionalProfileId=" + professionalProfileId,
  ]) {
    assert.equal(safeDirectedRequestReturnTo(value), null);
  }
});
