import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

function worker(fetch) {
  const code=fs.readFileSync('worker/index.js','utf8').replace('export default {','globalThis.handler = {');
  const box=vm.createContext({fetch,Response,Request,URL,URLSearchParams,AbortSignal,TextDecoder,setTimeout,clearTimeout,console});
  vm.runInContext(code,box);
  return path=>box.handler.fetch(new Request('https://example.test'+path),{},{waitUntil(){}});
}
const exported=id=>({id,public:true,name:'Published',city:'',categories:[{events:[{id:10,name:'Varsity Original Oratory'}]}]});
const eventPage=id=>`<div class="main"><h2>Tournament</h2><h5>2026 &mdash; Apple Valley, MN/US</h5></div><div class="menu"><div class="sidenote"><h6>General</h6><a href="/index/tourn/main.mhtml?tourn_id=${id}">Invitation Home</a><a href="/index/tourn/events.mhtml?tourn_id=${id}">Events &amp; Divisions</a><h6>Events</h6><a href="events.mhtml?event_id=10&tourn_id=${id}">Novice Public Forum</a><h6>Circuits</h6><a href="/index/circuit/index.mhtml?circuit_id=28">Minnesota Speech &amp; Debate</a></div></div>`;
const candidate={id:1,feature_code:'PPL',name:'Apple Valley',admin1:'Minnesota',country:'United States',country_code:'US',latitude:44.73,longitude:-93.21};

