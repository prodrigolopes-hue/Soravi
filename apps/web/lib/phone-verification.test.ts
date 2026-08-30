import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmPhoneVerification,
  CurrentUserPhoneApiError,
  formatBrazilianPhoneInput,
  PhoneVerificationApiError,
  requestPhoneVerification,
  updateCurrentUserPhone,
} from "./phone-verification";

test("máscara de telefone aceita entrada somente com dígitos", () => {
  assert.equal(formatBrazilianPhoneInput("21999999999"), "(21) 99999-9999");
});

test("máscara de telefone formata entradas parciais", () => {
  assert.equal(formatBrazilianPhoneInput("2"), "(2");
  assert.equal(formatBrazilianPhoneInput("21"), "(21)");
  assert.equal(formatBrazilianPhoneInput("213"), "(21) 3");
});

test("máscara de telefone formata fixo com dez dígitos", () => {
  assert.equal(formatBrazilianPhoneInput("2133334444"), "(21) 3333-4444");
});

test("máscara de telefone formata celular com onze dígitos", () => {
  assert.equal(formatBrazilianPhoneInput("21999999999"), "(21) 99999-9999");
});

test("máscara de telefone trunca entrada acima de onze dígitos", () => {
  assert.equal(
    formatBrazilianPhoneInput("219999999991234"),
    "(21) 99999-9999",
  );
});

test("máscara de telefone ignora caracteres não numéricos", () => {
  assert.equal(
    formatBrazilianPhoneInput("abc(21) 9x9999-9999xyz"),
    "(21) 99999-9999",
  );
});

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

test("alteração de telefone usa PATCH autenticado e body estrito", async () => {
  const calls = installFetch(Response.json({ data: {} }, { status: 200 }));
  const formattedPhone = formatBrazilianPhoneInput("21988887777");

  await updateCurrentUserPhone("access-token", {
    phone: formattedPhone,
    currentPassword: "senha atual",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init?.method, "PATCH");
  assert.equal(calls[0].init?.credentials, "include");
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: "Bearer access-token",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    phone: "(21) 98888-7777",
    currentPassword: "senha atual",
  });
  assert.equal(String(calls[0].init?.body).includes("userId"), false);
});

for (const [code, message] of [
  ["INVALID_CURRENT_PASSWORD", "Não foi possível confirmar sua senha."],
  ["INVALID_BRAZILIAN_PHONE", "Informe um telefone brasileiro válido com DDD."],
  ["PHONE_ALREADY_IN_USE", "Este telefone já está sendo utilizado."],
] as const) {
  test(`alteração de telefone mapeia ${code}`, async () => {
    installFetch(Response.json({ code, message: "detalhe interno" }, { status: 400 }));

    await assert.rejects(
      updateCurrentUserPhone("access-token", {
        phone: "(11) 98888-7777",
        currentPassword: "senha atual",
      }),
      (error: unknown) => {
        assert.ok(error instanceof CurrentUserPhoneApiError);
        assert.equal(error.code, code);
        assert.equal(error.message, message);
        assert.doesNotMatch(error.message, /interno/iu);
        return true;
      },
    );
  });
}

for (const [status, message] of [
  [401, "Sua sessão expirou. Entre novamente para continuar."],
  [429, "Muitas tentativas. Aguarde um pouco e tente novamente."],
] as const) {
  test(`alteração de telefone mapeia HTTP ${status}`, async () => {
    installFetch(Response.json({ message: "detalhe interno" }, { status }));

    await assert.rejects(
      updateCurrentUserPhone("access-token", {
        phone: "(11) 98888-7777",
        currentPassword: "senha atual",
      }),
      (error: unknown) => {
        assert.ok(error instanceof CurrentUserPhoneApiError);
        assert.equal(error.status, status);
        assert.equal(error.message, message);
        return true;
      },
    );
  });
}
