import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildCorpus, serializeCorpus, hydrateCorpus } from '../src/rankings/corpus.mjs';

const serverSource = fs.readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
function server(corpus) {
  const context = vm.createContext({
    rankingsCorpus: corpus, hydrateCorpus, Response, Request, URL, URLSearchParams,
    page: '<!doctype html><title>Test</title>',
  });
  vm.runInContext(serverSource.replace('export default {', 'globalThis.handler = {'), context);
  return (path) => context.handler.fetch(new Request('https://tabbetter.test' + path), {}, { waitUntil() {} });
}
const populated = serializeCorpus(buildCorpus([
  { season: '2025-2026', event: 'LD', rankings: [{ rank: 1, code: 'Test AB', name: 'Alpha Beta', elo: 1800 }] },
], { from: '2025-08-01', to: '2026-07-31', sourceUrl: 'https://example.org/rankings', retrievedAt: '2026-10-28T00:00:00.000Z' }));

for (const [label, corpus] of [['populated', populated], ['absent', null]]) {
  test('rankings must revalidate before reuse with a ' + label + ' corpus', async () => {
    const get = server(corpus);
    const response = await get('/api/rankings?event=Lincoln-Douglas&season=2025-2026');
    assert.equal(response.status, 200);
    const directives = response.headers.get('cache-control').split(',').map((d) => d.trim());
    assert.ok(directives.includes('no-cache') || directives.includes('no-store') || directives.includes('max-age=0'),
      'must-revalidate alone does not prevent fresh-cache reuse: ' + directives.join(', '));
    const body = await response.json();
    assert.equal(body.available, Boolean(corpus));
  });
  test('ranking input syntax is validated with a ' + label + ' corpus', async () => {
    const get = server(corpus);
    for (const event of ['', '<script>', 'LD\n', 'x'.repeat(101)]) {
      const response = await get('/api/rankings?event=' + encodeURIComponent(event));
      assert.equal(response.status, 400, JSON.stringify(event));
    }
    for (const season of ['invalid', '2026-2025', '2025-2027']) {
      const response = await get('/api/rankings?event=Lincoln-Douglas&season=' + season);
      assert.equal(response.status, 400, season);
    }
  });
}

test('an absent corpus reports unavailable rather than guessing event coverage', async () => {
  const response = await server(null)('/api/rankings?event=New%20Speech%20Event');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).available, false);
});

test('a populated corpus rejects a well-formed event it does not cover', async () => {
  const response = await server(populated)('/api/rankings?event=New%20Speech%20Event');
  assert.equal(response.status, 400);
});
