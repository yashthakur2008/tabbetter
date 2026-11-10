import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync('web/app.js', 'utf8');
const uiSource = fs.existsSync('web/discovery.js') ? fs.readFileSync('web/discovery.js', 'utf8') : '';
function harness(storage = new Map()) {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, { innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, isConnected: true, open: false,
      classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {},
      querySelector: key => node(key), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
      focus() { document.activeElement = this; }, showModal() { this.open = true; }, close() { this.open = false; this.onclose?.(); } });
    return nodes.get(key);
  };
  const document = { activeElement: null, documentElement: { dataset: {} }, querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  const context = vm.createContext({ document, location: { hash: '#about' }, window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }, navigator: {}, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, URLSearchParams, AbortController, console, setTimeout, clearTimeout, fetch: async () => ({ ok: true, json: async () => ({ items: [] }) }) });
  vm.runInContext(fs.readFileSync('src/discovery.mjs', 'utf8').replaceAll('export ', ''), context);
  vm.runInContext(appSource.slice(0, appSource.indexOf('document\n  .querySelectorAll("[data-nav]")')), context);
  vm.runInContext(uiSource, context);
  const run = code => vm.runInContext(code, context);
  run(`calendar = { tournaments: [{id:'1', name:'Bay Speech', city:'San Jose', modes:['In person'], dates:'Nov 16', registration:'Due tomorrow'}, {id:'2',name:'Online Open',modes:['Online']}], filters:{}, fetchedAt:'2026-11-10' };`);
  return { context, node, run };
}

test('workspace renders one search, equal event groups and consent before location request', () => {
  const a = harness();
  assert.equal(a.run('typeof discoveryShellHTML'), 'function', 'discovery shell must exist');
  const html = a.run('discoveryShellHTML()');
  assert.equal((html.match(/type="search"/g) || []).length, 1);
  for (const text of ['discovery-workspace', 'Speech', 'Debate', 'Other / regional', 'Open-Meteo / GeoNames', 'Find near me', 'Clear all', 'Check next']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /tile-grid|page-hero|id="omni"/);
  assert.match(html, /id="discovery-radius"[^>]*disabled/);
});

test('rows distinguish unchecked, unpublished and failed metadata and retain ordinary links', () => {
  const a = harness();
  assert.equal(a.run('typeof discoveryRowHTML'), 'function');
  const row = status => a.run(`discoveryRowHTML(discoverTournaments(calendar.tournaments, {'1':{status:${JSON.stringify(status)},events:[]}})[0])`);
  assert.match(row('unknown'), /Details not checked/);
  assert.match(row('available'), /Events not published/);
  assert.match(row('unavailable'), /Details unavailable/);
  assert.match(row('failed'), /Could not check details/);
  assert.match(row('unknown'), /href="#tournament\/1"/);
  assert.match(row('unknown'), /data-preview="1"/);
  assert.match(row('unknown'), /data-discovery-save="1"/);
});