test('invalid discovery IDs and unexpected coordinates never touch upstream',async()=>{
  const get=worker(()=>{throw Error('network must not run');});
  for(const ids of ['', '0','1,,2','-1','123456789','https://evil.test',Array.from({length:13},(_,i)=>i+1).join(',')]) assert.equal((await get('/api/discovery?ids='+encodeURIComponent(ids))).status,400);
  assert.equal((await get('/api/discovery?ids=1&latitude=44')).status,400);
  assert.equal((await get('/api/locations?q=Boston&longitude=3')).status,400);
});
test('partial failures preserve export successes, reuse cache and coalesce concurrent batches',async()=>{
  let calls=0;
  const get=worker(async url=>{calls++; const u=new URL(url); if(u.searchParams.get('tourn_id')==='2') return new Response('Unavailable',{status:503}); return Response.json(exported('1'));});
  const [a,b]=await Promise.all([get('/api/discovery?ids=1,2'),get('/api/discovery?ids=1,2')]);
  const body=await a.json();
  assert.equal(a.status,200); assert.equal(body.partial,true);
  assert.equal(body.items[0].events[0].name,'Varsity Original Oratory');
  assert.equal(body.items[0].status,'available'); assert.equal(body.items[1].status,'unavailable');
  assert.equal(body.items[1].coordinates,null); assert.deepEqual(body.items[0].circuits,[]);
  assert.deepEqual(await b.json(),body);
  const prior=calls; await get('/api/discovery?ids=1,2'); assert.equal(calls,prior);
});
test('unavailable export falls back to published event lists before registrations, with source circuits and exact city',async()=>{
  const urls=[];
  const get=worker(async url=>{urls.push(String(url)); const u=new URL(url); if(u.hostname==='geocoding-api.open-meteo.com') return Response.json({results:[candidate]}); if(u.pathname.includes('download_data')) return new Response('Private',{status:403}); return new Response(eventPage('3'));});
  const body=await (await get('/api/discovery?ids=3')).json(); const item=body.items[0];
  assert.equal(item.status,'available'); assert.equal(item.events[0].name,'Novice Public Forum');
  assert.deepEqual(item.circuits.map(c=>[c.id,c.label]),[['28','Minnesota Speech & Debate']]);
  assert.equal(item.coordinates.approximate,true); assert.equal(item.coordinates.latitude,44.73);
  assert.match(item.sourceUrl,/events\.mhtml/); assert.ok(urls.some(u=>u.includes('events.mhtml')));
  assert.ok(urls.every(u=>!u.includes('entries')&&!u.includes('schools')));
});
test('physical geocoding rejects ambiguous or mismatched cities and skips online labels',async()=>{
  for(const results of [[candidate,{...candidate,id:2}], [{...candidate,admin1:'California'}], [{...candidate,name:'Another City'}], [{...candidate,country_code:'CA'}]]) {
    const get=worker(async url=>new URL(url).hostname==='geocoding-api.open-meteo.com'?Response.json({results}):new URL(url).pathname.includes('download_data')?new Response('',{status:403}):new Response(eventPage('4')));
    assert.equal((await (await get('/api/discovery?ids=4')).json()).items[0].coordinates,null);
  }
  let geo=0;
  const get=worker(async url=>{if(String(url).includes('open-meteo'))geo++; return String(url).includes('download_data')?Response.json({...exported('5'),city:'Online',state:'CA',country:'US'}):new Response('');});
  assert.equal((await (await get('/api/discovery?ids=5')).json()).items[0].coordinates,null); assert.equal(geo,0);
});
test('manual geocoder validates input, bounds results, filters qualifier and keeps typed places out of caches',async()=>{
  const urls=[];
  const get=worker(async (url,init)=>{urls.push(String(url)); assert.equal(init.redirect,'error'); assert.ok(init.signal); return Response.json({results:[{...candidate,name:'San Jose',admin1:'California',id:2},{...candidate,name:'San Jose',admin1:'San Jose',country_code:'CR',id:3},...Array.from({length:8},(_,i)=>({...candidate,name:'San Jose',admin1:'California',id:i+10}))]});});
  for(const q of ['', 'a', 'x'.repeat(101),'https://evil.test','44.2,-93.2']) assert.equal((await get('/api/locations?q='+encodeURIComponent(q))).status,400);
  assert.equal(urls.length,0);
  const response=await get('/api/locations?q=San%20Jose%2C%20CA'); const body=await response.json();
  assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store'); assert.equal(body.attribution,'Open-Meteo / GeoNames'); assert.ok(body.results.length<=5); assert.ok(body.results.every(r=>r.label.includes('California')));
  const u=new URL(urls[0]); assert.equal(u.origin+u.pathname,'https://geocoding-api.open-meteo.com/v1/search'); assert.equal(u.searchParams.get('name'),'San Jose'); assert.equal(u.searchParams.get('count'),'5'); assert.equal(u.searchParams.get('language'),'en'); assert.equal(u.searchParams.get('format'),'json');
  await get('/api/locations?q=San%20Jose%2C%20CA'); assert.equal(urls.length,2);
});
test('manual geocoder returns controlled errors for malformed responses, upstream failure and timeout',async()=>{
  for(const fetch of [async()=>{throw Error('timeout secret');},async()=>{throw Error('TIMEOUT SECRET');},async()=>new Response('',{status:429}),async()=>Response.json({results:'bad'}),async()=>Response.json({results:[{...candidate,latitude:95}]}),async()=>Response.json({results:[{...candidate,name:'<script>'}]}),async()=>Response.json({results:[{...candidate,name:'<SCRIPT>'}]})]) {
    const r=await worker(fetch)('/api/locations?q=Boston'); assert.equal(r.status,502); assert.doesNotMatch(await r.text(),/secret|<script>/i);
  }
});
test('all discovery and geocoding upstream requests share a three-request limit',async()=>{
  let active=0,max=0;
  const get=worker(async url=>{active++;max=Math.max(max,active); await new Promise(r=>setTimeout(r,5));active--; const u=new URL(url); return u.hostname.includes('open-meteo')?Response.json({results:[]}):Response.json(exported(u.searchParams.get('tourn_id')));});
  await Promise.all([get('/api/discovery?ids=1,2,3,4,5,6'),get('/api/discovery?ids=7,8,9,10,11,12'),get('/api/locations?q=Boston')]);
  assert.equal(max,3); assert.equal(active,0);
});
test('compiler embeds shared source before legacy app and guards new embedded assets',async()=>{
  const html=await (await worker(()=>{})('/')).text();
  assert.ok(html.indexOf('const DISCOVERY_EVENTS')>=0);
  assert.ok(html.indexOf('const DISCOVERY_EVENTS')<html.indexOf('const $ ='));
  const compiler=fs.readFileSync('scripts/compile.mjs','utf8');
  assert.match(compiler,/discovery\.js/);assert.match(compiler,/discovery\.css/);
  const parent=process.env.JCODE_SCRATCH_DIR || process.cwd()+'/build';
  fs.mkdirSync(parent,{recursive:true});
  const dir=fs.mkdtempSync(parent+'/discovery-compile-');
  try {
    for(const path of ['src','web','assets','scripts'])fs.cpSync(path,dir+'/'+path,{recursive:true});
    for(const [file,payload] of [['src/discovery.mjs','// </script>'],['web/discovery.js','// </script>'],['web/discovery.css','/* </style> */']]){
      const path=dir+'/'+file;const old=fs.existsSync(path)?fs.readFileSync(path):null;
      fs.appendFileSync(path,'\n'+payload);
      assert.throws(()=>execFileSync(process.execPath,['scripts/compile.mjs'],{cwd:dir,stdio:'pipe'}),/Command failed/);
      if(old)fs.writeFileSync(path,old);else fs.unlinkSync(path);
    }
  } finally {
    // Remove only this test's unique child, never a shared scratch/build parent.
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('successful exports still enrich published circuit links, without mistaking title claims for affiliations',async()=>{
  const get=worker(async url=>String(url).includes('download_data')?Response.json(exported('6')):new Response(eventPage('6').replace('Apple Valley, MN/US','Online')));
  const item=(await (await get('/api/discovery?ids=6')).json()).items[0];
  assert.equal(item.events[0].name,'Varsity Original Oratory');
  assert.equal(item.circuits[0].id,'28');
  assert.match(item.circuits[0].sourceUrl,/circuit_id=28/);
});
test('physical coordinates must describe a populated place, not an airport or hill with the same name',async()=>{
  for(const feature_code of ['AIRP','HLL',undefined]){
    const get=worker(async url=>String(url).includes('open-meteo')?Response.json({results:[{...candidate,feature_code}]}):String(url).includes('download_data')?new Response('',{status:403}):new Response(eventPage('7')));
    assert.equal((await (await get('/api/discovery?ids=7')).json()).items[0].coordinates,null);
  }
});
test('manual geocoding has a bounded minute budget and does not reuse completed queries',async()=>{
  let calls=0;
  const get=worker(async()=>{calls++;return Response.json({results:[]});});
  for(let n=0;n<60;n++) assert.equal((await get('/api/locations?q=Boston')).status,200);
  assert.equal((await get('/api/locations?q=Boston')).status,502); assert.equal(calls,60);
});
test('public event parser ignores scripted links and foreign tournament event IDs',async()=>{
  const page='<h2>Tournament</h2><script>'+eventPage('8')+'</script><a href="events.mhtml?event_id=11&tourn_id=999">PF</a>';
  const get=worker(async url=>String(url).includes('download_data')?new Response('',{status:403}):new Response(page));
  const item=(await (await get('/api/discovery?ids=8')).json()).items[0];
  assert.equal(item.status,'unavailable');assert.deepEqual(item.events,[]);assert.deepEqual(item.circuits,[]);
});

test('location validation measures trimmed input and rejects non-object provider envelopes',async()=>{
  let calls=0;
  const get=worker(async()=>{calls++;return Response.json([]);});
  assert.equal((await get('/api/locations?q=a%20')).status,400);assert.equal(calls,0);
  assert.equal((await get('/api/locations?q=Boston')).status,502);
});
test('manual two-part country qualifier forwards countryCode rather than treating it as a region',async()=>{
  let requested;
  const get=worker(async url=>{requested=new URL(url);return Response.json({results:[]});});
  assert.equal((await get('/api/locations?q=Paris%2C%20FR')).status,200);
  assert.equal(requested.searchParams.get('countryCode'),'FR');
  assert.equal(requested.searchParams.get('name'),'Paris');
});

async function pageItem(page,id='8') {
  const get=worker(async url=>String(url).includes('open-meteo')?Response.json({results:[candidate]}):String(url).includes('download_data')?new Response('',{status:403}):new Response(page));
  return (await (await get('/api/discovery?ids='+id)).json()).items[0];
}
test('R2 unrelated body/navigation circuit links are not membership evidence',async()=>{
  const unrelated='<a href="/index/circuit/index.mhtml?circuit_id=999">Unrelated Circuit</a>';
  const page=unrelated+eventPage('8').replace('<h6>Events</h6>',unrelated+'<h6>Events</h6>')+unrelated;
  const item=await pageItem(page);
  assert.deepEqual(item.circuits.map(c=>c.id),['28']);
  assert.equal(item.coordinates.latitude,candidate.latitude);
});
test('R2 wrong-tournament documents and unidentified headings supply no metadata',async()=>{
  for(const page of [eventPage('999'),'<h5>2026 &mdash; Apple Valley, MN/US</h5><a href="events.mhtml?tourn_id=8&event_id=10">PF</a><h6>Circuits</h6><a href="/index/circuit/index.mhtml?circuit_id=999">Other Circuit</a>',eventPage('8').replace('<h2>Tournament</h2>','')]) {
    const item=await pageItem(page);
    assert.equal(item.status,'unavailable');assert.deepEqual(item.events,[]);assert.deepEqual(item.circuits,[]);assert.equal(item.coordinates,null);
  }
});
test('R2 only the identified tournament header supplies location and circuit section ends at next heading',async()=>{
  const page='<h5>2026 &mdash; Wrong City, CA/US</h5>'+eventPage('8').replace('</div></div>','<h6>Other links</h6><a href="/index/circuit/index.mhtml?circuit_id=999">Other circuit</a></div></div>');
  const item=await pageItem(page);
  assert.equal(item.coordinates.latitude,candidate.latitude);
  assert.deepEqual(item.circuits.map(c=>c.id),['28']);
});
test('R3 exact quote-aware href parsing rejects data attributes and quoted decoys',async()=>{
  for(const attribute of ['data-href','not-href','title="decoy href=\'fake\'" data-href']) {
    let page=eventPage('8').replace('href="events.mhtml?event_id=',attribute+'="events.mhtml?event_id=').replace('href="/index/circuit/',attribute+'="/index/circuit/');
    const item=await pageItem(page);
    assert.equal(item.status,'unavailable');assert.deepEqual(item.events,[]);assert.deepEqual(item.circuits,[]);
  }
  const page=eventPage('8').replace('href="events.mhtml?event_id=10&tourn_id=8"',`title="decoy href='events.mhtml?event_id=99&tourn_id=8' >" href='events.mhtml?event_id=10&amp;tourn_id=8'`).replace('href="/index/circuit/index.mhtml?circuit_id=28"',`title="href='/index/circuit/index.mhtml?circuit_id=999' >" href='/index/circuit/index.mhtml?circuit_id=28'`);
  const item=await pageItem(page);
  assert.equal(item.events[0].id,'10');assert.deepEqual(item.circuits.map(c=>c.id),['28']);
});

test('browser harness HTTP failures hide diagnostics from clients but log them server-side', async () => {
  const source = fs.readFileSync('scripts/test-discovery-browser.cjs','utf8');
  const start = source.indexOf('  const server = http.createServer(');
  const end = source.indexOf('  let browser;',start);
  assert.ok(start >= 0 && end > start);
  let handle;
  const diagnostic = Error('SECRET <SCRIPT> internal worker failure');
  const logged = [];
  const box = vm.createContext({Request, Buffer,
    http:{createServer(callback){handle=callback;}},
    worker:{async fetch(){throw diagnostic;}},
    console:{error(...args){logged.push(args);}},
  });
  vm.runInContext(source.slice(start,end),box);
  let status, body;
  await handle({url:'/'},{writeHead(code){status=code;},end(text){body=text;}});
  assert.equal(status,500);
  assert.doesNotMatch(body,/secret|<script>|internal worker failure/i);
  assert.equal(body,'Internal server error');
  assert.ok(logged.some(args=>args.includes(diagnostic)),'original exception retained in server diagnostics');
});
