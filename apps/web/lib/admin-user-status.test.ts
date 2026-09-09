import assert from "node:assert/strict";
import test from "node:test";

import { AdminUserStatusApiError, updateAdminUserStatus } from "./admin-user-status";

type FetchCall = { input: string | URL | Request; init?: RequestInit };

function installFetch(response: Response): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return response;
  };
  return calls;
}

test("envia PATCH autenticado para a URL correta com body estrito", async () => {
  const calls = installFetch(new Response(null, { status: 204 }));
  await updateAdminUserStatus("access-token", "user/id", "BLOCKED");

  assert.equal(calls.length, 1);
  assert.match(String(calls[0].input), /\/api\/v1\/users\/admin\/user%2Fid\/status$/u);
  assert.equal(calls[0].init?.method, "PATCH");
  assert.equal(calls[0].init?.credentials, "include");
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: "Bearer access-token",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { status: "BLOCKED" });
  assert.deepEqual(Object.keys(JSON.parse(String(calls[0].init?.body))), ["status"]);
});

test("somente 204 é sucesso", async () => {
  installFetch(new Response(null, { status: 200 }));
  await assert.rejects(updateAdminUserStatus("token", "user-id", "ACTIVE"), AdminUserStatusApiError);
});

for (const [payload, expectedCode, expectedMessage] of [
  [{ code: "ADMIN_SELF_STATUS_CHANGE_FORBIDDEN", message: "interno" }, "ADMIN_SELF_STATUS_CHANGE_FORBIDDEN", "Você não pode alterar o status da própria conta administrativa."],
  [{ error: { code: "ADMIN_TARGET_STATUS_CHANGE_FORBIDDEN" }, message: "interno" }, "ADMIN_TARGET_STATUS_CHANGE_FORBIDDEN", "Contas administrativas não podem ser alteradas por esta ação."],
  [{ code: "USER_STATUS_TRANSITION_NOT_ALLOWED", message: "interno" }, "USER_STATUS_TRANSITION_NOT_ALLOWED", "Esta conta não pode ter o status alterado por esta ação."],
] as const) {
  test(`mapeia ${expectedCode}`, async () => {
    installFetch(Response.json(payload, { status: expectedCode === "USER_STATUS_TRANSITION_NOT_ALLOWED" ? 400 : 403 }));
    await assert.rejects(updateAdminUserStatus("token", "user-id", "BLOCKED"), (error: unknown) => {
      assert.ok(error instanceof AdminUserStatusApiError);
      assert.equal(error.code, expectedCode);
      assert.equal(error.message, expectedMessage);
      assert.doesNotMatch(error.message, /interno/iu);
      return true;
    });
  });
}

for (const [status, message] of [
  [401, "Sua sessão expirou. Entre novamente para continuar."],
  [403, "Você não tem permissão para realizar esta ação."],
  [404, "A conta não foi encontrada ou não está mais disponível."],
] as const) {
  test(`mapeia HTTP ${status}`, async () => {
    installFetch(Response.json({ message: "segredo" }, { status }));
    await assert.rejects(updateAdminUserStatus("token", "user-id", "ACTIVE"), (error: unknown) => {
      assert.ok(error instanceof AdminUserStatusApiError);
      assert.equal(error.status, status);
      assert.equal(error.message, message);
      return true;
    });
  });
}

test("sanitiza erro genérico", async () => {
  installFetch(Response.json({ message: "stack trace secreto" }, { status: 500 }));
  await assert.rejects(updateAdminUserStatus("token", "user-id", "ACTIVE"), (error: unknown) => {
    assert.ok(error instanceof AdminUserStatusApiError);
    assert.equal(error.message, "Não foi possível alterar o status da conta agora. Tente novamente.");
    assert.doesNotMatch(error.message, /stack|secreto/iu);
    return true;
  });
});

test("sanitiza falha de rede", async () => {
  globalThis.fetch = async () => { throw new Error("network token user-id"); };
  await assert.rejects(updateAdminUserStatus("token", "user-id", "ACTIVE"), (error: unknown) => {
    assert.ok(error instanceof AdminUserStatusApiError);
    assert.equal(error.status, 0);
    assert.equal(error.message, "Não foi possível alterar o status da conta agora. Tente novamente.");
    return true;
  });
});
