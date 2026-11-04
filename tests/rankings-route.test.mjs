import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('worker/index.js', 'utf8');
const { default: handler } = await import('../worker/index.js?rankings=' + Date.now());
const get = (path) => handler.fetch(new Request('https://tabbetter.com' + path), {}, { waitUntil() {} });

test('the rankings route reports availability instead of failing', async () => {
  const response = await get('/api/rankings?event=Lincoln-Douglas&season=2025-2026');
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
  assert.ok(body.competitors.every((c) => c.event === 'Lincoln-Douglas' && c.season === '2025-2026'));
});

test('rankings input is validated like every other upstream parameter', async () => {
  for (const path of ['/api/rankings?event=<script>&season=2025-2026', '/api/rankings?event=Lincoln-Douglas&season=bogus', '/api/rankings?event=Lincoln-Douglas&season=2026-2025']) {
    const response = await get(path);
    assert.equal(response.status, 400, path + ' must be rejected');
  }
});

test('event coverage is checked when known, otherwise corpus absence is reported', async () => {
  const response = await get('/api/rankings?event=NotAnEvent&season=2025-2026');
  if (/const rankingsCorpus = null;/.test(worker)) {
    assert.equal(response.status, 200);
    assert.equal((await response.json()).available, false);
  } else {
    assert.equal(response.status, 400);
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
  const response = await get('/api/rankings?event=Lincoln-Douglas&season=2025-2026');
  const cacheControl = response.headers.get('cache-control') || '';
  assert.match(cacheControl, /(?:^|,\s*)(?:no-cache|no-store|max-age=0)(?:,|$)/, 'a client must recheck before reusing rankings: ' + cacheControl);
});

test('an omitted season resolves to the latest season that event actually has', async () => {
  const response = await get('/api/rankings?event=' + encodeURIComponent('Dramatic Interp'));
  const body = await response.json();
  if (body.available === false) return;
  assert.ok(body.competitors.length > 0, 'a covered event returns its rows without naming a season');
  assert.ok(body.seasons.includes(body.season), 'the resolved season is one the event publishes');
  assert.ok(body.competitors.every((c) => c.season === body.season));
});

test('each event reports the provider that actually published it', async () => {
  const speech = await (await get('/api/rankings?event=' + encodeURIComponent('Dramatic Interp'))).json();
  if (speech.available === false) return;
  assert.match(speech.provider, /National Speech/, 'a nationals placement is credited to the NSDA, not a rating archive');
  assert.doesNotMatch(speech.methodology, /Elo/, 'a placement is not an Elo rating');
  const parli = await (await get('/api/rankings?event=Parliamentary')).json();
  assert.match(parli.provider, /Parliamentary/);
  const ld = await (await get('/api/rankings?event=' + encodeURIComponent('Lincoln-Douglas'))).json();
  assert.match(ld.provider, /DebateDrills/);
});
