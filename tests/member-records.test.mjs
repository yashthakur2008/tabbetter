import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/app.js', 'utf8');
function app(hash = '#tournament/1/member/entry:A') {
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) nodes.set(key, { value: '', innerHTML: '', dataset: {}, addEventListener(type, fn) { this[type] = fn; } });
    return nodes.get(key);
  };
  const context = vm.createContext({
    URL,
    document: { documentElement: { dataset: {} }, querySelector: node, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} },
    location: { hash },
  });
  vm.runInContext(source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")')), context);
  return { context, node };
}
const ballot = (entryId, side, value, judge = 'Judge A', judgeId = 'j1') => ({
  entryId,
  entry: entryId,
  judge,
  judgeId,
  judgePersonId: '',
  side: String(side),
  speakerorder: '',
  scores: value === null ? [] : [{ tag: 'winloss', value: String(value) }],
});
const fixture = () => ({
  id: '1',
  name: 'T',
  timezone: 'UTC',
  events: [{ id: 'e1', name: 'Lincoln Douglas JV' }],
  entries: [
    { id: 'A', name: 'Alex Kim', code: 'Gunn AK', school: 'Gunn', eventId: 'e1', event: 'Lincoln Douglas JV' },
    { id: 'B', name: 'Bo Lee', code: 'Lynbrook BL', school: 'Lynbrook', eventId: 'e1', event: 'Lincoln Douglas JV' },
  ],
  judges: [{ id: 'j1', name: 'Judge A', school: 'Gunn', category: 'LD Judges' }],
  schools: [],
  resultSets: [],
  rounds: [
    { id: 'r1', name: '1', eventId: 'e1', event: 'Lincoln Douglas JV', eventType: 'debate', start: '', sections: [
      { id: 's1', room: '101', flight: '', bye: false, ballots: [ballot('A', 1, 1), ballot('B', 2, 0)] },
    ] },
    { id: 'r2', name: '2', eventId: 'e1', event: 'Lincoln Douglas JV', eventType: 'debate', start: '', sections: [
      { id: 's2', room: '102', flight: '', bye: false, ballots: [ballot('A', 2, 0, 'Judge B', 'j2'), ballot('B', 1, 1, 'Judge B', 'j2')] },
    ] },
  ],
});
function renderMember(hash, mutate = (f) => f) {
  const a = app(hash);
  a.context.fx = mutate(fixture());
  vm.runInContext('tournament = fx; invitation = null; renderDetail();', a.context);
  return a.node('#detail-content').innerHTML;
}

test('an entry record lists every published round in one organized table', () => {
  const html = renderMember('#tournament/1/member/entry:A');
  assert.match(html, /Alex Kim/);
  assert.match(html, /Gunn/);
  assert.match(html, /<table/);
  const rows = html.match(/<tr>/g) || [];
  assert.ok(rows.length >= 3, 'expected a header row and one row per round');
  assert.match(html, /101/);
  assert.match(html, /102/);
});

test('each entry round row shows its own side, opponent, judge and vote', () => {
  const html = renderMember('#tournament/1/member/entry:A');
  assert.match(html, /Aff[\s\S]*?Lynbrook BL[\s\S]*?Judge A[\s\S]*?WIN/);
  assert.match(html, /Neg[\s\S]*?Lynbrook BL[\s\S]*?Judge B[\s\S]*?LOSS/);
});

test('an entry record totals published votes without claiming an official record', () => {
  const html = renderMember('#tournament/1/member/entry:A');
  assert.match(html, /1 win · 1 loss/);
  assert.match(html, /published ballot votes/i);
  assert.doesNotMatch(html, /official record|1-1 record/i);
});

test('a judge record lists the rounds that judge decided', () => {
  const html = renderMember('#tournament/1/member/judge:registration:j1');
  assert.match(html, /Judge A/);
  assert.match(html, /Gunn AK/);
  assert.match(html, /Lynbrook BL/);
  assert.match(html, /101/);
  assert.doesNotMatch(html, /102/);
});

test('entry names in the entries list link to that member record', () => {
  const a = app('#tournament/1/entries');
  a.context.fx = fixture();
  vm.runInContext('tournament = fx; invitation = null; renderDetail();', a.context);
  const html = a.node('#people-list').innerHTML;
  assert.match(html, /href="#tournament\/1\/member\/entry:A"/);
  assert.match(html, /href="#tournament\/1\/member\/entry:B"/);
});

