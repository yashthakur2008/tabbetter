// Browser acceptance checks against the compiled worker. Only the external
// Tabroom/GeoNames responses are fixtures; routing, parsers, API adapters,
// embedded JS/CSS, DOM events and browser permissions execute for real.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.TABBETTER_PLAYWRIGHT_MODULE || 'playwright');

const records = [
  { id: '91001', name: 'Bay Speech Invitational', city: 'San Jose', state: 'CA', country: 'US', events: ['Original Oratory', 'Dramatic Interpretation', 'Radio Broadcasting'], online: false },
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
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
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
    const rows = page.locator('[data-discovery-row]');
    const ids = () => rows.evaluateAll(nodes => nodes.map(n => n.dataset.discoveryRow));
    const expectIds = async expected => {
      await page.waitForFunction(wanted => JSON.stringify([...document.querySelectorAll('[data-discovery-row]')].map(n => n.dataset.discoveryRow)) === JSON.stringify(wanted), expected);
      assert.deepEqual(await ids(), expected);
    };
    await page.waitForFunction(() => document.querySelector('#discovery-coverage')?.textContent.includes('4 of 4'));
    assert.match(await page.locator('#discovery-coverage').innerText(), /3 with published details/);
    assert.match(await page.locator('[data-discovery-row="91004"]').innerText(), /unavailable/i);
    await page.locator('#discovery-events > summary').click();
    await page.locator('[data-event="oo"]').check();
    await expectIds(['91001','91003']);
    await page.locator('[data-event="pf"]').check();
    await expectIds(['91001','91002','91003']);
    await page.locator('#discovery-event-match').selectOption('all');
    await expectIds(['91003']);
    await page.locator('#discovery-event-match').selectOption('any');
    await page.locator('#discovery-events > summary').click();
    await page.locator('#discovery-sort').selectOption('matches');
    assert.equal((await ids())[0], '91003');
    await page.locator('#discovery-clear-all').click();
    await expectIds(records.map(r=>r.id));
    await page.locator('[data-preview="91001"]').click();
    assert.equal(await page.locator('#discovery-preview').evaluate(d=>d.open), true);
    assert.match(await page.locator('#discovery-preview-content').innerText(), /Original Oratory/);
    assert.equal(await page.locator('#discovery-preview a[href="#tournament/91001"]').count(),1);
    for(let tab=0;tab<8;tab++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.querySelector('#discovery-preview').contains(document.activeElement)),true,'modal traps tab focus');
    }
    await page.locator('#discovery-preview [data-discovery-save="91001"]').click();
    assert.equal(await page.locator('#discovery-preview').evaluate(d=>d.open),true,'save keeps preview open');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-preview="91001"]').evaluate(e=>e===document.activeElement),true,'preview restores trigger focus');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.keyboard.press('Control+k');
    assert.equal(await page.locator('#discovery-search').evaluate(e=>e===document.activeElement),true);
    await page.locator('#discovery-search').fill('Coast');
    await expectIds(['91002']);
    await page.locator('#discovery-actions > summary').click();
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#discovery-export').click();
    const download=await downloadPromise;
    const csv=require('node:fs').readFileSync(await download.path(),'utf8');
    assert.match(csv,/Coast Debate Open/);
    assert.doesNotMatch(csv,/Bay Speech Invitational|National Online Showcase/,'CSV follows current discovery filters');
    await page.locator('#discovery-actions > summary').click();
    await page.locator('#discovery-clear-all').click();
    await page.locator('#discovery-circuit_id').selectOption('67');
    await expectIds(['91001','91002']);
    await page.locator('#discovery-clear-all').click();
    await expectIds(records.map(r=>r.id));
    await page.locator('#discovery-location > summary').click();
    await page.locator('#discovery-place').fill('San Jose, CA');
    await page.locator('#discovery-location-form button').click();
    await page.locator('[data-place-index="0"]').click();
    assert.match(await page.locator('#discovery-location-status').innerText(), /San Jose/);
    await page.locator('#discovery-location > summary').click();
    await page.locator('#discovery-radius').selectOption('25');
    await expectIds(['91001','91003']);
    assert.match(await page.locator('[data-discovery-row="91003"]').innerText(), /no physical distance/);
    await page.locator('#discovery-sort').selectOption('distance');
    assert.equal((await ids())[0],'91001');
    await page.locator('#discovery-more > summary').click();
    await page.locator('#discovery-online').uncheck();
    await expectIds(['91001']);
    await page.locator('#discovery-more > summary').click();
    await page.locator('#discovery-clear-all').click();
    await expectIds(records.map(r=>r.id));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-discovery-save="91001"][aria-pressed="true"]').waitFor();
    assert.equal(await page.locator('#discovery-radius').isDisabled(),true,'location is not persisted');
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);
      for(const disclosure of ['events','location','more']) {
        await page.locator('#discovery-'+disclosure+' > summary').click();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow with '+disclosure+' open at '+width);
        await page.locator('#discovery-'+disclosure+' > summary').click();
      }
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-preview="91001"]').click();
    assert.equal(await page.locator('#discovery-preview').evaluate(d=>d.getAnimations().length),0,'reduced motion has no preview movement');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[],'all interactions have no runtime errors');
    console.log('PASS events ANY/ALL, ranking, circuit, location/radius, online, preview/focus, save, keyboard, responsive and reduced-motion workflows');
    const screenshotDir = process.env.TABBETTER_SCREENSHOT_DIR;
    if (screenshotDir) {
      require('node:fs').mkdirSync(screenshotDir,{recursive:true});
      await page.screenshot({path:path.join(screenshotDir,'discovery-desktop.png'),fullPage:true});
      await page.setViewportSize({width:390,height:900});
      await page.screenshot({path:path.join(screenshotDir,'discovery-mobile.png'),fullPage:true});
    }
    await page.locator('#theme').selectOption('dark');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
    await page.reload();
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','explicit dark persists');
    await page.locator('.discovery-workspace').waitFor();
    if(screenshotDir) await page.screenshot({path:path.join(screenshotDir,'discovery-dark.png'),fullPage:true});
    await context.close();
    const geoContext = await browser.newContext({geolocation:{latitude:37.33939,longitude:-121.89496},permissions:['geolocation'],colorScheme:'dark'});
    const geoPage = await geoContext.newPage();
    geoPage.on('pageerror',error=>errors.push(error.message));
    await geoPage.goto(baseURL);
    await geoPage.locator('.discovery-workspace').waitFor();
    assert.equal(await geoPage.evaluate(()=>document.documentElement.dataset.theme),'light','fresh preference is light even on dark OS');
    await geoPage.locator('#discovery-location > summary').click();
    const beforeGeo = upstreamCalls.length;
    await geoPage.locator('#discovery-near-me').click();
    await geoPage.waitForFunction(()=>!document.querySelector('#discovery-radius').disabled);
    assert.ok(!upstreamCalls.slice(beforeGeo).some(u=>u.includes('37.33')||u.includes('-121.89')),'browser coordinates are not transmitted');
    await geoPage.locator('#discovery-clear-location').click();
    assert.equal(await geoPage.locator('#discovery-radius').isDisabled(),true);
    let releasePlace;
    const placeGate = new Promise(resolve=>{releasePlace=resolve;});
    let placeStarted;
    const placeStart = new Promise(resolve=>{placeStarted=resolve;});
    await geoPage.route('**/api/locations?*',async route=>{placeStarted();await placeGate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[{id:'late',label:'Late city',latitude:37,longitude:-121}]})}).catch(()=>{});});
    await geoPage.locator('#discovery-place').fill('Late city');
    await geoPage.locator('#discovery-location-form button').click();
    await placeStart;
    await geoPage.locator('#discovery-clear-location').click();
    releasePlace();
    await geoPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await geoPage.locator('[data-place-index]').count(),0,'late candidates cannot restore cleared location');
    assert.equal(await geoPage.locator('#discovery-radius').isDisabled(),true);
    await geoPage.unroute('**/api/locations?*');
    await geoPage.locator('#discovery-location > summary').click();
    await geoPage.locator('[data-discovery-row="91001"] h3 a').click();
    await geoPage.waitForURL('**/#tournament/91001');
    await geoPage.goBack();
    await geoPage.locator('.discovery-workspace').waitFor();
    assert.equal(await geoPage.locator('#discovery-radius').isDisabled(),true,'back navigation clears ephemeral location');
    await geoPage.locator('#discovery-events > summary').click();
    assert.equal(await geoPage.locator('#discovery-other-events input').count(),1,'cached remount restores published regional choices');
    await geoPage.locator('#discovery-events > summary').click();
    let releaseCalendar, calendarStarted;
    const calendarGate=new Promise(resolve=>{releaseCalendar=resolve;});
    const calendarStart=new Promise(resolve=>{calendarStarted=resolve;});
    await geoPage.route('**/api/calendar?*',async request=>{calendarStarted();await calendarGate;await request.continue().catch(()=>{});});
    await geoPage.locator('#discovery-circuit_id').selectOption('67');
    await calendarStart;
    await geoPage.locator('[data-nav="saved"]').click();
    await geoPage.locator('[data-nav="discover"]').click();
    assert.equal(await geoPage.locator('[data-discovery-row="91003"]').count(),0,'pending circuit remount must not expose unfiltered rows');
    releaseCalendar();
    await geoPage.waitForFunction(()=>document.querySelectorAll('[data-discovery-row]').length===2);
    assert.deepEqual(await geoPage.locator('[data-discovery-row]').evaluateAll(nodes=>nodes.map(n=>n.dataset.discoveryRow)),['91001','91002']);
    await geoContext.close();
    const deniedContext = await browser.newContext();
    const deniedPage = await deniedContext.newPage();
    await deniedPage.goto(baseURL);
    await deniedPage.locator('#discovery-location > summary').click();
    await deniedPage.locator('#discovery-near-me').click();
    await deniedPage.waitForFunction(()=>/denied|permission|allow|unavailable/i.test(document.querySelector('#discovery-location-status').textContent));
    assert.equal(await deniedPage.locator('#discovery-radius').isDisabled(),true);
    await deniedContext.close();
    assert.deepEqual(errors,[]);
    console.log('PASS light default on dark OS, real geolocation allow/deny, stale manual location and back-navigation privacy');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
