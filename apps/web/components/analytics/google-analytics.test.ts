import assert from "node:assert/strict";
import test from "node:test";

import { ensureGtag } from "./google-analytics";

test("stub gtag enfileira o objeto Arguments oficial", () => {
  const previousWindow = globalThis.window;
  const fakeWindow = {
    dataLayer: [] as unknown[],
  } as unknown as Window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });

  try {
    const gtagWindow = ensureGtag();
    gtagWindow.gtag?.("event", "soravi_ga4_isolado");

    assert.equal(gtagWindow.dataLayer?.length, 1);

    const queuedCommand = gtagWindow.dataLayer?.[0];
    assert.equal(Array.isArray(queuedCommand), false);
    assert.equal(Object.prototype.toString.call(queuedCommand), "[object Arguments]");
    assert.deepEqual(Array.from(queuedCommand as IArguments), [
      "event",
      "soravi_ga4_isolado",
    ]);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
