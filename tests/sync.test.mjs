import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/app.js', 'utf8');
const head = source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")'));

function sandbox() {
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) nodes.set(key, { value: '', innerHTML: '', textContent: '', dataset: {}, classList: { toggle() {}, add() {}, contains: () => false }, addEventListener(type, fn) { this[type] = fn; }, querySelector: () => null, querySelectorAll: () => [] });
    return nodes.get(key);
  };
  const document = {
    hidden: false,
    documentElement: { dataset: {} },
    title: '',
    querySelector: node,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const context = vm.createContext({
    document,
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, scrollTo() {}, location: { hash: '' } },
    location: { hash: '' },
    localStorage: { getItem: () => null, setItem() {} },
    setInterval: () => 0,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    console,
  });
  vm.runInContext(head, context);
  return { context, node, document };
}

// vm contexts return cross-realm objects, so results are serialised before assertion.
const run = (expression) => {
  const box = sandbox();
  const value = vm.runInContext('JSON.stringify((' + expression + ') ?? null)', box.context);
  return JSON.parse(value);
};

test('sync controller only refreshes when the interval has elapsed and the tab is visible', () => {
  const result = run(`(() => {
    let clock = 1000;
    const sync = createSyncController({ intervalMs: 300000, now: () => clock });
    const before = sync.due(false);
    clock += 299999;
    const justBefore = sync.due(false);
    clock += 1;
    const after = sync.due(false);
    const hidden = sync.due(true);
    return { before, justBefore, after, hidden };
  })()`);
  assert.equal(result.before, false, 'a freshly loaded tournament is already current');
  assert.equal(result.justBefore, false);
  assert.equal(result.after, true);
  assert.equal(result.hidden, false, 'hidden tabs must not poll the public export');
});

test('an in-flight refresh is never duplicated', () => {
  const result = run(`(() => {
    let clock = 0;
    const sync = createSyncController({ intervalMs: 1000, now: () => clock });
    clock = 5000;
    sync.begin();
    const duringRequest = sync.due(false);
    sync.succeed();
    const afterSuccess = sync.due(false);
    clock = 7000;
    return { duringRequest, afterSuccess, dueLater: sync.due(false) };
  })()`);
  assert.equal(result.duringRequest, false);
  assert.equal(result.afterSuccess, false);
  assert.equal(result.dueLater, true);
});

test('failures back off exponentially up to the normal interval and reset on success', () => {
  const delays = run(`(() => [0, 1, 2, 3, 9].map(f => backoffDelay(300000, f)))()`);
  assert.deepEqual(delays, [300000, 30000, 60000, 120000, 300000]);
  const state = run(`(() => {
    let clock = 0;
    const sync = createSyncController({ intervalMs: 300000, now: () => clock });
    sync.begin(); sync.fail(Error('offline'));
    const afterShortWait = (clock = 20000, sync.due(false));
    const afterBackoff = (clock = 31000, sync.due(false));
    sync.begin(); sync.succeed();
    return { afterShortWait, afterBackoff, failures: sync.state.failures, lastSuccess: sync.state.lastSuccess };
  })()`);
  assert.equal(state.afterShortWait, false, 'a failed refresh must not retry immediately');
  assert.equal(state.afterBackoff, true);
  assert.equal(state.failures, 0);
  assert.equal(typeof state.lastSuccess, 'number');
});

test('switching tournaments resets sync state so stale timestamps never leak', () => {
  const state = run(`(() => {
    let clock = 500;
    const sync = createSyncController({ intervalMs: 300000, now: () => clock });
    sync.begin(); sync.succeed();
    sync.reset();
    return { lastSuccess: sync.state.lastSuccess, inFlight: sync.state.inFlight, due: sync.due(false) };
  })()`);
  assert.equal(state.lastSuccess, null);
  assert.equal(state.inFlight, false);
  assert.equal(state.due, false);
});

