import assert from "node:assert/strict";
import test from "node:test";

import { runWithAuthRefreshLock } from "./auth-refresh-lock";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

test("sem lock manager executa uma vez e devolve o resultado", async () => {
  let calls = 0;
  const result = await runWithAuthRefreshLock(async () => {
    calls += 1;
    return 42;
  }, null);

  assert.equal(calls, 1);
  assert.equal(result, 42);
});

test("usa o nome esperado e executa pelo callback do lock", async () => {
  let requests = 0;
  let insideLock = false;
  let calls = 0;
  const manager = {
    async request<T>(name: string, operation: () => Promise<T>): Promise<T> {
      requests += 1;
      assert.equal(name, "soravi-auth-refresh");
      assert.equal(calls, 0);
      insideLock = true;
      try {
        return await operation();
      } finally {
        insideLock = false;
      }
    },
  };
  const expected = { value: 42 };
  const result = await runWithAuthRefreshLock(async () => {
    assert.equal(insideLock, true);
    calls += 1;
    return expected;
  }, manager);

  assert.equal(result, expected);
  assert.equal(requests, 1);
  assert.equal(calls, 1);
  assert.equal(insideLock, false);
});

test("propaga a rejeicao da operacao com e sem lock", async () => {
  const error = new Error("refresh failed");
  const manager = {
    request<T>(_name: string, operation: () => Promise<T>): Promise<T> {
      return operation();
    },
  };

  for (const lockManager of [null, manager]) {
    await assert.rejects(
      runWithAuthRefreshLock(async () => {
        throw error;
      }, lockManager),
      (received: unknown) => received === error,
    );
  }
});

test("contrato com lock manager serializa duas operacoes", async () => {
  // Testa a integracao com o manager, nao abas ou Web Locks nativos.
  const queues = new Map<string, Promise<void>>();
  const manager = {
    request<T>(name: string, operation: () => Promise<T>): Promise<T> {
      const previous = queues.get(name) ?? Promise.resolve();
      const result = previous.then(operation);
      queues.set(name, result.then(() => {}, () => {}));
      return result;
    },
  };
  const started = deferred();
  const release = deferred();
  const events: string[] = [];
  let active = 0;

  const first = runWithAuthRefreshLock(async () => {
    active += 1;
    events.push("first:start");
    started.resolve();
    await release.promise;
    events.push("first:end");
    active -= 1;
    return "first";
  }, manager);
  const second = runWithAuthRefreshLock(async () => {
    assert.equal(active, 0);
    events.push("second:start");
    return "second";
  }, manager);

  await started.promise;
  assert.equal(active, 1);
  assert.deepEqual(events, ["first:start"]);
  release.resolve();

  assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
  assert.deepEqual(events, ["first:start", "first:end", "second:start"]);
});