test('metadata loads one bounded batch, maps by id and rejects late unmount results', async () => {
  const a = harness();
  assert.equal(a.run('typeof discoveryCheckNext'), 'function');
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace(); calendar.tournaments=Array.from({length:30},(_,i)=>({id:String(i+1),name:'T'+i,modes:[]}));`);
  await new Promise(resolve => setTimeout(resolve, 0));
  a.run('discoveryState.metadata={}');
  const requests = [];
  a.context.fetch = async url => { requests.push(url); return { ok:true,json:async()=>({items:[{id:'2',status:'available',events:['PF']},{id:'1',status:'available',events:['OO']}]}) }; };
  await a.run('discoveryCheckNext()');
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0], 'http://test').searchParams.get('ids').split(',').length, 12);
  assert.equal(a.run('discoveryState.metadata[2].events[0]'), 'PF');
  let resolve;
  a.context.fetch = () => new Promise(r => { resolve = r; });
  const before = a.run('JSON.stringify(discoveryState.metadata)');
  const pending = a.run('discoveryCheckNext()');
  a.run('unmountDiscoveryWorkspace()');
  resolve({ ok:true, json:async()=>({items:[{id:'13',status:'available',events:['DI']}]}) });
  await pending;
  assert.equal(a.run('JSON.stringify(discoveryState.metadata)'), before);
});

test('manual geocoding and browser location cannot restore cleared or unmounted origin', async () => {
  const a = harness();
  assert.equal(a.run('typeof discoveryFindPlace'), 'function');
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  await new Promise(resolve => setTimeout(resolve, 0));
  let resolve;
  a.context.fetch = () => new Promise(r => { resolve = r; });
  const pending = a.run(`discoveryFindPlace('San Jose')`);
  a.run('discoveryClearLocation()');
  resolve({ok:true,json:async()=>({results:[{id:'x',label:'San Jose',latitude:37,longitude:-121}]})});
  await pending;
  assert.equal(a.run('discoveryState.candidates.length'), 0);
  let position;
  a.context.navigator.geolocation = { getCurrentPosition(success) { position = success; } };
  a.run('discoveryLocate()');
  a.run('unmountDiscoveryWorkspace()');
  position({coords:{latitude:37,longitude:-121}});
  assert.equal(a.run('discoveryState.origin'), null);
});

test('CSV uses discovery event filters and reset preserves bookmarks', () => {
  const a = harness();
  assert.equal(a.run('typeof discoveryExport'), 'function');
  a.run(`discoveryState.metadata={'1':{status:'available',events:['OO']}}; discoveryState.eventIds=['oo']; saved=[{id:'1',name:'Bay Speech'}]; downloadCSV=(rows)=>globalThis.exported=rows; discoveryExport();`);
  assert.equal(a.context.exported.length, 1);
  assert.equal(a.context.exported[0].Tournament, 'Bay Speech');
  a.run(`filter.q='Bay'; filter.mode='Online'; discoveryState.origin={latitude:37,longitude:-121}; discoveryClearAll();`);
  assert.equal(a.run('saved.length'), 1);
  assert.equal(a.run('filter.q'), '');
  assert.equal(a.run('filter.mode'), '');
  assert.equal(a.run('discoveryState.origin'), null);
  assert.equal(a.run('discoveryState.eventIds.length'), 0);
});

test('preview save does not rebuild the shell and close restores the trigger', () => {
  const a = harness();
  assert.equal(a.run('typeof discoveryPreview'), 'function');
  a.context.trigger = a.node('trigger');
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace(); discoveryPreview('1',trigger); save=t=>{saved.push(t)}; discoverySave('1');`);
  assert.equal(a.node('#discovery-preview').open, true);
  assert.equal(a.run('saved.length'), 1);
  a.node('#discovery-preview').close();
  assert.equal(a.context.document.activeElement, a.context.trigger);
});

test('circuit changes request the calendar endpoint rather than local name inference', async () => {
  const a = harness();
  assert.equal(a.run('typeof discoveryReloadCalendar'), 'function');
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace(); filter.circuit_id='67';`);
  const urls = [];
  a.context.fetch = async url => { urls.push(url); return {ok:true,json:async()=>({tournaments:[],filters:{}})}; };
  await a.run('discoveryReloadCalendar()');
  assert.ok(urls.some(url => url.startsWith('/api/calendar?') && url.includes('circuit_id=67')));
});


test('loading a new circuit never exposes or exports the previous circuit results', async () => {
  const a = harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  await new Promise(resolve => setTimeout(resolve, 0));
  let resolve;
  a.context.fetch = () => new Promise(r => { resolve = r; });
  const pending = a.run(`filter.circuit_id='67'; discoveryReloadCalendar()`);
  assert.equal(a.run('discoveryResults().length'), 0);
  resolve({ok:true,json:async()=>({tournaments:[],filters:{}})});
  await pending;
});

test('failed metadata has an explicit bounded retry, not a dead-end checked state', async () => {
  const a = harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  await new Promise(resolve => setTimeout(resolve, 0));
  a.run(`discoveryState.metadata={'1':{status:'failed',events:[]},'2':{status:'available',events:['PF']}};`);
  let request;
  a.context.fetch = async url => { request=url; return {ok:true,json:async()=>({items:[{id:'1',status:'available',events:['OO']}]})}; };
  await a.run('discoveryCheckNext(true)');
  assert.match(request || '', /ids=1$/);
  assert.equal(a.run('discoveryState.metadata[1].status'), 'available');
  assert.match(a.run('discoveryShellHTML()'), /Retry failed checks/);
});

test('preview remains available when selected events change and restores replacement trigger', () => {
  const a = harness();
  a.context.trigger = a.node('trigger');
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace(); discoveryPreview('1',trigger); discoveryState.eventIds=['pf'];`);
  assert.doesNotThrow(()=>a.run('discoveryUpdatePreview()'));
  a.context.trigger.isConnected=false;
  a.node('#discovery-preview').close();
  assert.equal(a.context.document.activeElement, a.node('[data-preview="1"]'));
});

