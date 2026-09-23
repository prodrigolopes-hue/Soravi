import assert from "node:assert/strict";
import test from "node:test";

import {
  phoneVerificationDestination,
  phoneVerificationGuardDecision,
  postLoginDestination,
  sanitizeVerificationCode,
} from "./phone-verification-routing";

const customer = { phoneVerified: true, roles: ["CUSTOMER"] } as const;
const professional = {
  phoneVerified: true,
  roles: ["PROFESSIONAL"],
} as const;

test("define destinos por papel e fallback seguro", () => {
  assert.equal(phoneVerificationDestination(["CUSTOMER"]), "/cliente");
  assert.equal(
    phoneVerificationDestination(["PROFESSIONAL"]),
    "/profissional",
  );
  assert.equal(phoneVerificationDestination(["ADMIN"]), "/admin");
  assert.equal(phoneVerificationDestination([]), "/");
});

test("login exige telefone dos papeis comuns e libera ADMIN", () => {
  assert.equal(
    postLoginDestination({ phoneVerified: false, roles: ["CUSTOMER"] }),
    "/verificar-telefone",
  );
  assert.equal(
    postLoginDestination({ phoneVerified: false, roles: ["ADMIN"] }),
    "/admin",
  );
  assert.equal(postLoginDestination(customer), "/cliente");
  assert.equal(
    postLoginDestination(professional),
    "/profissional",
  );
  assert.equal(
    postLoginDestination({ phoneVerified: true, roles: ["UNEXPECTED"] }),
    "/",
  );
});

test("bootstrap e refresh ficam pendentes sem redirect prematuro", () => {
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: true,
      pathname: "/solicitacoes",
      user: customer,
    }),
    { type: "pending" },
  );
});

test("user null nao e decidido pelo guard de telefone", () => {
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/solicitacoes",
      user: null,
    }),
    { type: "allow" },
  );
});

test("nao verificados sao enviados para verificacao em rotas protegidas", () => {
  const cases = [
    { pathname: "/solicitacoes", roles: ["CUSTOMER"] },
    { pathname: "/profissional/oportunidades", roles: ["PROFESSIONAL"] },
    { pathname: "/conversas", roles: ["CUSTOMER"] },
    { pathname: "/notificacoes", roles: ["PROFESSIONAL"] },
  ] as const;

  for (const { pathname, roles } of cases) {
    assert.deepEqual(
      phoneVerificationGuardDecision({
        isLoading: false,
        pathname,
        user: { phoneVerified: false, roles },
      }),
      { type: "redirect", destination: "/verificar-telefone" },
    );
  }
});

test("nao verificado permanece na verificacao sem loop", () => {
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/verificar-telefone",
      user: { ...customer, phoneVerified: false },
    }),
    { type: "allow" },
  );
});

test("rotas publicas e subrotas de cadastro ficam liberadas", () => {
  for (const pathname of ["/", "/entrar", "/cadastro/cliente"]) {
    assert.deepEqual(
      phoneVerificationGuardDecision({
        isLoading: false,
        pathname,
        user: { ...customer, phoneVerified: false },
      }),
      { type: "allow" },
    );
  }
});

test("segurança da conta fica acessível sem telefone verificado", () => {
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/conta/seguranca",
      user: { ...customer, phoneVerified: false },
    }),
    { type: "allow" },
  );
});

test("verificado permanece em rota protegida", () => {
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/solicitacoes/nova",
      user: customer,
    }),
    { type: "allow" },
  );
});

test("verificados saem da verificacao para o destino do papel", () => {
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/verificar-telefone",
      user: customer,
    }),
    { type: "redirect", destination: "/cliente" },
  );
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/verificar-telefone",
      user: professional,
    }),
    { type: "redirect", destination: "/profissional" },
  );
});

test("ADMIN fica fora da exigencia e sai da verificacao para admin", () => {
  const admin = { phoneVerified: false, roles: ["ADMIN"] } as const;

  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/admin/clientes",
      user: admin,
    }),
    { type: "allow" },
  );
  assert.deepEqual(
    phoneVerificationGuardDecision({
      isLoading: false,
      pathname: "/verificar-telefone",
      user: admin,
    }),
    { type: "redirect", destination: "/admin" },
  );
});

test("papel inesperado usa fallback e destino nunca repete pathname", () => {
  const decision = phoneVerificationGuardDecision({
    isLoading: false,
    pathname: "/verificar-telefone",
    user: { phoneVerified: true, roles: ["UNEXPECTED"] },
  });

  assert.deepEqual(decision, { type: "redirect", destination: "/" });
  assert.notEqual(
    decision.type === "redirect" ? decision.destination : null,
    "/verificar-telefone",
  );
});

test("sanitiza o codigo para somente seis digitos", () => {
  assert.equal(sanitizeVerificationCode("12a 34-567"), "123456");
  assert.equal(sanitizeVerificationCode("abc"), "");
});
