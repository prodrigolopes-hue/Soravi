import assert from "node:assert/strict";
import test from "node:test";
import { confirmPasswordReset, extractPasswordResetToken, PasswordResetApiError, PasswordResetRequestApiError, passwordConfirmationMessage, passwordResetErrorMessage, passwordResetRequestErrorMessage, passwordResetRequestSuccessMessage, passwordValidationMessage, requestPasswordReset } from "./password-reset";

const token = "A".repeat(43);
type FetchCall = { input: string | URL | Request; init?: RequestInit };
function installFetch(response: Response): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = async (input, init) => { calls.push({ input, init }); return response; };
  return calls;
}

test("extrai token válido de #token=", () => assert.equal(extractPasswordResetToken(`#token=${token}`), token));
test("rejeita fragmento sem token", () => assert.equal(extractPasswordResetToken("#outra=chave"), null));
test("rejeita token fora do formato", () => {
  assert.equal(extractPasswordResetToken("#token=curto"), null);
  assert.equal(extractPasswordResetToken(`#token=${"!".repeat(43)}`), null);
});
test("não usa querystring", () => assert.equal(extractPasswordResetToken(`?token=${token}`), null));

test("request usa POST, body estrito e aceita 204", async () => {
  const calls = installFetch(new Response(null, { status: 204 }));
  await confirmPasswordReset(token, "senhasegura123");
  assert.match(String(calls[0].input), /\/api\/v1\/auth\/password-reset\/confirm$/u);
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { token, newPassword: "senhasegura123" });
  assert.equal(String(calls[0].init?.body).includes("email"), false);
  assert.equal(String(calls[0].init?.body).includes("userId"), false);
  assert.deepEqual(calls[0].init?.headers, { "Content-Type": "application/json" });
});

test("mapeia token inválido sem expor token", async () => {
  installFetch(Response.json({ code: "PASSWORD_RESET_INVALID_OR_EXPIRED", message: token }, { status: 400 }));
  await assert.rejects(confirmPasswordReset(token, "senhasegura123"), (error) => {
    assert.ok(error instanceof PasswordResetApiError);
    assert.equal(error.message, "O link de redefinição é inválido ou expirou. Solicite um novo link.");
    assert.equal(error.message.includes(token), false);
    return true;
  });
});

test("mapeia HTTP 429", async () => {
  installFetch(Response.json({}, { status: 429 }));
  await assert.rejects(confirmPasswordReset(token, "senhasegura123"), { message: "Muitas tentativas. Aguarde um pouco e tente novamente." });
});

test("mapeia HTTP 400 por senha inválida para a política pública", async () => {
  installFetch(Response.json({ message: "detalhe interno" }, { status: 400 }));
  await assert.rejects(confirmPasswordReset(token, "curta1"), {
    message: "A nova senha deve ter de 12 a 128 caracteres, com pelo menos uma letra e um número.",
  });
});

test("sanitiza erro genérico", async () => {
  globalThis.fetch = async () => { throw new Error(`interno ${token}`); };
  await assert.rejects(confirmPasswordReset(token, "senhasegura123"), { message: "Não foi possível redefinir sua senha agora. Tente novamente em instantes." });
  assert.equal(passwordResetErrorMessage(500).includes(token), false);
});

test("política exige 12–128, letra e número", () => {
  assert.notEqual(passwordValidationMessage("abc123"), null);
  assert.notEqual(passwordValidationMessage("a".repeat(129) + "1"), null);
  assert.notEqual(passwordValidationMessage("123456789012"), null);
  assert.notEqual(passwordValidationMessage("abcdefghijkl"), null);
  assert.equal(passwordValidationMessage("senhasegura123"), null);
});

test("não exige maiúscula e minúscula simultaneamente", () => {
  assert.equal(passwordValidationMessage("ABCDEFGHIJK1"), null);
  assert.equal(passwordValidationMessage("abcdefghijk1"), null);
});

test("confirmação diferente é rejeitada", () => {
  assert.equal(passwordConfirmationMessage("senhasegura123", "outraSenha123"), "As senhas não são iguais.");
});

test("solicitação usa POST, endpoint correto, body estrito e aceita 202", async () => {
  const calls = installFetch(new Response(null, { status: 202 }));
  await requestPasswordReset("  pessoa@example.com  ");

  assert.match(String(calls[0].input), /\/api\/v1\/auth\/password-reset\/request$/u);
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    email: "pessoa@example.com",
  });
  assert.deepEqual(calls[0].init?.headers, {
    "Content-Type": "application/json",
  });
  assert.equal(
    Object.keys(calls[0].init?.headers as Record<string, string>).some(
      (header) => header.toLowerCase() === "authorization",
    ),
    false,
  );
});

test("sucesso público é neutro e não inclui o e-mail", () => {
  assert.equal(
    passwordResetRequestSuccessMessage,
    "Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.",
  );
  assert.equal(passwordResetRequestSuccessMessage.includes("pessoa@example.com"), false);
  assert.equal(/enviado com sucesso para sua conta/iu.test(passwordResetRequestSuccessMessage), false);
});

test("solicitação mapeia HTTP 429", async () => {
  installFetch(Response.json({ message: "detalhe interno" }, { status: 429 }));
  await assert.rejects(requestPasswordReset("pessoa@example.com"), {
    message: "Muitas solicitações. Aguarde um pouco antes de tentar novamente.",
  });
});

test("solicitação sanitiza HTTP 400", async () => {
  installFetch(Response.json({ message: "detalhe interno" }, { status: 400 }));
  await assert.rejects(requestPasswordReset("inválido"), {
    message: "Digite um e-mail válido.",
  });
});

test("solicitação sanitiza erro genérico sem expor e-mail", async () => {
  const email = "pessoa@example.com";
  globalThis.fetch = async () => { throw new Error(`interno ${email}`); };

  await assert.rejects(requestPasswordReset(email), (error) => {
    assert.ok(error instanceof PasswordResetRequestApiError);
    assert.equal(
      error.message,
      "Não foi possível processar sua solicitação agora. Tente novamente em instantes.",
    );
    assert.equal(error.message.includes(email), false);
    return true;
  });
  assert.equal(passwordResetRequestErrorMessage(500).includes(email), false);
});
