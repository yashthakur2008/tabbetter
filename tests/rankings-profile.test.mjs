import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/app.js', 'utf8');
const head = source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")'));

function app(hash = '#competitor/LD/2025-2026/Marlborough%20OO') {
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

const corpus = {
  available: true,
  provider: 'DebateDrills x NSD x DebateLand',
  methodology: 'Elo rating from published tournament results, as computed by the source project.',
  sourceUrl: 'https://github.com/skumar-ml/debate-rankings',
  retrievedAt: '2026-10-28T03:00:00.000Z',
  window: { from: '2021-10-28', to: '2026-10-28' },
};
const history = [
  { season: '2024-2025', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 12, elo: 1700.5 },
  { season: '2025-2026', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 1, elo: 1826.218 },
];

function render(records, cohort = 1524, extra = {}) {
  const a = app();
  a.context.fixture = { ...corpus, ...extra, records, cohortSize: cohort };
  vm.runInContext('renderCompetitorProfile(fixture)', a.context);
  return a.node('#app').innerHTML;
}

test('the profile leads with rating, rank and cohort like the approved layout', () => {
  const html = render(history);
  assert.match(html, /Olivia Ohr/);
  assert.match(html, /1826\.22|1826\.218/, 'current rating is shown');
  assert.match(html, /#1\b/, 'national rank is shown');
  assert.match(html, /1,?524/, 'the rank is shown against its cohort size');
  assert.match(html, /LD/);
  assert.match(html, /2025-2026/);
});

test('rating history is rendered as data, not only as a picture', () => {
  const html = render(history);
  assert.match(html, /2024-2025[\s\S]*?1700\.5/, 'every season in the history is readable as text');
  assert.ok(/<svg/.test(html) || /rating-history/.test(html), 'a visual trend accompanies the numbers');
});

test('attribution and retrieval time stay visible', () => {
  const html = render(history);
  assert.match(html, /DebateDrills x NSD x DebateLand/);
  assert.match(html, /skumar-ml\/debate-rankings/);
  assert.match(html, /Elo/);
});

test('a percentile is shown only when the cohort size is known', () => {
  assert.match(render(history, 1524), /Top \d/);
  const unknown = render(history, null);
  assert.doesNotMatch(unknown, /Top \d/, 'no cohort means no invented percentile');
  assert.match(unknown, /not published|unknown|unavailable/i);
});

test('a team entry is never presented as one person with an individual rating', () => {
  const html = render([{ season: '2025-2026', event: 'PF', code: 'College Prep FS', name: 'Falk & Sabnani', rank: 1, elo: 2046.372 }]);
  assert.match(html, /team entry|two competitors|not an individual/i);
  assert.match(html, /Falk &amp; Sabnani/, 'the team name is escaped and preserved');
});

test('an unavailable corpus explains itself instead of showing an empty rating', () => {
  const a = app();
  a.context.fixture = { available: false, reason: 'Historical rankings are not included in this build.' };
  vm.runInContext('renderCompetitorProfile(fixture)', a.context);
  const html = a.node('#app').innerHTML;
  assert.match(html, /not included/i);
  assert.doesNotMatch(html, /Top \d/);
});

test('a competitor with no records says so rather than rendering a blank card', () => {
  const html = render([]);
  assert.match(html, /No published rating/i);
});

test('names and codes are escaped', () => {
  const html = render([{ season: '2025-2026', event: 'LD', code: '<img src=x>', name: '<script>bad()</script>', rank: 4, elo: 1500 }]);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.doesNotMatch(html, /<script>bad/);
});

test('the competitor route fetches its own event, season and code', async () => {
  const a = app('#competitor/LD/2025-2026/Marlborough%20OO');
  const calls = [];
  a.context.fetch = async (path) => {
    calls.push(path);
    return { ok: true, json: async () => ({ ...corpus, competitors: [
      { season: '2025-2026', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 1, elo: 1826.218 },
      { season: '2025-2026', event: 'LD', code: 'Other XY', name: 'Someone Else', rank: 2, elo: 1800 },
    ] }) };
  };
  await vm.runInContext('loadCompetitor()', a.context);
  assert.ok(calls.some((c) => c.includes('/api/rankings')), 'the profile uses the rankings API');
  assert.ok(calls.some((c) => c.includes('event=LD') && c.includes('season=2025-2026')));
  const html = a.node('#app').innerHTML;
  assert.match(html, /Olivia Ohr/);
  assert.doesNotMatch(html, /Someone Else/, 'other competitors are not shown on this profile');
  assert.match(html, /1,?524|Field size/);
});

test('a malformed competitor route fails safely', async () => {
  const a = app('#competitor/Congress/2025-2026/Someone');
  a.context.fetch = async () => { throw Error('should not be called'); };
  await vm.runInContext('loadCompetitor()', a.context);
  assert.match(a.node('#app').innerHTML, /not (covered|available)|Unsupported/i);
});

test('a profile shows every season the competitor appears in, not just one', async () => {
  const a = app('#competitor/LD/2025-2026/Strake%20Jesuit%20%20JW');
  const seasons = {
    '2023-2024': [{ season: '2023-2024', event: 'LD', code: 'Strake Jesuit  JW', name: 'Justin Wen', rank: 3, elo: 2165.769 }],
    '2024-2025': [{ season: '2024-2025', event: 'LD', code: 'Strake Jesuit  JW', name: 'Justin Wen', rank: 12, elo: 1773.178 }],
    '2025-2026': [{ season: '2025-2026', event: 'LD', code: 'Strake Jesuit  JW', name: 'Justin Wen', rank: 113, elo: 1614.112 }],
  };
  a.context.fetch = async (path) => {
    const season = /season=([\d-]+)/.exec(path)?.[1];
    return { ok: true, json: async () => ({ ...corpus, seasons: Object.keys(seasons), competitors: seasons[season] || [] }) };
  };
  await vm.runInContext('loadCompetitor()', a.context);
  const html = a.node('#app').innerHTML;
  for (const season of Object.keys(seasons)) assert.match(html, new RegExp(season), season + ' belongs in the history');
  assert.match(html, /2165\.769/);
  assert.match(html, /<svg/, 'a multi-season history draws a trend');
  assert.match(html, /#113/, 'the current season rank leads');
});

test('a reused entry code is never merged into one persons rating history', async () => {
  // Real archive data: "Strake Jesuit  JW" is Justin Wen through 2024-2025 and
  // Jeffery Wei in 2025-2026. Two people must not share one history.
  const a = app('#competitor/LD/2025-2026/Strake%20Jesuit%20%20JW');
  const seasons = {
    '2023-2024': [{ season: '2023-2024', event: 'LD', code: 'Strake Jesuit  JW', name: 'Justin Wen', rank: 3, elo: 2165.769 }],
    '2024-2025': [{ season: '2024-2025', event: 'LD', code: 'Strake Jesuit  JW', name: 'Justin Wen', rank: 12, elo: 1773.178 }],
    '2025-2026': [{ season: '2025-2026', event: 'LD', code: 'Strake Jesuit  JW', name: 'Jeffery Wei', rank: 113, elo: 1614.112 }],
  };
  a.context.fetch = async (path) => {
    const season = /season=([\d-]+)/.exec(path)?.[1];
    return { ok: true, json: async () => ({ ...corpus, seasons: Object.keys(seasons), competitors: seasons[season] || [] }) };
  };
  await vm.runInContext('loadCompetitor()', a.context);
  const html = a.node('#app').innerHTML;
  assert.match(html, /Jeffery Wei/);
  assert.doesNotMatch(html, /2165\.769/, "another person's rating must not appear in this history");
  assert.doesNotMatch(html, /2023-2024/, "another person's season must not appear in this history");
  assert.match(html, /also used by|different competitor|reused/i, 'the shared code is disclosed');
});

test('the rankings browser lists a season and links to each profile', async () => {
  const a = app('#rankings/LD/2025-2026');
  a.context.fetch = async () => ({ ok: true, json: async () => ({ ...corpus, seasons: ['2024-2025', '2025-2026'], competitors: [
    { season: '2025-2026', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 1, elo: 1826.218 },
    { season: '2025-2026', event: 'LD', code: 'Harker AB', name: 'A Debater', rank: 2, elo: 1800 },
  ] }) });
  await vm.runInContext('rankingSearch = ""; loadRankings()', a.context);
  const list = a.node('#ranking-list').innerHTML;
  const shell = a.node('#app').innerHTML;
  assert.match(list, /Olivia Ohr/);
  assert.match(list, /#competitor\/LD\/2025-2026\/Marlborough%20OO/, 'each row links to its own profile');
  assert.match(shell, /DebateDrills x NSD x DebateLand/, 'the leaderboard keeps its attribution');
  assert.match(shell, /LD|Lincoln/);
});

test('rankings search narrows by name or school without crashing on regex characters', async () => {
  const a = app('#rankings/LD/2025-2026');
  a.context.fetch = async () => ({ ok: true, json: async () => ({ ...corpus, seasons: ['2025-2026'], competitors: [
    { season: '2025-2026', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 1, elo: 1826.218 },
    { season: '2025-2026', event: 'LD', code: 'Harker AB', name: 'A Debater', rank: 2, elo: 1800 },
  ] }) });
  await vm.runInContext('rankingSearch = ""; loadRankings()', a.context);
  vm.runInContext('rankingSearch = "marlborough"; drawRankings();', a.context);
  const html = a.node('#ranking-list').innerHTML;
  assert.match(html, /Olivia Ohr/);
  assert.doesNotMatch(html, /A Debater/);
  assert.doesNotThrow(() => vm.runInContext('rankingSearch = "(["; drawRankings();', a.context));
});

test('the rankings nav does not depend on a hardcoded season', async () => {
  const a = app('#rankings');
  const asked = [];
  a.context.fetch = async (path) => {
    asked.push(path);
    return { ok: true, json: async () => ({ ...corpus, season: '2026-2027', seasons: ['2025-2026', '2026-2027'], competitors: [
      { season: '2026-2027', event: 'LD', code: 'New AB', name: 'New Debater', rank: 1, elo: 1700 },
    ] }) };
  };
  await vm.runInContext('rankingSearch = ""; loadRankings()', a.context);
  assert.doesNotMatch(asked.join(' '), /season=2025-2026/, 'an unspecified season must not pin to a stale year');
  assert.match(a.node('#ranking-list').innerHTML, /New Debater/);
});
