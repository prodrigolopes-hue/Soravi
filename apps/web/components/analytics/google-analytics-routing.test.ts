import assert from "node:assert/strict";
import test from "node:test";

import {
  canTrackAnalytics,
  createAnalyticsPageLocation,
  googleAnalyticsCookieDomains,
  isAdminPath,
  sanitizeAnalyticsPathname,
  sanitizeAnalyticsReferrer,
  sanitizeAnalyticsUtmSearch,
  safeAnalyticsPageTitle,
  shouldSendAnalyticsPageView,
} from "./google-analytics-routing";

const acceptedPreference = {
  analytics: "accepted",
  status: "accepted",
  updatedAt: "2026-10-07T00:00:00.000Z",
  version: 1,
} as const;

test("analytics requer consentimento explícito", () => {
  assert.equal(canTrackAnalytics(null, "/"), false);
  assert.equal(
    canTrackAnalytics({ ...acceptedPreference, analytics: "rejected", status: "rejected" }, "/"),
    false,
  );
  assert.equal(canTrackAnalytics(acceptedPreference, "/"), true);
});

test("rotas administrativas e subrotas não são rastreadas", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/clientes"), true);
  assert.equal(canTrackAnalytics(acceptedPreference, "/admin/categorias"), false);
  assert.equal(isAdminPath("/administracao"), false);
});

test("sanitiza rotas dinâmicas e descarta query strings", () => {
  assert.equal(
    sanitizeAnalyticsPathname("/solicitacoes/identificador-privado?email=pessoa@example.com"),
    "/solicitacoes/[serviceRequestId]",
  );
  assert.equal(
    sanitizeAnalyticsPathname("/conversas/conversa-privada#telefone=5511999999999"),
    "/conversas/[conversationId]",
  );
  assert.equal(
    sanitizeAnalyticsPathname("/profissional/oportunidades/oportunidade-privada"),
    "/profissional/oportunidades/[opportunityId]",
  );
  assert.equal(sanitizeAnalyticsPathname("/rota-nao-mapeada/valor-privado"), "/other");
});

test("emite uma visualização por navegação, sem duplicar renderizações", () => {
  assert.equal(shouldSendAnalyticsPageView(null, "/"), true);
  assert.equal(shouldSendAnalyticsPageView("/", "/"), false);
  assert.equal(
    shouldSendAnalyticsPageView("/solicitacoes/primeira", "/solicitacoes/segunda"),
    true,
  );
});

test("prioriza rotas estaticas e exige um unico segmento dinamico", () => {
  assert.equal(sanitizeAnalyticsPathname("/solicitacoes/nova"), "/solicitacoes/nova");
  assert.equal(sanitizeAnalyticsPathname("/solicitacoes/primeira/segunda"), "/other");
  assert.equal(sanitizeAnalyticsPathname("/conversas/conversa/extra"), "/other");
});

test("sanitiza referrer sem perder origem segura", () => {
  assert.equal(
    sanitizeAnalyticsReferrer(
      "https://soravi.com.br/solicitacoes/identificador?email=pessoa@example.com",
      "https://soravi.com.br",
    ),
    "https://soravi.com.br/solicitacoes/[serviceRequestId]",
  );
  assert.equal(
    sanitizeAnalyticsReferrer(
      "https://origem.example/campanha?telefone=5511999999999",
      "https://soravi.com.br",
    ),
    "https://origem.example/",
  );
  assert.equal(
    sanitizeAnalyticsReferrer("not-a-url", "https://soravi.com.br"),
    undefined,
  );
});

test("limpa cookies somente em dominios permitidos da Soravi", () => {
  assert.deepEqual(googleAnalyticsCookieDomains("soravi.com.br"), [
    "soravi.com.br",
    ".soravi.com.br",
  ]);
  assert.deepEqual(googleAnalyticsCookieDomains("www.soravi.com.br"), [
    "www.soravi.com.br",
    ".www.soravi.com.br",
    "soravi.com.br",
    ".soravi.com.br",
  ]);
  assert.deepEqual(googleAnalyticsCookieDomains("localhost"), ["localhost"]);
});

test("preserva apenas UTMs de campanha validas", () => {
  assert.equal(
    sanitizeAnalyticsUtmSearch(
      "?utm_source=google&utm_medium=cpc&utm_campaign=lancamento_2026&ignored=valor",
    ),
    "?utm_source=google&utm_medium=cpc&utm_campaign=lancamento_2026",
  );
  assert.equal(
    sanitizeAnalyticsUtmSearch(
      "?utm_source=pessoa%40example.com&utm_medium=5511999999999&utm_campaign=https%3A%2F%2Fexample.com&utm_term=nao-enviar",
    ),
    "",
  );
  assert.equal(
    sanitizeAnalyticsUtmSearch("?utm_source=campanha+com+espacos"),
    "",
  );
});

test("inclui UTMs somente na primeira pagina de entrada", () => {
  const campaignSearch = "?utm_source=google&utm_medium=cpc&utm_campaign=outubro";

  assert.equal(
    createAnalyticsPageLocation("https://soravi.com.br", "/", campaignSearch, true),
    "https://soravi.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=outubro",
  );
  assert.equal(
    createAnalyticsPageLocation(
      "https://soravi.com.br",
      "/solicitacoes/identificador-privado",
      campaignSearch,
      false,
    ),
    "https://soravi.com.br/solicitacoes/[serviceRequestId]",
  );
});

test("usa titulos estaticos e seguros para analytics", () => {
  assert.equal(safeAnalyticsPageTitle("/solicitacoes/identificador-privado"), "Soravi | Solicitação");
  assert.equal(safeAnalyticsPageTitle("/rota-com-conteudo-privado"), "Soravi");
});