const exportFixture = (room, judge) => ({
  rounds: [{ id: '4', name: 'Round 4', event: 'PF', sections: [{ room, ballots: [{ entryId: '7', entry: 'Harker AB', judge, side: 'Aff' }] }] }],
});

test('an unchanged export reports no pairing changes', () => {
  const changes = run(`(() => {
    const a = pairingFingerprint(${JSON.stringify(exportFixture('101', 'Judge A'))});
    const b = pairingFingerprint(${JSON.stringify(exportFixture('101', 'Judge A'))});
    return fingerprintChanges(a, b);
  })()`);
  assert.deepEqual(changes, { added: [], removed: [], updated: [] });
});

test('the first load never announces changes', () => {
  const changes = run(`(() => fingerprintChanges(null, pairingFingerprint(${JSON.stringify(exportFixture('101', 'Judge A'))})))()`);
  assert.deepEqual(changes, { added: [], removed: [], updated: [] });
  assert.equal(run(`changeSummary({ added: [], removed: [], updated: [] })`), '');
});

test('room and judge reassignments are reported as updates, not new pairings', () => {
  const changes = run(`(() => fingerprintChanges(
    pairingFingerprint(${JSON.stringify(exportFixture('101', 'Judge A'))}),
    pairingFingerprint(${JSON.stringify(exportFixture('204', 'Judge B'))})))()`);
  assert.deepEqual(changes.added, []);
  assert.deepEqual(changes.removed, []);
  assert.equal(changes.updated.length, 1);
  assert.match(changes.updated[0].label, /Round 4/);
});

test('added and removed pairings are counted separately and summarised in plain language', () => {
  const summary = run(`(() => {
    const before = pairingFingerprint({ rounds: [{ id: '1', name: 'Round 1', event: 'LD', sections: [{ room: 'A', ballots: [{ entryId: '1', entry: 'One' }] }] }] });
    const after = pairingFingerprint({ rounds: [{ id: '1', name: 'Round 1', event: 'LD', sections: [{ room: 'A', ballots: [{ entryId: '2', entry: 'Two' }] }] }] });
    const changes = fingerprintChanges(before, after);
    return { changes, text: changeSummary(changes) };
  })()`);
  assert.equal(summary.changes.added.length, 1);
  assert.equal(summary.changes.removed.length, 1);
  assert.match(summary.text, /1 new pairing/);
  assert.match(summary.text, /1 removed/);
  assert.doesNotMatch(summary.text, /win|loss|result/i);
});

test('pairing fingerprints ignore outcomes and scores so results never masquerade as pairing updates', () => {
  const changes = run(`(() => {
    const withScore = { rounds: [{ id: '4', name: 'Round 4', event: 'PF', sections: [{ room: '101', ballots: [{ entryId: '7', entry: 'Harker AB', judge: 'Judge A', side: 'Aff', scores: [{ tag: 'winloss', value: '1' }] }] }] }] };
    const withoutScore = { rounds: [{ id: '4', name: 'Round 4', event: 'PF', sections: [{ room: '101', ballots: [{ entryId: '7', entry: 'Harker AB', judge: 'Judge A', side: 'Aff', scores: [] }] }] }] };
    return fingerprintChanges(pairingFingerprint(withoutScore), pairingFingerprint(withScore));
  })()`);
  assert.deepEqual(changes, { added: [], removed: [], updated: [] });
});

test('malformed or empty exports fingerprint safely', () => {
  for (const value of ['null', 'undefined', '{}', '{ rounds: null }', '{ rounds: [{ sections: null }] }']) {
    const changes = run(`fingerprintChanges(pairingFingerprint(${value}), pairingFingerprint(${value}))`);
    assert.deepEqual(changes, { added: [], removed: [], updated: [] });
  }
});