test('keyboard shortcuts respect editors, composition, and modal focus', () => {
  const a = harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  const event = {key:'k',ctrlKey:true,preventDefault(){this.prevented=true;}};
  a.context.keyEvent=event;
  a.context.document.activeElement={tagName:'TEXTAREA'};
  a.run('discoveryKeydown(keyEvent)');
  assert.equal(event.prevented,undefined);
  a.context.document.activeElement={tagName:'DIV',isContentEditable:true};
  a.run('discoveryKeydown(keyEvent)');
  assert.equal(event.prevented,undefined);
  a.context.document.activeElement={tagName:'BUTTON'};
  event.isComposing=true;
  a.run('discoveryKeydown(keyEvent)');
  assert.equal(event.prevented,undefined);
  event.isComposing=false;
  a.run('discoveryKeydown(keyEvent)');
  assert.equal(a.context.document.activeElement,a.node('#discovery-search'));
});

test('location denial leaves manual entry available and candidate requests use no-store', async () => {
  const a = harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  await new Promise(resolve => setTimeout(resolve, 0));
  a.context.navigator.geolocation={getCurrentPosition(success,failure){failure({code:1});}};
  a.run('discoveryLocate()');
  assert.match(a.run('discoveryState.locationMessage'), /city or postal code/);
  let request;
  a.context.fetch=async (url,options)=>{request={url,options};return {ok:true,json:async()=>({results:[{label:'San Jose',latitude:37,longitude:-121}]})};};
  await a.run(`discoveryFindPlace('San Jose')`);
  assert.equal(request.url,'/api/locations?q=San%20Jose');
  assert.equal(request.options.cache,'no-store');
  assert.equal(a.run('discoveryState.origin'),null,'candidate selection must be explicit');
  a.context.placeButton={dataset:{placeIndex:'0'}};
  a.run('discoveryClick({target:{closest:()=>placeButton}})');
  assert.equal(a.run('discoveryState.origin.label'),'San Jose');
  assert.doesNotMatch(uiSource,/localStorage|sessionStorage/);
});

