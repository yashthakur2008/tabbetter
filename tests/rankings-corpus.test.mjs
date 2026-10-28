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
  assert.equal(record.event, 'LD');
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
  const gap = report.find((r) => r.season === '2022-2023' && r.event === 'LD');
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
  assert.deepEqual(corpus.events, ['LD']);
  const round = JSON.parse(JSON.stringify(corpus));
  assert.deepEqual(round.competitors, corpus.competitors);
  assert.equal(typeof corpus.generatedAt, 'string');
});

test('unsupported events are rejected so participation points never pose as Elo', () => {
  const corpus = buildCorpus([
    { season: '2021-2022', event: 'Congress', rankings: [{ rank: 1, code: 'X YZ', name: 'X Y', elo: 100 }] },
  ], options);
  assert.equal(corpus.competitors.length, 0);
  assert.deepEqual(corpus.events, []);
});

test('the corpus serialises compactly and rehydrates to identical records', () => {
  const corpus = buildCorpus([
    { season: '2021-2022', event: 'LD', rankings: [{ rank: 1, code: 'Strake Jesuit  ZD', name: 'Zion Dixon', elo: 2600.377 }] },
    { season: '2021-2022', event: 'PF', rankings: [{ rank: 2, code: 'Team AB', name: 'A & B', elo: 1800 }] },
  ], options);
  const text = JSON.stringify(serializeCorpus(corpus));
  const occurrences = text.split('DebateDrills').length - 1;
  assert.equal(occurrences, 1, 'provenance is stored once, not repeated per row');
  const restored = hydrateCorpus(JSON.parse(text));
  assert.deepEqual(restored.competitors, corpus.competitors);
  assert.equal(restored.provider, corpus.provider);
  assert.equal(restored.window.from, corpus.window.from);
});
