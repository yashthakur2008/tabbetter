import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync('web/app.js', 'utf8');
const uiSource = fs.existsSync('web/discovery.js') ? fs.readFileSync('web/discovery.js', 'utf8') : '';
function harness() {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, { innerHTML: '', textContent: '', value: '', dataset: {}, isConnected: true, open: false,
      classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {},
      querySelector: key => node(key), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
      focus() { document.activeElement = this; }, showModal() { this.open = true; }, close() { this.open = false; this.onclose?.(); } });
    return nodes.get(key);
  };
  const document = { activeElement: null, documentElement: { dataset: {} }, querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  const context = vm.createContext({ document, location: { hash: '#about' }, window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }, navigator: {}, localStorage: { getItem: () => null, setItem() {} }, URLSearchParams, AbortController, console, setTimeout, clearTimeout, fetch: async () => ({ ok: true, json: async () => ({ items: [] }) }) });
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
