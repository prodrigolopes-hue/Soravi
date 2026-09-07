import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_HELP_TEXT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordValidationMessage,
} from "./password-policy";

test("rejeita senha vazia", () => {
  assert.equal(passwordValidationMessage(""), "Crie uma senha.");
});

test("rejeita senha com menos de 12 caracteres", () => {
  assert.notEqual(passwordValidationMessage("curta12345"), null);
});

test("rejeita senha com mais de 128 caracteres", () => {
  assert.notEqual(
    passwordValidationMessage("a".repeat(PASSWORD_MAX_LENGTH + 1)),
    null,
  );
});

test("aceita senha somente com letras a partir de 12 caracteres", () => {
  assert.equal(passwordValidationMessage("somenteletras"), null);
});

test("aceita senha somente numérica a partir de 12 caracteres", () => {
  assert.equal(passwordValidationMessage("581047293618"), null);
});

test("aceita senha somente de símbolos a partir de 12 caracteres", () => {
  assert.equal(passwordValidationMessage("!@#$%^&*()_+"), null);
});

test("aceita frase-senha", () => {
  assert.equal(
    passwordValidationMessage("correto cavalo bateria clip"),
    null,
  );
});

test("aceita senha exatamente no limite mínimo e máximo", () => {
  assert.equal(
    passwordValidationMessage("a".repeat(PASSWORD_MIN_LENGTH)),
    null,
  );
  assert.equal(
    passwordValidationMessage("a".repeat(PASSWORD_MAX_LENGTH)),
    null,
  );
});

test("texto de ajuda é factual e não menciona regras de composição", () => {
  assert.equal(
    PASSWORD_HELP_TEXT,
    "Use de 12 a 128 caracteres. Evite senhas comuns ou fáceis de adivinhar.",
  );
});
