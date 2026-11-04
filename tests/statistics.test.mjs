import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/app.js', 'utf8');
function app() {
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) nodes.set(key, { value: '', innerHTML: '', addEventListener(type, fn) { this[type] = fn; } });
    return nodes.get(key);
  };
  const context = vm.createContext({
    URL,
    document: { documentElement: { dataset: {} }, querySelector: node, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} },
    location: { hash: '#tournament/41209/statistics' },
  });
  vm.runInContext(source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")')), context);
  return { context, node };
}
const ballot = (entryId, side, value, judge = 'Judge A') => ({
  entryId,
  entry: entryId,
  judge,
  judgeId: judge,
  judgePersonId: '',
  side: String(side),
  speakerorder: '',
  scores: value === null ? [] : [{ tag: 'winloss', value: String(value) }],
});
const round = (sections, overrides = {}) => ({
  id: '1', name: '1', eventId: 'e1', event: 'Lincoln Douglas JV', eventType: 'debate', sections, ...overrides,
});
function sideSplit(rounds) {
  const a = app();
  a.context.fixtureRounds = rounds;
  return vm.runInContext('JSON.stringify(sideSplit(fixtureRounds))', a.context) && JSON.parse(vm.runInContext('JSON.stringify(sideSplit(fixtureRounds))', a.context));
}

test('a complementary judge vote pair counts once for the winning side', () => {
  const stats = sideSplit([round([{ bye: false, ballots: [ballot('A', 1, 1), ballot('B', 2, 0)] }])]);
  assert.equal(stats.decisions, 1);
  assert.equal(stats.sideOneWins, 1);
  assert.equal(stats.sideTwoWins, 0);
  assert.equal(stats.sideOneLabel, 'Aff');
  assert.equal(stats.sideTwoLabel, 'Neg');
});

test('each panelist vote is counted separately rather than as one match result', () => {
  const stats = sideSplit([round([{ bye: false, ballots: [
    ballot('A', 1, 1, 'J1'), ballot('B', 2, 0, 'J1'),
    ballot('A', 1, 0, 'J2'), ballot('B', 2, 1, 'J2'),
    ballot('A', 1, 1, 'J3'), ballot('B', 2, 0, 'J3'),
  ] }])]);
  assert.equal(stats.decisions, 3);
  assert.equal(stats.sideOneWins, 2);
  assert.equal(stats.sideTwoWins, 1);
});

test('byes, blank decisions, unknown sides and contradictions are excluded with counts', () => {
  const stats = sideSplit([round([
    { bye: true, ballots: [ballot('A', 1, 1), ballot('B', 2, 0)] },
    { bye: false, ballots: [ballot('C', 1, null), ballot('D', 2, null)] },
    { bye: false, ballots: [ballot('E', '', 1), ballot('F', '', 0)] },
    { bye: false, ballots: [ballot('G', 1, 1), ballot('H', 2, 1)] },
    { bye: false, ballots: [ballot('I', 1, 1)] },
  ])]);
  assert.equal(stats.decisions, 0);
  assert.equal(stats.excluded.byes, 1);
  assert.equal(stats.excluded.unpublished, 1);
  assert.equal(stats.excluded.unknownSide, 1);
  assert.equal(stats.excluded.contradictory, 1);
  assert.equal(stats.excluded.unpaired, 1);
});

test('parliamentary rounds use Gov and Opp labels', () => {
  const stats = sideSplit([round([{ bye: false, ballots: [ballot('A', 1, 0), ballot('B', 2, 1)] }], { event: 'Parli Open' })]);
  assert.equal(stats.sideOneLabel, 'Gov');
  assert.equal(stats.sideTwoLabel, 'Opp');
  assert.equal(stats.sideTwoWins, 1);
});

test('British Parliamentary rounds are reported as unsupported rather than binary', () => {
  const stats = sideSplit([round([{ bye: false, ballots: [ballot('A', 1, 1), ballot('B', 2, 0)] }], { eventType: 'wudc' })]);
  assert.equal(stats.supported, false);
  assert.equal(stats.decisions, 0);
});

test('rounds from different events are never pooled into one side rate', () => {
  const a = app();
  a.context.fixture = {
    id: '1', name: 'T', events: [{ id: 'e1', name: 'Lincoln Douglas JV' }, { id: 'e2', name: 'Parli Open' }], resultSets: [],
    rounds: [
      round([{ bye: false, ballots: [ballot('A', 1, 1), ballot('B', 2, 0)] }]),
      round([{ bye: false, ballots: [ballot('C', 1, 0), ballot('D', 2, 1)] }], { id: '2', eventId: 'e2', event: 'Parli Open' }),
    ],
  };
  vm.runInContext('tournament = fixture; roundEvent = ""; roundFilter = ""; drawStatistics();', a.context);
  const html = a.node('#statistics-list').innerHTML;
  assert.match(html, /Lincoln Douglas JV[\s\S]*?Aff[\s\S]*?Parli Open[\s\S]*?Gov/);
});

test('statistics name published ballot votes and never claim official records', () => {
  const a = app();
  a.context.fixture = {
    id: '1', name: 'T', events: [{ id: 'e1', name: 'Lincoln Douglas JV' }], resultSets: [],
    rounds: [round([{ bye: false, ballots: [ballot('A', 1, 1), ballot('B', 2, 0)] }])],
  };
  vm.runInContext('tournament = fixture; roundEvent = ""; roundFilter = ""; drawStatistics();', a.context);
  const html = a.node('#statistics-list').innerHTML;
  assert.match(html, /published ballot votes/i);
  assert.match(html, /1 decision/);
  assert.doesNotMatch(html, /record|official result/i);
});

test('an event with no usable decisions explains the gap instead of showing 0%', () => {
  const a = app();
  a.context.fixture = {
    id: '1', name: 'T', events: [{ id: 'e1', name: 'Lincoln Douglas JV' }], resultSets: [],
    rounds: [round([{ bye: true, ballots: [] }])],
  };
  vm.runInContext('tournament = fixture; roundEvent = ""; roundFilter = ""; drawStatistics();', a.context);
  const html = a.node('#statistics-list').innerHTML;
  assert.doesNotMatch(html, /0%/);
  assert.match(html, /No published decisions/i);
});