test('sync status text reports checking, success and stale without inventing a timestamp', () => {
  const now = Date.UTC(2026, 9, 28, 3, 0, 0);
  const text = (state) => run(`syncStatusText(${JSON.stringify(state)}, ${now})`);
  assert.match(text({ inFlight: true, lastSuccess: null, failures: 0, stale: false }), /Checking/i);
  assert.match(text({ inFlight: false, lastSuccess: now - 30000, failures: 0, stale: false }), /Updated/i);
  const never = text({ inFlight: false, lastSuccess: null, failures: 0, stale: false });
  assert.match(never, /Waiting|Not yet/i);
  assert.doesNotMatch(never, /\d{1,2}:\d{2}/);
  const failed = text({ inFlight: false, lastSuccess: now - 600000, failures: 2, stale: true, error: 'Source unavailable' });
  assert.match(failed, /not refresh|stale|unavailable/i);
  assert.match(failed, /\d/);
});

test('status text escapes upstream error text', () => {
  const html = run(`syncStatusText({ inFlight: false, lastSuccess: null, failures: 1, stale: true, error: '<img src=x>' }, 0)`);
  assert.doesNotMatch(html, /<img/);
});

function detailBox(responses) {
  const box = sandbox();
  const calls = [];
  box.context.fetch = async (path) => {
    calls.push(path);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: true, json: async () => next };
  };
  box.context.location.hash = '#tournament/55/pairings';
  box.context.window.location = box.context.location;
  vm.runInContext('loadingCalls = 0; loading = () => { loadingCalls++; };', box.context);
  vm.runInContext('toasts = []; toast = (m) => toasts.push(m);', box.context);
  return { box, calls };
}
const tournamentPayload = (room, judge) => ({
  id: '55', name: 'Test Invitational', entries: [], judges: [], schools: [], events: [],
  resultSets: [], fetchedAt: '2026-10-28T03:00:00.000Z', sourceUrl: 'https://www.tabroom.com/',
  rounds: [{ id: '4', name: 'Round 4', event: 'PF', sections: [{ room, ballots: [{ entryId: '7', entry: 'Harker AB', judge, side: 'Aff' }] }] }],
});

test('a background refresh never blanks the view and reports only later pairing changes', async () => {
  const { box } = detailBox([
    tournamentPayload('101', 'Judge A'), { paragraphs: [] },
    tournamentPayload('204', 'Judge A'), { paragraphs: [] },
  ]);
  await vm.runInContext('loadTournament("55")', box.context);
  const initial = vm.runInContext('JSON.stringify({ loads: loadingCalls, toasts })', box.context);
  assert.deepEqual(JSON.parse(initial), { loads: 1, toasts: [] }, 'the first load must not announce changes');
  await vm.runInContext('loadTournament("55", { background: true })', box.context);
  const after = JSON.parse(vm.runInContext('JSON.stringify({ loads: loadingCalls, toasts })', box.context));
  assert.equal(after.loads, 1, 'a background refresh must not clear the page');
  assert.equal(after.toasts.length, 1);
  assert.match(after.toasts[0], /updated assignment/);
});

test('a failed background refresh keeps the last published data and reports it as stale', async () => {
  const { box } = detailBox([
    tournamentPayload('101', 'Judge A'), { paragraphs: [] },
    Error('Source unavailable'), Error('Source unavailable'),
  ]);
  await vm.runInContext('loadTournament("55")', box.context);
  const before = vm.runInContext('$("#app").innerHTML', box.context);
  await vm.runInContext('loadTournament("55", { background: true })', box.context);
  assert.equal(vm.runInContext('$("#app").innerHTML', box.context), before, 'the previous render must survive a failed refresh');
  assert.match(vm.runInContext('$("#sync-status").textContent', box.context), /Could not refresh/);
  assert.equal(vm.runInContext('sync.state.stale', box.context), true);
});

test('a response for a tournament the user already left is discarded', async () => {
  const { box } = detailBox([tournamentPayload('101', 'Judge A'), { paragraphs: [] }]);
  const pending = vm.runInContext('loadTournament("55")', box.context);
  vm.runInContext('lastId = "99"; routeToken++;', box.context);
  await pending;
  assert.equal(vm.runInContext('tournament === null', box.context), true);
});
