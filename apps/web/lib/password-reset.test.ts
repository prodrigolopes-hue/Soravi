import assert from "node:assert/strict";
import test from "node:test";
import { confirmPasswordReset, extractPasswordResetToken, PasswordResetApiError, passwordConfirmationMessage, passwordResetErrorMessage, passwordValidationMessage } from "./password-reset";

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
