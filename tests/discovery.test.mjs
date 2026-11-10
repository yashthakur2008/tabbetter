import test from 'node:test';
import assert from 'node:assert/strict';
import { DISCOVERY_EVENTS, classifyEvents, distanceKm, discoverTournaments } from '../src/discovery.mjs';

test('distance validates coordinates, preserves zero and handles antipodes', () => {
  const zero = {latitude:0, longitude:0};
  assert.equal(distanceKm(zero, zero), 0);
  for (const p of [null, {}, {latitude:91,longitude:0}, {latitude:0,longitude:181}, {latitude:'0',longitude:0}, {latitude:NaN,longitude:0}]) assert.equal(distanceKm(zero,p), null);
  assert.ok(Math.abs(distanceKm(zero,{latitude:0,longitude:180}) - 20015.114) < .01);
});
test('published aliases classify conservatively and preserve speech distinctions', () => {
  const result = classifyEvents([{name:'Varsity Original Oratory'}, 'JV PF', 'Novice LD', 'Extemp Debate', 'International Extemp', 'Domestic Extemp', 'Extemporaneous Speaking', 'Parliamentary', 'Mystery Event', 'PF']);
  assert.deepEqual(result.map(e=>e.id), ['oo','pf','ld','extemp-debate','ix','usx','extemp','parli','other:mystery event']);
  assert.equal(result[0].sourceLabel,'Varsity Original Oratory');
  assert.equal(result[0].group,'speech');
  assert.equal(result[3].group,'debate');
  assert.equal(result[4].group,'speech');
  assert.equal(result.at(-1).group,'other');
  assert.equal(classifyEvents(['Not PF at all'])[0].group,'other');
  assert.deepEqual(classifyEvents(null),[]);
  for (const label of ['Dramatic Interpretation','Duo Interpretation','Humorous Interpretation','Program Oral Interpretation','Prose','Poetry','Storytelling','Commentary','Declamation','Expository','Impromptu','Informative','Original Spoken Word Poetry','Big Questions','Congressional Debate','Policy','World Schools']) assert.ok(DISCOVERY_EVENTS.some(e=>e.label===label),label);
});
const rows = [
  {id:'2', name:'Beta', sortDate:'2026-12-01', city:'Boston', modes:['In person']},
  {id:'1', name:'Alpha', sortDate:'2026-12-01', modes:['Hybrid']},
  {id:'3', name:'Unknown', sortDate:'2026-12-02'},
  {id:'4', name:'Online', sortDate:'2026-12-01', modes:['Online']},
];
const metadata = {'1':{status:'available',events:['PF','OO'],coordinates:{latitude:0,longitude:0},circuits:[{id:'7',label:'Published circuit'}]},'2':{status:'available',events:['PF'],coordinates:{latitude:0,longitude:1}},'4':{status:'available',events:['OO'],coordinates:{latitude:0,longitude:0}}};
test('ANY/ALL count distinct selected categories and unknown metadata is not absence',()=>{
  assert.deepEqual(discoverTournaments(rows,metadata,{eventIds:['pf','oo','pf'],sort:'matches'}).map(r=>[r.id,r.discovery.eventMatches]),[['1',2],['2',1],['4',1]]);
  assert.deepEqual(discoverTournaments(rows,metadata,{eventIds:['pf','oo'],eventMatch:'all'}).map(r=>r.id),['1']);
  const all=discoverTournaments(rows,metadata,{});
  assert.equal(all.find(r=>r.id==='3').discovery.metadataStatus,'unknown');
  assert.deepEqual(all.find(r=>r.id==='1').discovery.circuitLabels,['Published circuit']);
  assert.equal(rows[0].discovery,undefined);
});
test('radius excludes unknown and online distances, opt-in online is separate and last',()=>{
  const options={origin:{latitude:0,longitude:0},radiusKm:112,sort:'distance',includeOnline:false};
  assert.deepEqual(discoverTournaments(rows,metadata,options).map(r=>r.id),['1','2']);
  assert.deepEqual(discoverTournaments(rows,metadata,{...options,radiusKm:0,includeOnline:true}).map(r=>r.id),['1','4']);
  assert.equal(discoverTournaments(rows,metadata,{origin:options.origin}).find(r=>r.id==='4').discovery.distanceKm,null);
});
test('query and stable date/name/id ties are deterministic regardless of input order',()=>{
  assert.deepEqual(discoverTournaments(rows,metadata,{query:' boston '}).map(r=>r.id),['2']);
  const ties=[{id:'2',name:'Same',sortDate:'2026-01-01'},{id:'1',name:'Same',sortDate:'2026-01-01'}];
  assert.deepEqual(discoverTournaments(ties,{},{}).map(r=>r.id),['1','2']);
  assert.deepEqual(discoverTournaments([...ties].reverse(),{},{}),discoverTournaments(ties,{},{}));
});
