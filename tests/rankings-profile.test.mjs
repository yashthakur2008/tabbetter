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

test('imported row counts do not imply a published field size or percentile', () => {
  const partial = render(history, 1524);
  assert.doesNotMatch(partial, /Top \d|Field size/);
  assert.match(partial, /Imported entries/);
  const unknown = render(history, null);
  assert.doesNotMatch(unknown, /Top \d/, 'no cohort means no invented percentile');
  assert.match(unknown, /not published|unknown|unavailable/i);
});

test('a tournament placement is not a national rating or percentile', () => {
  const html = render([{
    season: '2025-2026', event: 'Dramatic Interp', code: '2092', name: 'Example Competitor',
    rank: 14, elo: null, tournament: 'NSDA National Tournament',
    tournamentUrl: 'https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=37602',
    provider: 'National Speech & Debate Association',
    methodology: 'Official national placement published in the tournament results packet.',
    sourceUrl: 'https://example.org/packet.pdf',
  }], 2);
  assert.match(html, /Tournament place<\/span><span class="stat-value">#14/);
  assert.match(html, /NSDA National Tournament/);
  assert.match(html, /tourn_id=37602/);
  assert.doesNotMatch(html, /Top \d|National rank|Rating by season|Field size/);
  assert.doesNotMatch(html, /DebateDrills|Elo/, 'record provenance overrides the cohort publisher');
});

test('season points are labeled as points rather than an Elo rating', () => {
  const html = render([{
    season: '2026-2027', event: 'Parliamentary', code: 'School AB', name: 'Alpha & Beta', rank: 1, elo: 58.2,
    provider: 'National Parliamentary Debate League', methodology: 'Season points from published tournament results.',
  }], 275);
  assert.match(html, /Points<\/span><span class="stat-value">58\.20/);
  assert.match(html, /Points by season/);
  assert.doesNotMatch(html, /National rank|Rating by season|Top \d/);
});

test('missing ratings never become zero-valued points in a rating sparkline', () => {
  const a = app();
  a.context.fixture = [{ season: '2024-2025', elo: 1700 }, { season: '2025-2026', elo: null }];
  assert.equal(vm.runInContext('ratingSparkline(fixture)', a.context), '');
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
  assert.match(html, /Imported entries<\/span><span class="stat-value">2</);
});

test('a malformed competitor route fails safely', async () => {
  // No event segment at all: the route cannot identify a competitor.
  const a = app('#competitor//2025-2026/Someone');
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
  assert.match(html, /2023-2024[\s\S]*?Unranked/, "another person's season appears only as unranked for this competitor");
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
  assert.match(list, /data-competitor="LD\/2025-2026\/Marlborough%20OO"/, 'each row carries its own profile destination');
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

test('seasons with no ranking are shown as unranked rather than omitted', () => {
  // Real archive case: "Harker DS" appears only in 2021-2022 and 2022-2023.
  const html = render([
    { season: '2021-2022', event: 'LD', code: 'Harker DS', name: 'Deven Shah', rank: 6, elo: 2306.193 },
    { season: '2022-2023', event: 'LD', code: 'Harker DS', name: 'Deven Shah', rank: 40, elo: 1900 },
  ], 1046, { seasons: ['2021-2022', '2022-2023', '2023-2024', '2024-2025'] });
  assert.match(html, /2023-2024[\s\S]*?Unranked/, 'a season with no published rating reads Unranked');
  assert.match(html, /2024-2025[\s\S]*?Unranked/);
  assert.match(html, /Deven Shah/);
  assert.doesNotMatch(html, /2023-2024<\/th><td>LD<\/td><td>#/, 'an unranked season gets no invented rank');
});

test('a competitor absent from the requested season is reported as unranked, not missing', () => {
  const a = app('#competitor/LD/2025-2026/Harker%20DS');
  const seasons = {
    '2021-2022': [{ season: '2021-2022', event: 'LD', code: 'Harker DS', name: 'Deven Shah', rank: 6, elo: 2306.193 }],
    '2025-2026': [{ season: '2025-2026', event: 'LD', code: 'Someone EL', name: 'Someone Else', rank: 1, elo: 1800 }],
  };
  a.context.fetch = async (path) => {
    const season = /season=([\d-]+)/.exec(path)?.[1] || '2025-2026';
    return { ok: true, json: async () => ({ ...corpus, season, seasons: Object.keys(seasons), competitors: seasons[season] || [] }) };
  };
  return vm.runInContext('loadCompetitor()', a.context).then(() => {
    const html = a.node('#app').innerHTML;
    assert.match(html, /Deven Shah/, 'the competitor is still identified from the season they do appear in');
    assert.match(html, /Source rank<\/span><span class="stat-value">Unranked/, 'the headline rank reads Unranked for the requested season');
    assert.match(html, /Rating<\/span><span class="stat-value">Unranked/, 'the headline rating does not borrow another season');
    assert.doesNotMatch(html, /stat-value">#6</, "the 2021-2022 rank must not be presented as the 2025-2026 standing");
    assert.doesNotMatch(html, /stat-value">2306/, "the 2021-2022 rating must not be presented as current");
    assert.doesNotMatch(html, /Top \d/, 'no percentile is implied for an unranked season');
    assert.match(html, /does not appear in the 2025-2026/, 'the gap is explained');
  });
});

test('an entirely unknown code says unranked for this source, not that the person is bad', () => {
  const a = app('#competitor/LD/2025-2026/Nobody%20ZZ');
  a.context.fetch = async () => ({ ok: true, json: async () => ({ ...corpus, season: '2025-2026', seasons: ['2025-2026'], competitors: [] }) });
  return vm.runInContext('loadCompetitor()', a.context).then(() => {
    const html = a.node('#app').innerHTML;
    assert.match(html, /Unranked/i);
    assert.match(html, /not appear|no published rating in/i, 'absence is explained as absence from this source');
  });
});

test('ranking rows are navigable without hyperlinking the competitor name', async () => {
  const a = app('#rankings/LD/2025-2026');
  a.context.fetch = async () => ({ ok: true, json: async () => ({ ...corpus, season: '2025-2026', seasons: ['2025-2026'], competitors: [
    { season: '2025-2026', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 1, elo: 1826.218 },
  ] }) });
  await vm.runInContext('rankingSearch = ""; loadRankings()', a.context);
  const list = a.node('#ranking-list').innerHTML;
  assert.match(list, /Olivia Ohr/);
  assert.doesNotMatch(list, /<a[^>]*>Olivia Ohr<\/a>/, 'the name is plain text, not a link');
  assert.match(list, /data-competitor="/, 'the whole row carries the destination');
  assert.match(list, /class="data-table"/, 'rankings use the shared borderless table');
});

test('ranking rows expose a keyboard affordance so the row is still reachable', async () => {
  const a = app('#rankings/LD/2025-2026');
  a.context.fetch = async () => ({ ok: true, json: async () => ({ ...corpus, season: '2025-2026', seasons: ['2025-2026'], competitors: [
    { season: '2025-2026', event: 'LD', code: 'Marlborough OO', name: 'Olivia Ohr', rank: 1, elo: 1826.218 },
  ] }) });
  await vm.runInContext('rankingSearch = ""; loadRankings()', a.context);
  const list = a.node('#ranking-list').innerHTML;
  assert.match(list, /tabindex="0"/);
  assert.match(list, /role="link"/);
});

test('a competitor active in several events gets one chip per event', () => {
  const html = render(
    [
      { season: '2025-2026', event: 'LD', code: 'Harker AB', name: 'Alex Ray', rank: 12, elo: 1700 },
      { season: '2025-2026', event: 'PF', code: 'Harker AB', name: 'Alex Ray', rank: 40, elo: 1600 },
    ],
    1000,
    { seasons: ['2025-2026'] },
  );
  assert.match(html, /class="event-chips/);
  assert.match(html, /event-chip[^>]*>LD</);
  assert.match(html, /event-chip[^>]*>PF</);
  assert.match(html, /aria-pressed="true"/, 'the shown event is marked active');
});

test('a single-event competitor shows no event switcher', () => {
  const html = render(
    [{ season: '2025-2026', event: 'LD', code: 'Harker AB', name: 'Alex Ray', rank: 12, elo: 1700 }],
    1000,
    { seasons: ['2025-2026'] },
  );
  assert.doesNotMatch(html, /class="event-chips/);
});

test('the profile uses the shared borderless table and no bordered cards', () => {
  const html = render(history, 1524, { seasons: ['2024-2025', '2025-2026'] });
  assert.match(html, /class="data-table"/);
  assert.doesNotMatch(html, /class="card profile-rating"/, 'stats are not boxed in a bordered card');
});

test('a placement ranking names its tournament and links to the official source', async () => {
  const a = app('#rankings/Dramatic%20Interp');
  a.context.fetch = async () => ({ ok: true, json: async () => ({
    available: true,
    provider: 'National Speech & Debate Association',
    methodology: 'Official national placement published in the tournament results packet.',
    sourceUrl: 'https://s3.amazonaws.com/tabroom-files/tourns/37602/results/70808/packet.pdf',
    tournament: 'NSDA National Tournament',
    tournamentUrl: 'https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=37602',
    season: '2025-2026',
    seasons: ['2025-2026'],
    events: ['Dramatic Interp'],
    competitors: [{ season: '2025-2026', event: 'Dramatic Interp', code: '2092', name: 'Yutong Jiang', rank: 14, elo: null, school: 'Lakeville North High School' }],
  }) });
  await vm.runInContext('rankingSearch = ""; loadRankings()', a.context);
  const html = a.node('#app').innerHTML;
  assert.match(html, /NSDA National Tournament/, 'the tournament behind the ranking is named');
  assert.match(html, /tourn_id=37602/, 'the ranking links through to Tabroom');
  assert.match(html, /tabroom-files/, 'the official results packet is linked');
});

test('a placement event shows a placing column, not an empty rating', async () => {
  const a = app('#rankings/Dramatic%20Interp');
  a.context.fetch = async () => ({ ok: true, json: async () => ({
    available: true, provider: 'National Speech & Debate Association',
    methodology: 'Official national placement.', sourceUrl: 'https://example.org/p.pdf',
    season: '2025-2026', seasons: ['2025-2026'], events: ['Dramatic Interp'],
    competitors: [{ season: '2025-2026', event: 'Dramatic Interp', code: '2092', name: 'Yutong Jiang', rank: 14, elo: null, school: 'Lakeville North High School' }],
  }) });
  await vm.runInContext('rankingSearch = ""; loadRankings()', a.context);
  const list = a.node('#ranking-list').innerHTML;
  assert.match(list, /Lakeville North High School/, 'the school is shown for a placement event');
  assert.doesNotMatch(list, /Rating/, 'no rating column when the event has no rating');
});

test('NPDL leaderboard uses a points column, not a rating column', async () => {
  const a = app('#rankings/Parliamentary');
  a.context.fetch = async () => ({ ok: true, json: async () => ({
    available: true, provider: 'National Parliamentary Debate League',
    methodology: 'Season points from published tournament results.',
    season: '2026-2027', seasons: ['2026-2027'], events: ['Parliamentary'],
    competitors: [{ season: '2026-2027', event: 'Parliamentary', code: 'School AB', name: 'Alpha & Beta', rank: 1, elo: 58.2 }],
  }) });
  await vm.runInContext('loadRankings()', a.context);
  const list = a.node('#ranking-list').innerHTML;
  assert.match(list, />Points<\/th>/);
  assert.doesNotMatch(list, />Rating<\/th>/);
});

test('explicit rating provenance does not inherit another sources tournament', () => {
  const html = render([{
    season: '2025-2026', event: 'LD', code: 'School AB', name: 'Alpha Beta', rank: 4, elo: null,
    provider: 'Rating publisher', methodology: 'Elo rating.', sourceUrl: 'https://example.org/elo',
    tournament: null, tournamentUrl: null,
  }], 10, {
    provider: 'Placement publisher', methodology: 'Official placement.',
    tournament: 'Other Tournament', tournamentUrl: 'https://example.org/other-tournament',
  });
  assert.match(html, /Rating<\/span><span class="stat-value">Not published/);
  assert.doesNotMatch(html, /Other Tournament|other-tournament|Tournament place/);
});

test('a mixed metric history labels each published value instead of relabeling old ratings', () => {
  const html = render([
    { season: '2024-2025', event: 'Parliamentary', code: 'School AB', name: 'Alpha & Beta', rank: 4, elo: 1700, methodology: 'Elo rating.' },
    { season: '2025-2026', event: 'Parliamentary', code: 'School AB', name: 'Alpha & Beta', rank: 2, elo: 58.2, methodology: 'Season points from results.' },
  ], 100);
  assert.match(html, /Published results by season/);
  assert.match(html, /1700[^<]*Rating/);
  assert.match(html, /58\.2[^<]*Points/);
  assert.doesNotMatch(html, /<svg/, 'different metrics are never connected in a rating chart');
});

test('changing ranked event drops the previous events potentially unavailable season', async () => {
  const a = app('#rankings/Lincoln-Douglas/2026-2027');
  a.context.fetch = async () => ({ ok: true, json: async () => ({
    ...corpus, event: 'Lincoln-Douglas', season: '2026-2027',
    events: ['Lincoln-Douglas', 'Dramatic Interp'], seasons: ['2025-2026', '2026-2027'], competitors: [],
  }) });
  await vm.runInContext('loadRankings()', a.context);
  a.node('#rank-event').value = 'Dramatic Interp';
  a.node('#rank-season').value = '2026-2027';
  a.node('#rank-event').onchange();
  assert.equal(a.context.location.hash, 'rankings/Dramatic%20Interp');
  a.node('#rank-season').value = '2025-2026';
  a.node('#rank-season').onchange();
  assert.equal(a.context.location.hash, 'rankings/Dramatic%20Interp/2025-2026', 'explicit season selection is retained');
});

for (const [hash, loader] of [
  ['#rankings/%E0%A4%A', 'loadRankings()'],
  ['#competitor/%E0%A4%A/2025-2026/Test', 'loadCompetitor()'],
  ['#competitor/LD/2025-2026/%', 'loadCompetitor()'],
]) {
  test('malformed encoded route is contained: ' + hash, async () => {
    const a = app(hash);
    let calls = 0;
    a.context.fetch = async () => { calls++; throw Error('unexpected fetch'); };
    await assert.doesNotReject(async () => vm.runInContext(loader, a.context));
    assert.equal(calls, 0);
    assert.match(a.node('#app').innerHTML, /error|invalid|not available/i);
  });
}
