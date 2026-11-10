// Browser acceptance checks against the compiled worker. Only the external
// Tabroom/GeoNames responses are fixtures; routing, parsers, API adapters,
// embedded JS/CSS, DOM events and browser permissions execute for real.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.TABBETTER_PLAYWRIGHT_MODULE || 'playwright');

const records = [
  { id: '91001', name: 'Bay Speech Invitational', city: 'San Jose', state: 'CA', country: 'US', events: ['Original Oratory', 'Dramatic Interpretation'], online: false },
  { id: '91002', name: 'Coast Debate Open', city: 'San Francisco', state: 'CA', country: 'US', events: ['Public Forum', 'Lincoln-Douglas'], online: false },
  { id: '91003', name: 'National Online Showcase', city: 'Online', state: '', country: 'US', events: ['Original Oratory', 'Public Forum'], online: true },
  { id: '91004', name: 'Unpublished Events Invitational', city: 'Unspecified', state: '', country: '', events: [], unavailable: true },
];
const places = [
  { id: 5392171, name: 'San Jose', latitude: 37.33939, longitude: -121.89496, country_code: 'US', country: 'United States', admin1: 'California', feature_code: 'PPLA2' },
  { id: 5391959, name: 'San Francisco', latitude: 37.77493, longitude: -122.41942, country_code: 'US', country: 'United States', admin1: 'California', feature_code: 'PPLA2' },
];
function calendarFixture(url) {
  const data = url.searchParams.get('circuit_id') === '67' ? records.slice(0, 2) : records;
  return '<select name="circuit_id"><option value="67">Coast Forensic League</option></select><select name="state"><option value="CA">California</option></select>' +
    '<table id="tournlist">' + data.map((r, i) => '<tr><td data-text="2026-46-' + (i + 1) + '">11/' + (16 + i) + '</td><td><a href="/index/tourn/main.mhtml?tourn_id=' + r.id + '">' + r.name + '</a></td><td>' + r.city + '</td><td>' + (r.state ? '<a href="index.mhtml?state=' + r.state + '">' + r.state + '</a>' : '') + '</td><td><i title="Tournament has ' + (r.online ? 'online' : 'in-person') + ' events"></i></td><td>Due 11/15 8:00 PM PST</td><td></td></tr>').join('') + '</table>';
}
function exportFixture(record) {
  return { ...record, public: 'true', start: '2026-11-16', end: '2026-11-18', timezone: 'America/Los_Angeles', schools: [], categories: [{ name: 'Published events', judges: [], events: record.events.map((name, i) => ({ id: String(i + 1), name, type: /Oratory|Interpretation/.test(name) ? 'speech' : 'debate', rounds: [] })) }] };
}

(async () => {
  const worker = (await import(pathToFileURL(path.resolve(__dirname, '../worker/index.js')).href)).default;
  const upstreamCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    upstreamCalls.push(url.href);
    if (url.hostname === 'geocoding-api.open-meteo.com') {
      const query = (url.searchParams.get('name') || '').toLowerCase();
      return Response.json({ results: places.filter(p => query.startsWith(p.name.toLowerCase()) || query === '95101') });
    }
    assert.equal(url.hostname, 'www.tabroom.com', 'unexpected external dependency');
    if (url.pathname === '/index/index.mhtml') return new Response(calendarFixture(url));
    const record = records.find(r => r.id === url.searchParams.get('tourn_id'));
    if (url.pathname === '/api/download_data.mhtml' && record && !record.unavailable) return Response.json(exportFixture(record));
    if (url.pathname === '/index/tourn/main.mhtml' && record && !record.unavailable) return new Response('<h2>' + record.name + '</h2><p>Published tournament information.</p>');
    return new Response('Source unavailable', { status: 503 });
  };
  const server = http.createServer(async (req, res) => {
    try {
      const result = await worker.fetch(new Request('http://127.0.0.1' + req.url), {}, { waitUntil: p => p.catch(() => {}) });
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseURL = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.locator('.discovery-workspace').waitFor({ timeout: 10000 });
    assert.equal(await page.locator('#app input[type="search"]:visible').count(), 1, 'one unified visible search');
    assert.deepEqual(errors, [], 'browser should not emit runtime errors');
    console.log('PASS compiled worker renders the discovery workspace with one search');
    assert.ok(upstreamCalls.some(url => url.includes('/index/index.mhtml')), 'calendar parsed through real adapter');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
