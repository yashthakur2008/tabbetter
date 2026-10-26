import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeExport } from '../src/data.mjs';

const raw = () => ({ id: 1, public: true, schools: [{ id: 9, name: 'School', entries: [{id: 11, event: 2, code: 'AB', students: [{id: 22, first: 'Ada', last: 'Bee'}]}]}], categories: [{ events: [{id: 2, name: 'PF', result_sets: [
  {published: 1, tag: 'speaker', entity: 'student', label: 'Speakers <Open>', results: [{rank: 1, place: '1-T', student: 22, entry: 11, round: 4}]},
  {published: 1, tag: 'seed', label: 'Prelim Seeds', results: [{rank: 2, entry: 11}]},
  {published: 1, tag: 'final', label: 'Final Places', results: [{rank: 3, entry: 11}]},
  {published: 0, tag: 'speaker', label: 'Private', results: [{rank: 1}]},
]}]}] });
function app() {
  const nodes = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, {innerHTML: '', value: '', addEventListener(){}, insertAdjacentHTML(_, html){this.innerHTML += html;}}); return nodes.get(key); };
  const context = vm.createContext({document: {querySelector: node, querySelectorAll: () => []}, window: {}, localStorage: {getItem: () => null}, location: {hash: '#tournament/1/results'}, URLSearchParams, console});
  const source = fs.readFileSync('web/app.js', 'utf8');
  vm.runInContext(source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")')), context);
  const fixture = normalizeExport(raw(), '1');
  fixture.rounds = [{id: '4', eventId: '2', event: 'PF', name: 'Round 1', sections: []}, {id: '5', eventId: '3', event: 'LD', name: 'Round 1', sections: []}];
  fixture.events.push({id: '3', name: 'LD'});
  context.fixture = fixture;
  vm.runInContext('tournament = fixture; lastId = "1";', context);
  return {context, node, run: code => vm.runInContext(code, context)};
}
test('published export retains verified result metadata and public student identity', () => {
  const d = normalizeExport(raw(), '1');
  assert.equal(d.resultSets.length, 3);
  assert.equal(d.resultSets[0].eventId, '2');
  assert.equal(d.resultSets[0].tag, 'speaker');
  assert.equal(d.resultSets[0].results[0].studentName, 'Ada Bee');
  assert.equal(d.resultSets[0].results[0].roundId, '4');
});
test('standings preserve labels, medals, public speaker names and other sets', () => {
  const a = app(); a.run('drawRounds("results")');
  const html = a.node('#round-list').innerHTML;
  for (const label of ['Speaker Awards', 'Prelim Rankings', 'Speakers &lt;Open&gt;', 'Final Places', 'Ada Bee', '1-T', 'medal-gold', 'medal-silver', 'medal-bronze']) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /Private/);
});
test('event selection limits rounds, resets prior round and filters standings', () => {
  const a = app(); a.run('renderDetail()');
  assert.match(a.node('#detail-content').innerHTML, /id="round-event"/);
  a.node('#round-event').onchange({target: {value: '2'}});
  assert.match(a.node('#detail-content').innerHTML, /value="4"/);
  assert.doesNotMatch(a.node('#detail-content').innerHTML, /value="5"/);
  a.node('#round-filter').onchange({target: {value: '4'}});
  a.node('#round-event').onchange({target: {value: '3'}});
  assert.equal(a.run('roundFilter'), '');
  assert.doesNotMatch(a.node('#round-list').innerHTML, /Ada Bee|Final Places/);
  assert.match(a.node('#round-list').innerHTML, /Speaker Awards[\s\S]*?Not published/);
});
test('missing ranks do not fabricate medals and missing speaker names never use team identity', () => {
  const a = app();
  a.run('tournament.resultSets = [{eventId:"2", event:"PF", tag:"speaker", label:"Speaker Awards", results:[{studentId:"999", entryId:"11", place:"Winner"}]}]; drawRounds("results")');
  const html = a.node('#round-list').innerHTML;
  assert.match(html, /Speaker name not published/);
  assert.doesNotMatch(html, /medal-gold|medal-silver|medal-bronze|>AB</);
});
test('refresh preserves valid filters and drops invalid selections', async () => {
  const a = app();
  a.context.fetch = async path => ({ok: true, json: async () => path.includes('/api/tournament') ? a.context.fixture : {paragraphs: [], links: []}});
  a.run('roundEvent = "2"; roundFilter = "4"; detailFilter = "Ada";');
  await a.run('loadTournament("1")');
  assert.equal(a.run('roundEvent'), '2'); assert.equal(a.run('roundFilter'), '4'); assert.equal(a.run('detailFilter'), 'Ada');
  a.context.fixture.rounds = [];
  await a.run('loadTournament("1")');
  assert.equal(a.run('roundFilter'), '');
});
test('one section-level publication warning and compact verified judge links', () => {
  const a = app();
  a.run('tournament.resultSets=[]; tournament.rounds[0].sections=[{room:"1", ballots:[{entryId:"a",entry:"A",judge:"J",judgePersonId:"12",scores:[]},{entryId:"b",entry:"B",judge:"J",judgePersonId:"12",scores:[]}]}]; drawRounds("results")');
  const html = a.node('#round-list').innerHTML;
  assert.equal((html.match(/Panel outcome not confirmed/g) || []).length, 1);
  assert.match(html, />Paradigm ↗<\/a>/);
  assert.match(html, /title="[^"]*login required/);
});
test('standings never add ordinal list numbers that could contradict published ties', () => {
  const a = app(); a.run('drawRounds("results")');
  assert.doesNotMatch(a.node('#round-list').innerHTML, /<ol/);
});
test('result reveal observes the final DOM after standings are included', () => {
  const a = app(); a.run('revealCards = (root) => { globalThis.observedHTML = root.innerHTML; }; drawRounds("results")');
  assert.equal(a.context.observedHTML, a.node('#round-list').innerHTML);
});
test('empty published prelim tables are retained but never treated as ranked seed results', () => {
  const a = app();
  a.run('tournament.resultSets=[{eventId:"2",event:"PF",tag:"table",label:"Prelims Table",results:[]}]; drawRounds("results")');
  const html = a.node('#round-list').innerHTML;
  assert.match(html, /Prelim Rankings<\/h2><div class="card empty">Not published/);
  assert.match(html, /Prelims Table/);
  assert.match(html, /Rankings not published in this export/);
});
test('pairings use the event and round selection without showing standings or result colors', () => {
  const a = app();
  a.context.location.hash = '#tournament/1/pairings';
  a.run('tournament.rounds.forEach(r=>r.sections=[{room:r.event,ballots:[]}]); renderDetail()');
  a.node('#round-event').onchange({target:{value:'2'}});
  a.node('#round-filter').onchange({target:{value:'4'}});
  const html = a.node('#round-list').innerHTML;
  assert.match(html, /PF · Round 1/);
  assert.doesNotMatch(html, /LD · Round 1|Speaker Awards|entry-result-win/);
});
