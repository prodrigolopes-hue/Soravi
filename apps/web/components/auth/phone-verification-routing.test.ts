import assert from "node:assert/strict";
import test from "node:test";

import {
  phoneVerificationDestination,
  sanitizeVerificationCode,
} from "./phone-verification-routing";

test("define o destino para cada papel e possui fallback seguro", () => {
  assert.equal(phoneVerificationDestination(["CUSTOMER"]), "/solicitacoes");
  assert.equal(
    phoneVerificationDestination(["PROFESSIONAL"]),
    "/profissional/oportunidades",
  );
  assert.equal(phoneVerificationDestination(["ADMIN"]), "/admin");
  assert.equal(phoneVerificationDestination([]), "/");
});

test("sanitiza o código para somente seis dígitos", () => {
  assert.equal(sanitizeVerificationCode("12a 34-567"), "123456");
  assert.equal(sanitizeVerificationCode("abc"), "");
});
