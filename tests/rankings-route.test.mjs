import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('worker/index.js', 'utf8');
const { default: handler } = await import('../worker/index.js?rankings=' + Date.now());
const get = (path) => handler.fetch(new Request('https://tabbetter.com' + path), {}, { waitUntil() {} });

test('the rankings route reports availability instead of failing', async () => {
  const response = await get('/api/rankings?event=LD&season=2025-2026');
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  const body = await response.json();
  if (body.available === false) {
    assert.match(body.reason, /not included/i, 'an absent corpus is explained, not faked');
    assert.equal(response.status, 200);
    return;
  }
  assert.equal(response.status, 200);
  assert.equal(body.provider, 'DebateDrills x NSD x DebateLand');
  assert.ok(Array.isArray(body.competitors));
  assert.ok(body.competitors.every((c) => c.event === 'LD' && c.season === '2025-2026'));
});

test('rankings input is validated like every other upstream parameter', async () => {
  for (const path of ['/api/rankings?event=<script>&season=2025-2026', '/api/rankings?event=LD&season=bogus', '/api/rankings?event=Congress&season=2025-2026']) {
    const response = await get(path);
    assert.equal(response.status, 400, path + ' must be rejected');
  }
});

test('the bundled worker never embeds a corpus without recorded provenance', () => {
  // `const rankingsCorpus = null` is the supported no-corpus build.
  if (/const rankingsCorpus = null;/.test(worker)) {
    assert.doesNotMatch(worker, /"rows":\[\[/, 'a null corpus must carry no rows');
    return;
  }
  assert.match(worker, /skumar-ml\/debate-rankings/, 'an embedded corpus must carry its source URL');
  assert.match(worker, /DebateDrills x NSD x DebateLand/, 'an embedded corpus must name its provider');
});

test('rankings responses are revalidated so a redeploy cannot serve a stale corpus for an hour', async () => {
  const response = await get('/api/rankings?event=LD&season=2025-2026');
  const cacheControl = response.headers.get('cache-control') || '';
  assert.match(cacheControl, /must-revalidate|no-cache|max-age=0/, 'a client must recheck before reusing rankings: ' + cacheControl);
});
