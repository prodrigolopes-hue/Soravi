import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldConfigureGoogleAnalytics,
  shouldInitializeGoogleAnalytics,
  shouldSetDefaultGoogleAnalyticsConsent,
  shouldSendGoogleAnalyticsPageView,
} from "./google-analytics-lifecycle";

test("estabelece consent default negado antes da inicializacao", () => {
  assert.equal(shouldSetDefaultGoogleAnalyticsConsent(false), true);
  assert.equal(shouldInitializeGoogleAnalytics(false, false), false);
  assert.equal(shouldSetDefaultGoogleAnalyticsConsent(true), false);
});

test("inicializa somente uma vez depois do consentimento aceito", () => {
  assert.equal(shouldInitializeGoogleAnalytics(false, false), false);
  assert.equal(shouldInitializeGoogleAnalytics(true, false), true);
  assert.equal(shouldInitializeGoogleAnalytics(true, true), false);
});

test("configura somente depois de gtag.js carregar", () => {
  assert.equal(shouldConfigureGoogleAnalytics(true, false, false), false);
  assert.equal(shouldConfigureGoogleAnalytics(true, true, false), true);
  assert.equal(shouldConfigureGoogleAnalytics(true, true, true), false);
  assert.equal(shouldConfigureGoogleAnalytics(false, true, false), false);
});

test("envia page view inicial e uma vez por navegacao elegivel", () => {
  assert.equal(
    shouldSendGoogleAnalyticsPageView(true, true, null, "/"),
    true,
  );
  assert.equal(
    shouldSendGoogleAnalyticsPageView(true, true, "/", "/"),
    false,
  );
  assert.equal(
    shouldSendGoogleAnalyticsPageView(true, true, "/", "/solicitacoes"),
    true,
  );
  assert.equal(
    shouldSendGoogleAnalyticsPageView(false, true, null, "/"),
    false,
  );
  assert.equal(
    shouldSendGoogleAnalyticsPageView(true, false, null, "/"),
    false,
  );
});
