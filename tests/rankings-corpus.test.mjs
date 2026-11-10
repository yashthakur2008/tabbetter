import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonWindow, buildCorpus, coverageReport, serializeCorpus, hydrateCorpus } from '../src/rankings/corpus.mjs';

const SOURCE = 'https://github.com/skumar-ml/debate-rankings';
const options = { from: '2021-10-28', to: '2026-10-28', sourceUrl: SOURCE, retrievedAt: '2026-10-28T03:00:00.000Z' };

test('only seasons overlapping the five-year window are imported', () => {
  assert.deepEqual(seasonWindow(['2019-2020', '2020-2021', '2021-2022', '2024-2025', '2026-2027', '2027-2028'], options), [
    '2021-2022', '2024-2025', '2026-2027',
  ]);
});

test('every imported competitor carries source, retrieval time and methodology', () => {
  const corpus = buildCorpus([
    { season: '2021-2022', event: 'LD', rankings: [{ rank: 1, code: 'Strake Jesuit  ZD', name: 'Zion Dixon', elo: 2600.377 }] },
  ], options);
  const [record] = corpus.competitors;
  assert.equal(record.sourceUrl, SOURCE);
  assert.equal(record.retrievedAt, options.retrievedAt);
  assert.match(record.methodology, /Elo/);
  assert.match(record.provider, /DebateDrills/);
  assert.equal(record.season, '2021-2022');
  assert.equal(record.event, 'Lincoln-Douglas', 'the LD abbreviation resolves to the official event name');
  assert.equal(record.elo, 2600.377);
  assert.equal(corpus.window.from, '2021-10-28');
});

test('a season outside the window contributes nothing', () => {
  const corpus = buildCorpus([
    { season: '2018-2019', event: 'LD', rankings: [{ rank: 1, code: 'Old AB', name: 'Old Name', elo: 1800 }] },
  ], options);
  assert.equal(corpus.competitors.length, 0);
});

test('duplicate season, event and code rows are deduplicated by best published rank', () => {
  // Both orderings must agree, so dedup cannot depend on which row arrives last.
  for (const ranks of [[5, 3], [3, 5]]) {
    const corpus = buildCorpus([
      { season: '2022-2023', event: 'PF', rankings: ranks.map((rank) => ({ rank, code: 'Team AB', name: 'A & B', elo: 1700 + rank })) },
    ], options);
    assert.equal(corpus.competitors.length, 1);
    assert.equal(corpus.competitors[0].rank, 3);
    assert.equal(corpus.competitors[0].elo, 1703, 'the kept row keeps its own rating');
  }
});

test('coverage reports empty seasons as explicit gaps instead of hiding them', () => {
  const corpus = buildCorpus([
    { season: '2021-2022', event: 'LD', rankings: [{ rank: 1, code: 'A AB', name: 'A B', elo: 1900 }] },
    { season: '2022-2023', event: 'LD', rankings: [] },
  ], options);
  const report = coverageReport(corpus);
  const gap = report.find((r) => r.season === '2022-2023' && r.event === 'Lincoln-Douglas');
  assert.equal(gap.competitors, 0);
  assert.equal(gap.covered, false);
  const covered = report.find((r) => r.season === '2021-2022');
  assert.equal(covered.covered, true);
  assert.equal(covered.competitors, 1);
});

test('the corpus serialises to JSON and declares its covered events', () => {
  const corpus = buildCorpus([
    { season: '2021-2022', event: 'LD', rankings: [{ rank: 1, code: 'A AB', name: 'A B', elo: 1900 }] },
  ], options);
  assert.deepEqual(corpus.events, ['Lincoln-Douglas']);
  const round = JSON.parse(JSON.stringify(corpus));
  assert.deepEqual(round.competitors, corpus.competitors);
  assert.equal(typeof corpus.generatedAt, 'string');
});

test('a placement event carries no Elo, so participation points never pose as a rating', () => {
  const corpus = buildCorpus([
    {
      season: '2021-2022',
      event: 'Congressional Debate',
      provider: 'National Speech & Debate Association',
      methodology: 'Official national placement.',
      sourceUrl: 'https://example.org/packet.pdf',
      rankings: [{ rank: 1, code: 'X YZ', name: 'X Y', elo: null }],
    },
  ], options);
  assert.equal(corpus.competitors.length, 1);
  assert.equal(corpus.competitors[0].elo, null);
  assert.doesNotMatch(corpus.competitors[0].methodology, /Elo/);
  assert.deepEqual(corpus.events, ['Congressional Debate']);
});

