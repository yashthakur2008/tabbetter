// Run `npm run build` first. Set TABBETTER_PLAYWRIGHT_MODULE to an installed
// Playwright module. Default: synthetic public exports through the real worker.
// --live additionally reads public 41209 data and probes the official redirect
// without following login or requesting authenticated paradigm contents.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.TABBETTER_PLAYWRIGHT_MODULE || 'playwright');

const cases = [
  { id: '101', ids: ['901'], want: '901', label: 'explicit ID' },
  { id: '102', ids: ['', null], want: '', label: 'missing IDs' },
  { id: '103', ids: ['0', '-1', '01', 'x', '1.5'], want: '', label: 'invalid IDs' },
  { id: '104', ids: ['904', '904'], want: '904', label: 'duplicate ID' },
  { id: '105', ids: ['905', '906', '905'], want: '', label: 'conflicting IDs' },
  { id: '106', ids: ['', '907'], want: '907', label: 'first missing, later valid' },
  { id: '107', ids: ['908'], registration: '999', want: '', label: 'unmatched registration' },
  { id: '108', ids: ['909'], registration: '', want: '', label: 'missing registration' },
];
const raw = {
  id: '91001', name: 'Synthetic Public Identity Cases', public: 'true',
  start: '2026-11-16', end: '2026-11-18', timezone: 'UTC',
  schools: [{ id: '1', name: 'Fixture School', entries: [
    { id: '201', name: 'Fixture Entry', code: 'Fixture E', school: '1', event: '1' },
  ] }],
  categories: [{ name: 'Fixture Pool',
    // All names deliberately identical. Only registrations may join identities.
    judges: cases.map(c => ({ id: c.id, first: 'Same', last: 'Name', school: '1' })),
    events: [{ id: '1', name: 'Public Forum', type: 'debate', rounds: cases.flatMap(c => c.ids.map((id, i) => ({
      id: c.id + i, label: c.label + ' ' + i, sections: [{ id: c.id + i, room: 'Public Room', ballots: [{
        entry: '201', entry_code: 'Fixture E', judge: c.registration ?? c.id,
        judge_first: 'Same', judge_last: 'Name', judge_person: id,
        side: '1', scores: [{ tag: 'winloss', value: '1' }],
      }] }],
    }))) }],
  }],
};
const officialURL = id => 'https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=' + id;
async function checkLink(link, personId) {
  assert.equal(await link.count(), personId ? 1 : 0);
  if (!personId) return;
  assert.equal(await link.getAttribute('href'), officialURL(personId));
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.match(await link.getAttribute('rel'), /\bnoopener\b/);
  assert.match(await link.innerText(), /login required/);
}
async function checkMember(page, tournamentId, registration, personId) {
  const route = '#tournament/' + tournamentId + '/member/judge:registration:' + registration;
  const member = page.locator('#people-list a.member-link[href="' + route + '"]');
  const row = member.locator('xpath=ancestor::tr');
  await checkLink(row.locator('.paradigm-link'), personId);
  await member.click();
  await page.waitForURL('**/' + route);
  await page.locator('.member-card').waitFor();
  await checkLink(page.locator('.member-card .paradigm-link'), personId);
  assert.match(await page.locator('.member-card').innerText(), /Same Name|Rolland Santimano/);
  await page.locator('.member-back').click();
  await page.locator('#people-list').waitFor();
}
(async () => {
  const worker = (await import(pathToFileURL(path.resolve(__dirname, '../worker/index.js')).href)).default;
  const originalFetch = globalThis.fetch;
  const upstreamCalls = [];
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    upstreamCalls.push(url.href);
    assert.equal(url.hostname, 'www.tabroom.com');
    if (url.pathname === '/api/download_data.mhtml' && url.searchParams.get('tourn_id') === '91001') return Response.json(raw);
    if (url.pathname === '/api/download_data.mhtml' && url.searchParams.get('tourn_id') === '41209' && process.argv.includes('--live'))
      return originalFetch(url, { signal: AbortSignal.timeout(30000) });
    if (url.pathname === '/index/tourn/main.mhtml') return new Response('<h2>Fixture invitation</h2><p>Public fixture invitation only.</p>');
    return new Response('Source unavailable', { status: 503 });
  };
  const workerRequest = url => worker.fetch(new Request('http://127.0.0.1' + url), {}, { waitUntil: p => p.catch(() => {}) });
  const html = await (await workerRequest('/')).text();
  assert.ok(html.includes(fs.readFileSync(path.resolve(__dirname, '../web/app.js'), 'utf8')), 'compiled worker must include current app source');
  const server = http.createServer(async (req, res) => {
    try {
      const result = await workerRequest(req.url);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) { console.error(error); res.writeHead(500); res.end('Test server failure'); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseURL = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch();
    const context = await browser.newContext();
    // All browser requests must stay local. Official links are inspected, not
    // followed: this test must never fetch private paradigm contents.
    await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL + '/#tournament/91001/judges');
    await page.locator('#people-list').waitFor();
    assert.equal(await page.locator('#people-list .member-link').count(), 8);
    assert.equal(await page.locator('#people-list .paradigm-link').count(), 3);
    for (const c of cases) {
      await checkMember(page, '91001', c.id, c.want);
      console.log('PASS compiled roster -> member -> roster: ' + c.label);
    }
    await page.locator('[data-sub="entries"]').click();
    await page.locator('#people-list a[href="#tournament/91001/member/entry:201"]').waitFor();
    assert.equal(await page.locator('#people-list .paradigm-link').count(), 0);
    await page.locator('#people-list .member-link').click();
    await page.waitForURL('**/#tournament/91001/member/entry:201');
    await page.locator('.record-table').first().waitFor();
    assert.match(await page.locator('.member-card').innerText(), /Fixture Entry/);
    console.log('PASS unchanged entry route and no entry-roster paradigm shortcut');
    await page.goto(baseURL + '/#tournament/91099/judges');
    await page.getByText('The structured export is unavailable.', { exact: false }).waitFor();
    assert.equal(await page.locator('#people-list .paradigm-link').count(), 0);
    console.log('PASS unavailable public export remains unavailable');
    if (process.argv.includes('--live')) {
      const response = await workerRequest('/api/tournament?id=41209');
      if (!response.ok) console.log('SKIP live 41209: public worker returned HTTP ' + response.status);
      else {
        const data = await response.json();
        assert.equal(data.judges.length, 271, 'live source changed: review smoke expectations');
        await page.goto(baseURL + '/#tournament/41209/judges');
        await page.locator('#people-list').waitFor();
        assert.equal(await page.locator('#people-list .member-link').count(), 271);
        assert.equal(await page.locator('#people-list .paradigm-link').count(), 267);
        await checkMember(page, '41209', '2898901', '881819');
        await page.locator('a[href="#tournament/41209/member/judge:registration:2923626"]').click();
        await page.getByRole('heading', { name: 'No published ballots' }).waitFor();
        assert.equal(await page.locator('.member-card .paradigm-link').count(), 0);
        console.log('PASS live public 41209: 271 member links, 267 shortcuts, original identity 2898901 -> 881819, unavailable identity omitted');
        const handoff = await originalFetch(officialURL('881819'), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
        const location = handoff.headers.get('location');
        console.log('Official unauthenticated handoff: HTTP ' + handoff.status + ', Location: ' + location);
        // Never read the body or follow login. A successful page response also
        // does not establish authenticated viewing or paradigm availability.
        await handoff.body?.cancel();
        if (handoff.status === 302) assert.match(location, /\/user\/login\//);
        console.log('NOT VERIFIED: authenticated paradigm contents or viewing');
      }
    }
    assert.deepEqual(errors, []);
    assert.ok(upstreamCalls.some(url => url.includes('/api/download_data.mhtml?tourn_id=91001')));
    assert.ok(upstreamCalls.every(url => !url.includes('/paradigm.mhtml')), 'app never fetches paradigm contents');
    console.log('PASS zero browser runtime errors and no app paradigm fetches');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
