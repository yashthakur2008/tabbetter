import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
test("host cache restrictions fall back safely and coalesce repeated fetches", async () => {
  const originalFetch = globalThis.fetch,
    originalCaches = globalThis.caches;
  let calls = 0;
  globalThis.caches = {
    open: async () => {
      throw Error("Cache unavailable");
    },
    get default() {
      throw Error("Default forbidden");
    },
  };
  globalThis.fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({ id: 777, public: "true", name: "Runtime fixture" }),
      { headers: { "content-type": "application/json" } },
    );
  };
  try {
    const req = new Request("https://example.com/api/tournament?id=777");
    const first = await worker.fetch(req, {}, { waitUntil: () => {} });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).name, "Runtime fixture");
    const second = await worker.fetch(req, {}, { waitUntil: () => {} });
    assert.equal(second.status, 200);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});
test("invalid identifiers fail before an upstream request", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/tournament?id=https://bad.example"),
    {},
    {},
  );
  assert.equal(response.status, 400);
});
