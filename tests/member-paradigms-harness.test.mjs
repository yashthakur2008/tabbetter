import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual harness wrapper without launching Chromium or requiring a
// generated worker. The recording transport makes dropped fetch options visible.
const source = fs.readFileSync('scripts/test-member-paradigms-browser.cjs', 'utf8');
const start = source.indexOf('  globalThis.fetch =');
const end = source.indexOf('  const workerRequest =', start);
assert.ok(start >= 0 && end > start, 'locate the harness fetch boundary');
function passthrough() {
  const calls = [];
  const context = vm.createContext({
    URL, Response, AbortSignal, assert,
    process: { argv: ['node', 'harness', '--live'] },
    upstreamCalls: [],
    originalFetch: async (...args) => {
      calls.push(args);
      return new Response(null, { status: 302, headers: { location: '/user/login/login.mhtml' } });
    },
  });
  vm.runInContext(source.slice(start, end), context);
  return { fetch: context.fetch, calls };
}
const url = 'https://www.tabroom.com/api/download_data.mhtml?tourn_id=41209';
for (const field of ['redirect', 'headers', 'signal']) {
  test(`live harness preserves worker fetch ${field}`, async () => {
    const transport = passthrough();
    const controller = new AbortController();
    const init = {
      redirect: 'manual',
      headers: { 'User-Agent': 'TabBetter/0.1 public tournament companion' },
      signal: controller.signal,
    };
    const response = await transport.fetch(url, init);
    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0][1]?.[field], init[field]);
    assert.equal(response.status, 302, 'redirect status reaches the worker unchanged');
    if (field === 'signal') {
      controller.abort();
      assert.equal(transport.calls[0][1].signal.aborted, true, 'worker cancellation reaches live transport');
    }
  });
}
test('live harness preserves Request input and its embedded fetch policy', async () => {
  const transport = passthrough();
  const request = new Request(url, {
    redirect: 'manual', headers: { 'User-Agent': 'TabBetter/0.1 public tournament companion' },
  });
  await transport.fetch(request);
  assert.equal(transport.calls[0][0], request, 'do not reduce a Request to a URL');
  assert.equal(transport.calls[0][1], undefined, 'do not inject a replacement deadline');
});
