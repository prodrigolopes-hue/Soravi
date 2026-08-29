import assert from "node:assert/strict";
import test from "node:test";

import {
  phoneVerificationDestination,
  postLoginDestination,
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

test("direciona login sem telefone verificado para verificacao", () => {
  assert.equal(
    postLoginDestination({ phoneVerified: false, roles: ["ADMIN"] }),
    "/verificar-telefone",
  );
});

test("direciona login verificado conforme o papel com fallback seguro", () => {
  assert.equal(
    postLoginDestination({ phoneVerified: true, roles: ["CUSTOMER"] }),
    "/solicitacoes",
  );
  assert.equal(
    postLoginDestination({ phoneVerified: true, roles: ["PROFESSIONAL"] }),
    "/profissional/oportunidades",
  );
  assert.equal(
    postLoginDestination({ phoneVerified: true, roles: ["ADMIN"] }),
    "/admin",
  );
  assert.equal(
    postLoginDestination({ phoneVerified: true, roles: ["UNEXPECTED"] }),
    "/",
  );
});

test("sanitiza o código para somente seis dígitos", () => {
  assert.equal(sanitizeVerificationCode("12a 34-567"), "123456");
  assert.equal(sanitizeVerificationCode("abc"), "");
});
