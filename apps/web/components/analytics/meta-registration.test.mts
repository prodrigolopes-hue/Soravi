import test from "node:test";
import assert from "node:assert/strict";
import { META_REGISTRATION_EVENT, notifyMetaRegistration } from "./meta-registration.ts";

test("não bloqueia o cadastro quando não há Pixel ativo", async () => {
  const previous = globalThis.window;
  const target = new EventTarget();
  Object.assign(target, { setTimeout, clearTimeout });
  Object.assign(globalThis, { window: target });
  try { await notifyMetaRegistration(50); } finally { Object.assign(globalThis, { window: previous }); }
});

test("aguarda a confirmação interna de envio e não repassa dados pessoais", async () => {
  const previous = globalThis.window;
  const target = new EventTarget();
  Object.assign(target, { setTimeout, clearTimeout });
  Object.assign(globalThis, { window: target });
  target.addEventListener(META_REGISTRATION_EVENT, (event) => {
    const detail = (event as CustomEvent).detail;
    assert.deepEqual(Object.keys(detail).sort(), ["complete", "handled"]);
    detail.handled = true;
    setTimeout(detail.complete, 5);
  });
  try { await notifyMetaRegistration(100); } finally { Object.assign(globalThis, { window: previous }); }
});

test("não bloqueia indefinidamente se a confirmação não chegar", async () => {
  const previous = globalThis.window;
  const target = new EventTarget();
  Object.assign(target, { setTimeout, clearTimeout });
  Object.assign(globalThis, { window: target });
  target.addEventListener(META_REGISTRATION_EVENT, (event) => { (event as CustomEvent).detail.handled = true; });
  try { await notifyMetaRegistration(5); } finally { Object.assign(globalThis, { window: previous }); }
});
