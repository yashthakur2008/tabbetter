import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNpdlRankings, NPDL } from '../src/rankings/npdl.mjs';

test('NPDL team rows parse into a ranked team entry', () => {
  const rows = parseNpdlRankings(
    [
      '#,School,Region,Debater 1,Debater 2,Points',
      'The autoqualification number for 2026-27 is 43.,,,,,',
      '1,Nueva,CA1,Bernhard,Savla,58.2',
      '2,Nueva,CA1,Asudani,Wee,51.9',
      '4,Independent,,Ordukhanyan,Ratchman,44.1',
    ].join('\n'),
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    rank: 1,
    school: 'Nueva',
    region: 'CA1',
    names: ['Bernhard', 'Savla'],
    points: 58.2,
  });
  assert.equal(rows[2].region, '', 'an independent entry has no region, not a fake one');
});

test('NPDL prose rows and malformed points are discarded', () => {
  const rows = parseNpdlRankings(
    ['#,School,Region,Debater 1,Debater 2,Points', 'Note text,,,,,', '1,Nueva,CA1,A,B,notanumber'].join('\n'),
  );
  assert.deepEqual(rows, []);
});

test('NPDL is declared as a team ranking so it is never shown as an individual rating', () => {
  assert.equal(NPDL.entryKind, 'team');
  assert.equal(new URL(NPDL.sourceUrl).hostname, 'www.parliamentarydebate.org');
  assert.equal(NPDL.event, 'Parliamentary');
  assert.match(NPDL.methodology, /point/i);
});

import { canonicalEvent } from '../src/rankings/corpus.mjs';

test('event aliases collapse so one event is not listed twice', () => {
  assert.equal(canonicalEvent('LD'), 'Lincoln-Douglas');
  assert.equal(canonicalEvent('Lincoln-Douglas'), 'Lincoln-Douglas');
  assert.equal(canonicalEvent('PF'), 'Public Forum');
  assert.equal(canonicalEvent('Public Forum'), 'Public Forum');
  assert.equal(canonicalEvent('Policy Debate'), 'Policy Debate');
  assert.equal(canonicalEvent('Dramatic Interp'), 'Dramatic Interp');
});

test('the NPDL season reflects the rankings it publishes', () => {
  // NPDL publishes a rolling current-season table. The season it carries must
  // match the page it was taken from, not be silently relabelled.
  assert.match(NPDL.season, /^\d{4}-\d{4}$/);
  assert.match(NPDL.sourceUrl, new RegExp(NPDL.season.slice(2, 4) + '-' + NPDL.season.slice(7)));
});

test('every NPDL row is kept even when ranks repeat across regions', () => {
  const rows = parseNpdlRankings(
    [
      '#,School,Region,Debater 1,Debater 2,Points',
      '1,Nueva,CA1,Bernhard,Savla,58.2',
      '1,Irvington,CA2,Arun,Jagannati,41.0',
      '2,Carlmont,CA1,Chien,Suto,48.9',
    ].join('\n'),
  );
  assert.equal(rows.length, 3, 'a repeated rank is a different team, not a duplicate');
  assert.deepEqual(rows.map((r) => r.school), ['Nueva', 'Irvington', 'Carlmont']);
  assert.equal(rows[1].points, 41.0, 'each row keeps its own points');
});
