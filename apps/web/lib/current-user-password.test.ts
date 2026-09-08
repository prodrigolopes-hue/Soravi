import assert from "node:assert/strict";
import test from "node:test";

import {
  CurrentUserPasswordApiError,
  updateCurrentUserPassword,
} from "./current-user-password";

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

test("altera senha com PATCH autenticado, credenciais e body estrito", async () => {
  const calls = installFetch(new Response(null, { status: 204 }));

  await updateCurrentUserPassword("access-token", {
    currentPassword: " senha atual ",
    newPassword: " nova senha ok ",
  });

  assert.equal(calls.length, 1);
  assert.match(String(calls[0].input), /\/api\/v1\/users\/me\/password$/u);
  assert.equal(calls[0].init?.method, "PATCH");
  assert.equal(calls[0].init?.credentials, "include");
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: "Bearer access-token",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    currentPassword: " senha atual ",
    newPassword: " nova senha ok ",
  });
  assert.equal(String(calls[0].init?.body).includes("confirmation"), false);
  assert.equal(String(calls[0].init?.body).includes("passwordConfirmation"), false);
});

test("204 resolve sem exigir corpo", async () => {
  installFetch(new Response(null, { status: 204 }));

  await assert.doesNotReject(
    updateCurrentUserPassword("access-token", {
      currentPassword: "senha atual",
      newPassword: "nova senha ok",
    }),
  );
});

for (const [payload, expectedCode, expectedMessage] of [
  [
    { code: "INVALID_CURRENT_PASSWORD", message: "detalhe interno" },
    "INVALID_CURRENT_PASSWORD",
    "Não foi possível confirmar sua senha atual.",
  ],
  [
    { error: { code: "NEW_PASSWORD_MUST_DIFFER" }, message: "detalhe interno" },
    "NEW_PASSWORD_MUST_DIFFER",
    "A nova senha deve ser diferente da senha atual.",
  ],
  [
    { code: "PASSWORD_TOO_COMMON", message: "detalhe interno" },
    "PASSWORD_TOO_COMMON",
    "Escolha uma senha menos comum e difícil de adivinhar.",
  ],
] as const) {
  test(`mapeia ${expectedCode} sem expor mensagem arbitrária`, async () => {
    installFetch(Response.json(payload, { status: 400 }));

    await assert.rejects(
      updateCurrentUserPassword("access-token", {
        currentPassword: "senha atual",
        newPassword: "nova senha ok",
      }),
      (error: unknown) => {
        assert.ok(error instanceof CurrentUserPasswordApiError);
        assert.equal(error.status, 400);
        assert.equal(error.code, expectedCode);
        assert.equal(error.message, expectedMessage);
        assert.doesNotMatch(error.message, /interno/iu);
        return true;
      },
    );
  });
}

for (const [status, expectedMessage] of [
  [401, "Sua sessão expirou. Entre novamente para continuar."],
  [429, "Muitas tentativas. Aguarde um pouco e tente novamente."],
] as const) {
  test(`mapeia HTTP ${status}`, async () => {
    installFetch(Response.json({ message: "segredo do backend" }, { status }));

    await assert.rejects(
      updateCurrentUserPassword("access-token", {
        currentPassword: "senha atual",
        newPassword: "nova senha ok",
      }),
      (error: unknown) => {
        assert.ok(error instanceof CurrentUserPasswordApiError);
        assert.equal(error.status, status);
        assert.equal(error.message, expectedMessage);
        assert.doesNotMatch(error.message, /segredo|backend/iu);
        return true;
      },
    );
  });
}

test("erro genérico não expõe conteúdo arbitrário do backend", async () => {
  installFetch(
    Response.json(
      { message: "stack trace com segredo e token" },
      { status: 500 },
    ),
  );

  await assert.rejects(
    updateCurrentUserPassword("access-token", {
      currentPassword: "senha atual",
      newPassword: "nova senha ok",
    }),
    (error: unknown) => {
      assert.ok(error instanceof CurrentUserPasswordApiError);
      assert.equal(
        error.message,
        "Não foi possível alterar sua senha agora. Tente novamente em instantes.",
      );
      assert.doesNotMatch(error.message, /stack|segredo|token/iu);
      return true;
    },
  );
});

test("falha de rede resulta em mensagem sanitizada", async () => {
  globalThis.fetch = async () => {
    throw new Error("network failure with token and password");
  };

  await assert.rejects(
    updateCurrentUserPassword("access-token", {
      currentPassword: "senha atual",
      newPassword: "nova senha ok",
    }),
    (error: unknown) => {
      assert.ok(error instanceof CurrentUserPasswordApiError);
      assert.equal(error.status, 0);
      assert.equal(
        error.message,
        "Não foi possível alterar sua senha agora. Tente novamente em instantes.",
      );
      assert.doesNotMatch(error.message, /network|token|password/iu);
      return true;
    },
  );
});