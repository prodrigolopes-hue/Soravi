import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmPhoneVerification,
  PhoneVerificationApiError,
  requestPhoneVerification,
} from "./phone-verification";

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

function installFetch(response: Response): FetchCall[] {
  const calls: FetchCall[] = [];

  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return response;
  };

  return calls;
}

test("request usa POST autenticado, inclui credenciais e não envia body", async () => {
  const calls = installFetch(new Response(null, { status: 202 }));

  await requestPhoneVerification("access-token");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.credentials, "include");
  assert.equal(calls[0].init?.body, undefined);
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: "Bearer access-token",
  });
});

test("confirm envia o body exato e aceita uma resposta 204 vazia", async () => {
  const calls = installFetch(new Response(null, { status: 204 }));

  await confirmPhoneVerification("access-token", "123456");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.credentials, "include");
  assert.equal(calls[0].init?.body, JSON.stringify({ code: "123456" }));
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: "Bearer access-token",
    "Content-Type": "application/json",
  });
});

for (const status of [400, 401, 429, 503]) {
  test(`${status} produz erro tipado e não propaga mensagem interna`, async () => {
    installFetch(
      Response.json(
        { code: "KNOWN_CODE", message: "segredo interno do provider" },
        { status },
      ),
    );

    await assert.rejects(
      requestPhoneVerification("access-token"),
      (error: unknown) => {
        assert.ok(error instanceof PhoneVerificationApiError);
        assert.equal(error.status, status);
        assert.equal(error.code, "KNOWN_CODE");
        assert.doesNotMatch(error.message, /segredo|provider/iu);
        return true;
      },
    );
  });
}

test("erro de rede é convertido em mensagem sanitizada", async () => {
  globalThis.fetch = async () => {
    throw new Error("network details with token and provider");
  };

  await assert.rejects(
    requestPhoneVerification("access-token"),
    (error: unknown) => {
      assert.ok(error instanceof PhoneVerificationApiError);
      assert.equal(error.status, 0);
      assert.doesNotMatch(error.message, /network|token|provider/iu);
      return true;
    },
  );
});
