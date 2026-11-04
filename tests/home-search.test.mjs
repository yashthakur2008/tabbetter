import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/app.js', 'utf8');
const head = source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")'));

function app(hash = '#discover') {
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) nodes.set(key, { value: '', innerHTML: '', textContent: '', dataset: {}, classList: { toggle() {}, add() {}, contains: () => false }, addEventListener(t, f) { this[t] = f; }, querySelector: () => null, querySelectorAll: () => [] });
    return nodes.get(key);
  };
  const document = { hidden: false, documentElement: { dataset: {} }, title: '', querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  const context = vm.createContext({
    document,
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, scrollTo() {}, location: { hash } },
    location: { hash },
    localStorage: { getItem: () => null, setItem() {} },
    setInterval: () => 0,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    console,
  });
  vm.runInContext(head, context);
  return { context, node };
}

test('the home hero carries no clipart illustration', () => {
  const a = app();
  const html = vm.runInContext('hero("Find your next tournament.", "Some copy.")', a.context);
  assert.doesNotMatch(html, /debate-illustration|debate-person|podium|debate-bubble/, 'the stock illustration is gone');
  assert.match(html, /page-hero/);
  assert.match(html, /Find your next tournament/);
});

test('home tiles are colour-coded and navigate without being links', () => {
  const a = app();
  const html = vm.runInContext('homeTiles([{ tone: "teal", eyebrow: "LIVE", title: "Rankings", body: "Season standings.", value: "19", route: "rankings/LD" }])', a.context);
  assert.match(html, /tone-teal/);
  assert.match(html, /data-tile="rankings\/LD"/);
  assert.match(html, /class="tile/);
  assert.doesNotMatch(html, /<a /, 'tiles are buttons, not anchor links');
});

test('search finds a tournament by name and a competitor by name', () => {
  const a = app();
  vm.runInContext(
    'calendar = { tournaments: [{ id: "1", name: "Berkeley Invitational", dates: "Feb 14", location: "CA" }, { id: "2", name: "Glenbrooks", dates: "Nov 20", location: "IL" }] };' +
      'searchIndex = { competitors: [{ name: "Olivia Ohr", code: "Marlborough OO", event: "LD", season: "2025-2026" }] };',
    a.context,
  );
  const berk = vm.runInContext('searchEverything("berkeley")', a.context);
  assert.equal(berk.tournaments.length, 1);
  assert.equal(berk.tournaments[0].name, 'Berkeley Invitational');
  const person = vm.runInContext('searchEverything("olivia")', a.context);
  assert.equal(person.competitors.length, 1);
  assert.equal(person.competitors[0].name, 'Olivia Ohr');
  const none = vm.runInContext('searchEverything("zzzz")', a.context);
  assert.equal(none.tournaments.length + none.competitors.length, 0);
});

test('search matches a school code and ignores case and padding', () => {
  const a = app();
  vm.runInContext(
    'calendar = { tournaments: [] };' +
      'searchIndex = { competitors: [{ name: "Olivia Ohr", code: "Marlborough OO", event: "LD", season: "2025-2026" }] };',
    a.context,
  );
  const byCode = vm.runInContext('searchEverything("  MARLBOROUGH ")', a.context);
  assert.equal(byCode.competitors.length, 1);
});

test('an empty query returns nothing rather than the whole corpus', () => {
  const a = app();
  vm.runInContext('calendar = { tournaments: [{ id: "1", name: "Berkeley", dates: "", location: "" }] }; searchIndex = { competitors: [] };', a.context);
  const empty = JSON.parse(vm.runInContext('JSON.stringify(searchEverything("   "))', a.context));
  assert.deepEqual(empty, { tournaments: [], competitors: [] });
});

test('search results render as rows with a destination and no inline links', () => {
  const a = app();
  const html = vm.runInContext(
    'renderSearchResults({ tournaments: [{ id: "1", name: "Berkeley Invitational", dates: "Feb 14", location: "CA" }], competitors: [{ name: "Olivia Ohr", code: "Marlborough OO", event: "LD", season: "2025-2026" }] })',
    a.context,
  );
  assert.match(html, /Berkeley Invitational/);
  assert.match(html, /Olivia Ohr/);
  assert.match(html, /data-goto="tournament\/1/);
  assert.match(html, /data-goto="competitor\/LD/);
  assert.doesNotMatch(html, /<a /, 'results are buttons, not anchors');
});

test('the competitor index is loaded once and reused for later searches', async () => {
  const a = app('#discover');
  let calls = 0;
  a.context.fetch = async (path) => {
    calls++;
    return { ok: true, json: async () => ({
      available: true, season: '2025-2026', seasons: ['2025-2026'],
      competitors: [{ season: '2025-2026', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 1, elo: 1826 }],
    }) };
  };
  await vm.runInContext('ensureSearchIndex()', a.context);
  const first = calls;
  await vm.runInContext('ensureSearchIndex()', a.context);
  assert.equal(calls, first, 'the index is not refetched on every keystroke');
  const found = JSON.parse(vm.runInContext('JSON.stringify(searchEverything("olivia"))', a.context));
  assert.equal(found.competitors.length, 1);
  assert.equal(found.competitors[0].name, 'Olivia Ohr');
});

test('an unavailable rankings corpus leaves search working for tournaments', async () => {
  const a = app('#discover');
  a.context.fetch = async () => ({ ok: true, json: async () => ({ available: false, reason: 'not included' }) });
  vm.runInContext('calendar = { tournaments: [{ id: "1", name: "Hunter Haunting", dates: "", location: "UT" }] };', a.context);
  await vm.runInContext('ensureSearchIndex()', a.context);
  const found = JSON.parse(vm.runInContext('JSON.stringify(searchEverything("hunter"))', a.context));
  assert.equal(found.tournaments.length, 1);
  assert.equal(found.competitors.length, 0, 'no corpus means no competitors, not a crash');
});