test('Escape dismissal survives the optional corpus finishing later', () => {
  const a = harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace(); filter.q='Bay'; discoverySuggestions(); discoveryKeydown({key:'Escape'}); discoverySuggestions();`);
  assert.equal(a.node('#discovery-suggestions').innerHTML,'');
  a.node('#discovery-search').oninput({target:{value:'new'}});
  assert.match(a.node('#discovery-suggestions').innerHTML,/Available past competitors/);
});

test('ordinary tournament link focus survives a metadata redraw', () => {
  const a = harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  a.context.link = {dataset:{tournamentLink:'1'},isConnected:false};
  a.context.document.activeElement=a.context.link;
  a.run('discoveryDrawResults()');
  assert.equal(a.context.document.activeElement,a.node('[data-tournament-link="1"]'));
});

for (const [key,value] of [['circuit_id','67'],['state','CA'],['country','US'],['year','2027']]) {
  test(`R1 interrupted ${key} selection reloads on return and never exports the old calendar`, async () => {
    const a = harness();
    a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
    await new Promise(resolve => setTimeout(resolve, 0));
    const requests=[];
    a.context.fetch=url=> {
      if (!url.startsWith('/api/calendar?')) return Promise.resolve({ok:true,json:async()=>({items:[]})});
      return new Promise(resolve=>requests.push({url,resolve}));
    };
    const interrupted=a.run(`filter[${JSON.stringify(key)}]=${JSON.stringify(value)}; discoveryReloadCalendar()`);
    a.run(`location.hash='#about'; unmountDiscoveryWorkspace(); location.hash='#discover';`);
    const returning=a.run('renderRoute()');
    assert.equal(a.run('discoveryResults().length'),0,'the retained old calendar must not be reusable under changed filters');
    a.run('downloadCSV=rows=>globalThis.exported=rows; discoveryExport()');
    assert.equal(a.context.exported.length,0);
    assert.equal(requests.length,2,'return must start a replacement calendar request');
    assert.ok(requests.every(r=>new URL(r.url,'http://test').searchParams.get(key)===value));
    requests[1].resolve({ok:true,json:async()=>({tournaments:[{id:'99',name:'Matching calendar',modes:[]}],filters:{}})});
    await returning;
    assert.equal(a.run('discoveryResults().map(t=>t.id).join()'),'99');
    requests[0].resolve({ok:true,json:async()=>({tournaments:[{id:'98',name:'Late old selection',modes:[]}],filters:{}})});
    await interrupted;
    a.run('discoveryExport()');
    assert.equal(a.context.exported.length,1);
    assert.equal(a.context.exported[0].Tournament,'Matching calendar');
  });
}

test('R2 cached regional choices survive remount with selected state and no extra metadata fetch', async () => {
  const a=harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  await new Promise(resolve=>setTimeout(resolve,0));
  a.run(`discoveryState.metadata={'1':{status:'available',events:['Regional Speaking']},'2':{status:'available',events:['PF']}}; discoveryState.eventIds=['other:regional speaking']; location.hash='#about'; unmountDiscoveryWorkspace(); location.hash='#discover';`);
  const requests=[];
  a.context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({items:[]})};};
  a.run('renderDiscoveryWorkspace()');
  const html=a.node('#discovery-other-events').innerHTML;
  assert.match(html,/data-event="other:regional speaking" checked/);
  assert.match(html,/Regional Speaking/);
  assert.equal(a.run('discoveryUnchecked().length'),0);
  assert.equal(requests.length,0,'cached controls must not require a network-completion side effect');
});

test('preview Tab and Shift+Tab wrap within modal controls instead of browser chrome', () => {
  const a=harness();
  a.run(`location.hash='#discover'; renderDiscoveryWorkspace()`);
  const dialog=a.node('#discovery-preview');
  const first=a.node('#discovery-preview-close');
  const last=a.node('preview-save');
  dialog.open=true;
  dialog.querySelectorAll=()=>[first,last];
  a.context.document.activeElement=last;
  a.context.keyEvent={key:'Tab',preventDefault(){this.prevented=true;}};
  a.run('discoveryKeydown(keyEvent)');
  assert.equal(a.context.document.activeElement,first);
  assert.equal(a.context.keyEvent.prevented,true);
  a.context.keyEvent={key:'Tab',shiftKey:true,preventDefault(){this.prevented=true;}};
  a.run('discoveryKeydown(keyEvent)');
  assert.equal(a.context.document.activeElement,last);
  assert.equal(a.context.keyEvent.prevented,true);
});

const savedDateRecords = [
  {id:'1',name:'Zulu November',dates:'11/16',sortDate:'2026-11-16',modes:[]},
  {id:'2',name:'Alpha December',dates:'12/14',sortDate:'2026-12-14',modes:[]},
  {id:'3',name:'January next year',start:'2027-01-05',modes:[]},
];
test('final R1 actual save serialization and reload retain chronological date and event tie-break order', () => {
  const storage = new Map();
  const a = harness(storage);
  a.context.records = savedDateRecords;
  a.run('records.forEach(save); clearTimeout(window.tt)');
  const b = harness(storage);
  b.run(`location.hash='#saved'; calendar.tournaments=[]; discoveryState.metadata=Object.fromEntries(saved.map(t=>[t.id,{status:'available',events:['OO']}]));`);
  assert.equal(b.run('discoveryResults().map(t=>t.id).join()'), '1,2,3');
  b.run(`discoveryState.sort='matches'; discoveryState.eventIds=['oo'];`);
  assert.equal(b.run('discoveryResults().map(t=>t.id).join()'), '1,2,3');
  assert.equal(JSON.parse(storage.get('tabbetter-saved'))[0].sortDate, '2026-11-16');
  assert.equal(JSON.parse(storage.get('tabbetter-saved'))[2].start, '2027-01-05');
});

test('final R1 legacy saved records join calendar dates by ID without inventing dates or rewriting storage', () => {
  const legacy = savedDateRecords.slice(0,2).map(({sortDate,...t})=>t);
  legacy.push({id:'4',name:'Unknown date',dates:'12/14 TBD'});
  const serialized = JSON.stringify(legacy);
  const storage = new Map([['tabbetter-saved',serialized]]);
  const a = harness(storage);
  a.context.records = savedDateRecords;
  a.run(`location.hash='#saved'; calendar.tournaments=records;`);
  assert.equal(a.run('discoveryResults().map(t=>t.id).join()'), '1,2,4');
  assert.equal(a.run('discoveryResults().find(t=>t.id==="4").sortDate'), undefined);
  assert.equal(storage.get('tabbetter-saved'),serialized);
  a.run('calendar.tournaments=[]');
  assert.equal(a.run('discoveryBase().some(t=>t.sortDate || t.start)'),false,'yearless display dates must not become invented canonical dates');
});

test('final R2 successful HTTP unavailable metadata has explicit bounded recovery after negative cache expiry', async () => {
  let now = Date.parse('2026-11-10T00:00:00Z');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  let available = false, upstreamCalls = 0;
  const workerCode = fs.readFileSync('worker/index.js','utf8').replace('export default {','globalThis.handler = {');
  const box = vm.createContext({Date:Clock, Response, Request, URL, URLSearchParams, AbortSignal, TextDecoder, setTimeout, clearTimeout, console,
    fetch: async url => {
      upstreamCalls++;
      if (!available) return new Response('Unavailable',{status:503});
      const id = new URL(url).searchParams.get('tourn_id');
      return Response.json({id,public:true,name:'Recovered',categories:[{events:[{id:10,name:'Original Oratory'}]}]});
    }});
  vm.runInContext(workerCode,box);
  const a = harness();
  a.context.Date = Clock;
  const requests = [];
  a.context.fetch = async url => {
    // The optional competitor index is unrelated to metadata recovery.
    if (!url.startsWith('/api/discovery?')) return {ok:true,json:async()=>({})};
    requests.push(url);
    const response = await box.handler.fetch(new Request('https://example.test'+url),{},{waitUntil(){}});
    assert.equal(response.status,200,'upstream failure is a successful same-origin response');
    return response;
  };
  // Set a mounted root without triggering the initial automatic batch.
  a.run(`location.hash='#discover'; discoveryState.root=document.querySelector('.discovery-workspace'); calendar.tournaments=Array.from({length:14},(_,i)=>({id:String(i+1),name:'Tournament '+i}));`);
  await a.run('discoveryCheckNext()');
  await a.run('discoveryCheckNext()');
  assert.equal(a.run('discoveryState.metadata[1].status'),'unavailable');
  assert.equal(upstreamCalls,28);
  assert.equal(a.node('#discovery-retry-details').hidden,false,'HTTP 200 unavailable must expose recovery');
  assert.match(a.node('#discovery-coverage').textContent,/1 minute/);
  await a.run('discoveryCheckNext(true)');
  assert.equal(requests.length,2,'no requests during negative cache lifetime');
  a.run(`location.hash='#about'; unmountDiscoveryWorkspace(); location.hash='#discover'; renderDiscoveryWorkspace(); discoveryClearAll();`);
  assert.equal(requests.length,2,'remount and clear-all retain metadata without crawling or bypassing cooldown');
  assert.equal(a.node('#discovery-retry-details').hidden,false);
  now += 59999;
  await a.run('discoveryCheckNext(true)');
  assert.equal(requests.length,2);
  available = true;
  now += 1;
  a.run(`discoveryState.eventIds=['oo']; discoveryDrawResults()`);
  assert.equal(a.run('discoveryResults().length'),0);
  assert.equal(requests.length,2,'time/filter changes do not auto crawl');
  await a.run('discoveryCheckNext(true)');
  assert.equal(requests.length,3);
  assert.equal(new URL(requests[2],'https://test').searchParams.get('ids').split(',').length,12);
  assert.equal(a.run('discoveryResults().length'),12,'recovered events reappear under selected event filter');
  assert.equal(a.run('discoveryState.metadata[13].status'),'unavailable');
  await a.run('discoveryCheckNext(true)');
  assert.equal(a.run('discoveryResults().length'),14);
  assert.equal(a.node('#discovery-retry-details').hidden,true);
  await a.run('discoveryCheckNext(true)');
  assert.equal(requests.length,4,'available items are not endlessly retried');
  a.run(`discoveryState.metadata[1].events=[]; discoveryDrawResults()`);
  await a.run('discoveryCheckNext(true)');
  assert.equal(requests.length,4,'an available empty offering is not treated as an unavailable fetch');
  assert.equal(a.node('#discovery-retry-details').hidden,true);
});