test('judge names in the judges list link to that judge record', () => {
  const a = app('#tournament/1/judges');
  a.context.fx = fixture();
  vm.runInContext('tournament = fx; invitation = null; renderDetail();', a.context);
  const html = a.node('#people-list').innerHTML;
  assert.match(html, /href="#tournament\/1\/member\/judge:/);
});

test('unpublished decisions stay neutral in a record rather than counting as losses', () => {
  const html = renderMember('#tournament/1/member/entry:A', (f) => {
    f.rounds[1].sections[0].ballots = [ballot('A', 2, null, 'Judge B', 'j2'), ballot('B', 1, null, 'Judge B', 'j2')];
    return f;
  });
  assert.match(html, /1 win · 0 loss/);
  assert.match(html, /Not published/);
});

test('a panel shows each judge vote separately inside the entry record', () => {
  const html = renderMember('#tournament/1/member/entry:A', (f) => {
    f.rounds[0].sections[0].ballots = [
      ballot('A', 1, 1, 'J1', 'j1'), ballot('B', 2, 0, 'J1', 'j1'),
      ballot('A', 1, 0, 'J2', 'j2'), ballot('B', 2, 1, 'J2', 'j2'),
    ];
    return f;
  });
  assert.match(html, /J1/);
  assert.match(html, /J2/);
  assert.match(html, /1 win · 2 loss/);
});

test('an unknown member id explains itself instead of rendering an empty table', () => {
  const html = renderMember('#tournament/1/member/entry:ZZZ');
  assert.match(html, /not published|not found/i);
  assert.doesNotMatch(html, /<table/);
});

test('member identities are escaped rather than injected into the record markup', () => {
  const html = renderMember('#tournament/1/member/entry:A', (f) => {
    f.entries[0].name = '<img src=x onerror=alert(1)>';
    f.entries[0].school = '"><script>evil()</script>';
    return f;
  });
  assert.doesNotMatch(html, /<img src=x|<script>evil/);
  assert.match(html, /&lt;img src=x/);
});

test('malformed member routes fail safely', () => {
  assert.match(renderMember('#tournament/1/member/%ZZ'), /not found/i);
});
test('names do not merge judges with different registrations', () => {
  const a = app(); a.context.fx = fixture();
  a.context.fx.judges.push({ id: 'other', name: 'Judge A', school: 'Elsewhere' });
  vm.runInContext('tournament = fx', a.context);
  assert.equal(vm.runInContext('judgeRecordKey(fx.judges[1])', a.context), 'registration:other');
});
test('unpublished participants retain their identity in the empty state', () => {
  const html = renderMember('#tournament/1/member/entry:A', f => { f.rounds = []; return f; });
  assert.match(html, /Alex Kim/);
  assert.match(html, /No published ballots/);
});
test('byes do not become judged wins', () => {
  const html = renderMember('#tournament/1/member/entry:A', f => {
    f.rounds[0].sections[0].bye = true; return f;
  });
  assert.match(html, /0 win · 1 loss/);
  assert.match(html, /Bye/);
});
test('conflicting duplicate ballots do not silently choose the first result', () => {
  const html = renderMember('#tournament/1/member/entry:A', f => {
    f.rounds[0].sections[0].ballots.push(ballot('A', 1, 0)); return f;
  });
  assert.match(html, /0 win · 1 loss/);
  assert.match(html, /Not published/);
});
test('member URL segments encode delimiters and missing identities stay plain', () => {
  const a = app(); a.context.fx = fixture();
  vm.runInContext('tournament = fx', a.context);
  const html = vm.runInContext('memberLink("entry:A/B%", "Name")', a.context);
  assert.match(html, /entry:A%2FB%25/);
  assert.doesNotMatch(vm.runInContext('memberLink("entry:", "Anonymous")', a.context), /href/);
});
test('record tables are separated and captioned by event within the tournament', () => {
  const html = renderMember('#tournament/1/member/judge:registration:j1', f => {
    f.rounds[1].eventId = 'e2'; f.rounds[1].event = 'Parli Open';
    f.rounds[1].sections[0].ballots.forEach(b => { b.judgeId = 'j1'; b.judge = 'Judge A'; });
    return f;
  });
  assert.equal((html.match(/<caption>/g) || []).length, 2);
  assert.match(html, /Parli Open/);
  assert.match(html, /This tournament only/);
});

test('published round cards link both entries and judges to scoped records', () => {
  const a = app(); a.context.fx = fixture();
  vm.runInContext('tournament = fx; drawRounds("pairings")', a.context);
  const html = a.node('#round-list').innerHTML;
  assert.match(html, /href="#tournament\/1\/member\/entry:A"/);
  assert.match(html, /href="#tournament\/1\/member\/judge:registration:j1"/);
});
test('same entry ids in another tournament cannot retain the first tournament record', () => {
  const a = app(); a.context.fx = fixture();
  vm.runInContext('tournament = fx; renderMemberRecord("entry", "A")', a.context);
  const other = fixture(); other.id = '2'; other.name = 'Other Tournament'; other.rounds = [];
  a.context.other = other;
  const html = vm.runInContext('tournament = other; renderMemberRecord("entry", "A")', a.context);
  assert.match(html, /Other Tournament/);
  assert.match(html, /#tournament\/2\/entries/);
  assert.doesNotMatch(html, /101|102|#tournament\/1\//);
});
test('judge biography is matched by registration, never by a shared name', () => {
  const html = renderMember('#tournament/1/member/judge:registration:j1', f => {
    f.judges.unshift({ id: 'other', name: 'Judge A', school: 'Wrong school' }); return f;
  });
  assert.doesNotMatch(html, /Wrong school/);
  assert.match(html, /Gunn/);
});
test('record styles provide identifiable links, focus and scrollable tables', () => {
  const css = fs.readFileSync('web/styles.css', 'utf8');
  assert.match(css, /\.member-link, \.member-back\s*\{[^}]*text-decoration: underline/s);
  assert.match(css, /\.record-table:focus-visible\s*\{[^}]*outline:/s);
  assert.match(css, /\.record-table\s*\{[^}]*overflow-x: auto/s);
});
