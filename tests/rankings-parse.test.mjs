import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRankingRows, parseEntries, parseRoundRows } from '../src/rankings/parse.mjs';

const fixture = (name) => fs.readFileSync('tests/fixtures/rankings/' + name, 'utf8');

test('headerless ranking rows parse with codes preserved verbatim', () => {
  const rows = parseRankingRows(fixture('ld-rankings-sample.csv'));
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], { rank: 1, code: 'Strake Jesuit  ZD', name: 'Zion Dixon', elo: 2600.377 });
  assert.equal(rows[2].code, 'Strake Jesuit  JW', 'double spaces in team codes are source data');
  assert.equal(rows[3].elo, 2428.36);
});

test('ranking rows reject malformed input instead of inventing values', () => {
  const rows = parseRankingRows('1,Code AB,Name,notanumber,N\n,,,,\n2,Code CD,Other,1500,N\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rank, 2);
  assert.deepEqual(parseRankingRows(''), []);
  assert.deepEqual(parseRankingRows(null), []);
});

test('entry rosters expose institution, location and code', () => {
  const entries = parseEntries(fixture('entries-sample.csv'));
  assert.equal(entries.length, 5);
  assert.deepEqual(entries[0], { institution: 'Able2Shine', location: 'CA/US', entry: 'Maxwell Hu', code: 'Able2Shine MH', record: '' });
  assert.equal(entries[1].location, 'TW', 'international entries have no state component');
});

test('round rows expose side, judge, outcome and speaker points', () => {
  const rounds = parseRoundRows(fixture('round-sample.csv'));
  assert.equal(rounds.length, 5);
  assert.deepEqual(rounds[0], { aff: 'Gunn SP', neg: 'St Francis ZC', judge: 'Adam Mimou', winner: 'aff', affPoints: 29.4, negPoints: 29.2 });
  assert.equal(rounds[2].winner, 'neg');
});

test('unresolved outcomes and missing points stay null rather than becoming zero or losses', () => {
  const rows = parseRoundRows('Aff,Neg,Judge,Win,"Aff\tPoints","Neg\tPoints"\nA AA,B BB,,,,\nC CC,D DD,Judge X,Pending,28,\n');
  assert.equal(rows[0].winner, null);
  assert.equal(rows[0].judge, '');
  assert.equal(rows[0].affPoints, null);
  assert.equal(rows[1].winner, null, 'only Aff or Neg are real outcomes');
  assert.equal(rows[1].affPoints, 28);
  assert.equal(rows[1].negPoints, null);
});

test('quoted fields, CRLF and trailing newlines are tolerated', () => {
  const rows = parseRoundRows('Aff,Neg,Judge,Win,"Aff Points","Neg Points"\r\n"Lex, AB",Neg CD,"Judge, Jr.",Aff,29,28\r\n\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].aff, 'Lex, AB');
  assert.equal(rows[0].judge, 'Judge, Jr.');
  const entries = parseEntries('Institution,Location,Entry,Code,Record\r\n"Saint Mary, CA",CA/US,Pat Lee,SM PL,3-2\r\n');
  assert.equal(entries[0].institution, 'Saint Mary, CA');
});

test('bye and forfeit style rows do not fabricate an opponent', () => {
  const rows = parseRoundRows('Aff,Neg,Judge,Win,"Aff Points","Neg Points"\nGunn SP,,Judge A,Aff,29,\n');
  assert.equal(rows[0].neg, '');
  assert.equal(rows[0].negPoints, null);
});
