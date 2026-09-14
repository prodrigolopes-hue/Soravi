import assert from "node:assert/strict";
import test from "node:test";

import { createAuthenticatedFetch } from "./auth-fetch-retry";

const apiBaseUrl = "https://api.staging.example.test";

test("renova e repete uma requisição autenticada que recebe 401", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return calls.length === 1
      ? new Response(null, { status: 401 })
      : Response.json({ ok: true });
  };
  const authenticatedFetch = createAuthenticatedFetch(
    fetchImplementation,
    apiBaseUrl,
    async () => ({ accessToken: "new-access-token" }),
  );

  const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/users/me`, {
    headers: { Authorization: "Bearer expired-access-token" },
    credentials: "include",
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(
    new Headers(calls[1]?.init?.headers).get("Authorization"),
    "Bearer new-access-token",
  );
});

test("não repete quando o refresh falha", async () => {
  let calls = 0;
  const authenticatedFetch = createAuthenticatedFetch(
    async () => {
      calls += 1;
      return new Response(null, { status: 401 });
    },
    apiBaseUrl,
    async () => null,
  );

  const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/users/me`, {
    headers: { Authorization: "Bearer expired-access-token" },
  });

  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});

test("não intercepta o endpoint de refresh", async () => {
  let refreshCalls = 0;
  const authenticatedFetch = createAuthenticatedFetch(
    async () => new Response(null, { status: 401 }),
    apiBaseUrl,
    async () => {
      refreshCalls += 1;
      return { accessToken: "new-access-token" };
    },
  );

  await authenticatedFetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  assert.equal(refreshCalls, 0);
});
