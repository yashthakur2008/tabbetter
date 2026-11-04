import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRoundRows } from '../src/rankings/parse.mjs';
import { sideSplit, speakerTrend, opponentSummary } from '../src/rankings/stats.mjs';

const round = (aff, neg, winner, affPoints = null, negPoints = null, judge = 'Judge') => ({ aff, neg, judge, winner, affPoints, negPoints });
const tagged = (rows, tournament = 'Berkeley') => rows.map((r) => ({ ...r, tournament }));

test('side splits count aff and neg records from the published winner column', () => {
  const rows = tagged([
    round('Me AB', 'Other CD', 'aff'),
    round('Me AB', 'Third EF', 'neg'),
    round('Rival GH', 'Me AB', 'neg'),
    round('Rival GH', 'Me AB', 'aff'),
  ]);
  const split = sideSplit(rows, 'Me AB');
  assert.deepEqual(split.aff, { wins: 1, losses: 1 });
  assert.deepEqual(split.neg, { wins: 1, losses: 1 });
  assert.equal(split.sampleSize, 4);
  assert.equal(split.excluded, 0);
});

test('unresolved outcomes are excluded, never counted as losses', () => {
  const rows = tagged([round('Me AB', 'Other CD', null), round('Me AB', 'Other CD', 'aff')]);
  const split = sideSplit(rows, 'Me AB');
  assert.deepEqual(split.aff, { wins: 1, losses: 0 });
  assert.deepEqual(split.neg, { wins: 0, losses: 0 });
  assert.equal(split.excluded, 1);
  assert.equal(split.sampleSize, 1, 'sample size counts only decided rounds');
});

test('a competitor with no rounds yields an empty, honest split', () => {
  const split = sideSplit(tagged([round('A AA', 'B BB', 'aff')]), 'Me AB');
  assert.equal(split.sampleSize, 0);
  assert.equal(split.excluded, 0);
  assert.deepEqual(split.aff, { wins: 0, losses: 0 });
});

test('speaker trends average only published points and report the contributing rounds', () => {
  const rows = [
    { ...round('Me AB', 'X YZ', 'aff', 29.0, 28.0), tournament: 'Berkeley' },
    { ...round('W XY', 'Me AB', 'neg', 28.0, 30.0), tournament: 'Berkeley' },
    { ...round('Me AB', 'Q RS', 'aff', null, 28.0), tournament: 'Berkeley' },
    { ...round('Me AB', 'T UV', 'aff', 27.0, 28.0), tournament: 'Harvard' },
  ];
  const trend = speakerTrend(rows, 'Me AB');
  assert.equal(trend.length, 2);
  assert.deepEqual(trend[0], { tournament: 'Berkeley', average: 29.5, rounds: 2 });
  assert.deepEqual(trend[1], { tournament: 'Harvard', average: 27, rounds: 1 });
});

test('a tournament with no published points produces no average at all', () => {
  const rows = [{ ...round('Me AB', 'X YZ', 'aff', null, null), tournament: 'Berkeley' }];
  assert.deepEqual(speakerTrend(rows, 'Me AB'), []);
});

test('opponent summaries are symmetric and never include the competitor', () => {
  const rows = tagged([
    round('Me AB', 'Rival CD', 'aff'),
    round('Rival CD', 'Me AB', 'aff'),
    round('Me AB', 'Other EF', null),
  ]);
  const summary = opponentSummary(rows, 'Me AB');
  assert.equal(summary.length, 2);
  const rival = summary.find((s) => s.opponent === 'Rival CD');
  assert.deepEqual(rival, { opponent: 'Rival CD', meetings: 2, wins: 1, losses: 1 });
  const other = summary.find((s) => s.opponent === 'Other EF');
  assert.deepEqual(other, { opponent: 'Other EF', meetings: 1, wins: 0, losses: 0 }, 'an undecided meeting is counted but not scored');
  assert.equal(summary.some((s) => s.opponent === 'Me AB'), false);
});

test('a bye with no opponent is not turned into a phantom rival', () => {
  const summary = opponentSummary(tagged([round('Me AB', '', 'aff')]), 'Me AB');
  assert.deepEqual(summary, []);
});

test('statistics run over a real archived round file', () => {
  const rows = parseRoundRows(fs.readFileSync('tests/fixtures/rankings/round-sample.csv', 'utf8'))
    .map((r) => ({ ...r, tournament: 'Berkeley' }));
  const split = sideSplit(rows, 'Gunn SP');
  assert.deepEqual(split.aff, { wins: 1, losses: 0 });
  assert.equal(split.sampleSize, 1);
  assert.deepEqual(speakerTrend(rows, 'Gunn SP'), [{ tournament: 'Berkeley', average: 29.4, rounds: 1 }]);
  assert.deepEqual(opponentSummary(rows, 'Gunn SP'), [{ opponent: 'St Francis ZC', meetings: 1, wins: 1, losses: 0 }]);
});