test('the corpus serialises compactly and rehydrates to identical records', () => {
  const corpus = buildCorpus([
    { season: '2021-2022', event: 'LD', rankings: [{ rank: 1, code: 'Strake Jesuit  ZD', name: 'Zion Dixon', elo: 2600.377 }] },
    { season: '2021-2022', event: 'PF', rankings: [{ rank: 2, code: 'Team AB', name: 'A & B', elo: 1800 }] },
  ], options);
  const text = JSON.stringify(serializeCorpus(corpus));
  const occurrences = text.split('DebateDrills x NSD x DebateLand').length - 1;
  assert.ok(occurrences <= 3, 'provenance is stored per source, not repeated per row: ' + occurrences);
  const restored = hydrateCorpus(JSON.parse(text));
  assert.deepEqual(restored.competitors, corpus.competitors);
  assert.equal(restored.provider, corpus.provider);
  assert.equal(restored.window.from, corpus.window.from);
});

test('the default window covers only the 2025-2026 season', () => {
  const seasons = ['2021-2022', '2024-2025', '2025-2026', '2026-2027'];
  const single = seasonWindow(seasons, { from: '2025-08-01', to: '2026-07-31' });
  assert.deepEqual(single, ['2025-2026'], 'only the last completed season is in range');
});

test('a season outside the single-season window contributes nothing', () => {
  const opts2 = { from: '2025-08-01', to: '2026-07-31', sourceUrl: SOURCE, retrievedAt: options.retrievedAt };
  const corpus = buildCorpus([
    { season: '2024-2025', event: 'LD', rankings: [{ rank: 1, code: 'Old AB', name: 'Old Name', elo: 1800 }] },
    { season: '2025-2026', event: 'LD', rankings: [{ rank: 1, code: 'New AB', name: 'New Name', elo: 1900 }] },
  ], opts2);
  assert.equal(corpus.competitors.length, 1);
  assert.equal(corpus.competitors[0].season, '2025-2026');
});

test('sources merge into one corpus with each event keeping its own provider', () => {
  const corpus = buildCorpus([
    { season: '2025-2026', event: 'LD', rankings: [{ rank: 1, code: 'A AB', name: 'A B', elo: 1900 }] },
    {
      season: '2025-2026',
      event: 'Dramatic Interp',
      provider: 'National Speech & Debate Association',
      methodology: 'Official national placement.',
      sourceUrl: 'https://example.org/packet.pdf',
      rankings: [{ rank: 14, code: '2092', name: 'Yutong Jiang', elo: null, school: 'Lakeville North High School' }],
    },
  ], options);
  assert.equal(corpus.competitors.length, 2);
  const speech = corpus.competitors.find((c) => c.event === 'Dramatic Interp');
  assert.equal(speech.provider, 'National Speech & Debate Association');
  assert.equal(speech.sourceUrl, 'https://example.org/packet.pdf');
  assert.equal(speech.rank, 14);
  assert.equal(speech.elo, null, 'a placement event has no Elo and does not fake one');
  assert.equal(speech.school, 'Lakeville North High School');
  const ld = corpus.competitors.find((c) => c.event === 'Lincoln-Douglas');
  assert.match(ld.provider, /DebateDrills/);
  assert.deepEqual(corpus.events.sort(), ['Dramatic Interp', 'Lincoln-Douglas']);
});

test('round-trip preserves distinct tournaments and methodologies from one publisher', () => {
  const corpus = buildCorpus([
    {
      season: '2024-2025', event: 'Dramatic Interp', provider: 'Official publisher',
      methodology: 'Final placement', sourceUrl: 'https://example.org/2025.pdf',
      tournament: 'Nationals 2025', tournamentUrl: 'https://example.org/tournament/2025',
      rankings: [{ rank: 1, code: '1001', name: 'First Competitor', school: 'First School' }],
    },
    {
      season: '2025-2026', event: 'Dramatic Interp', provider: 'Official publisher',
      methodology: 'Preliminary placement', sourceUrl: 'https://example.org/2026.pdf',
      tournament: 'Nationals 2026', tournamentUrl: 'https://example.org/tournament/2026',
      rankings: [{ rank: 2, code: '1002', name: 'Second Competitor', school: 'Second School' }],
    },
  ], options);
  const packed = serializeCorpus(corpus);
  const restored = hydrateCorpus(JSON.parse(JSON.stringify(packed)));
  assert.deepEqual(restored.competitors, corpus.competitors);
  assert.equal(packed.sources.length, 2);
});

test('identical source metadata is shared without changing record order', () => {
  const corpus = buildCorpus([
    { season: '2024-2025', event: 'LD', rankings: [
      { rank: 2, code: 'B', name: 'Second', elo: 1700 },
      { rank: 1, code: 'A', name: 'First', elo: 1800 },
    ] },
  ], options);
  const packed = serializeCorpus(corpus);
  assert.equal(packed.sources.length, 1);
  assert.deepEqual(packed.rows.map((r) => r[7]), [0, 0]);
  assert.deepEqual(hydrateCorpus(JSON.parse(JSON.stringify(packed))).competitors, corpus.competitors);
});
