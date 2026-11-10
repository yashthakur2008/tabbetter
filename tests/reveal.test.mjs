import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// DOM/observer doubles exercise browser boundaries without requiring a browser package.
function card(id, title = 'PF · Round 1', entries = ['A', 'B']) {
  const classes = new Set(), properties = new Map();
  return { isConnected: true, classes, properties,
    classList: { add: (value) => classes.add(value) },
    style: { setProperty: (key, value) => properties.set(key, value) },
    querySelector: (selector) => selector === '[data-open]' ? (id ? { dataset: { open: id } } : null) : { textContent: title },
    querySelectorAll: () => entries.map(textContent => ({ textContent })),
  };
}
function app({ reduced = false, missing = false, broken = false } = {}) {
  let callback;
  const observed = new Set(), media = { matches: reduced };
  const context = vm.createContext({ document: { querySelector: () => null }, localStorage: { getItem: () => null }, window: {
    matchMedia: () => media,
    IntersectionObserver: missing ? undefined : class {
      constructor(fn) { if (broken) throw Error('unavailable'); callback = fn; }
      observe(node) { observed.add(node); }
      unobserve(node) { observed.delete(node); }
    },
  } });
  const source = fs.readFileSync('web/app.js', 'utf8');
  vm.runInContext(source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")')), context);
  return { media, observed,
    reveal(nodes, namespace = 'tournament') {
      context.root = { querySelectorAll: () => nodes }; context.namespace = namespace;
      assert.equal(vm.runInContext('typeof revealCards', context), 'function', 'reveal helper exists');
      vm.runInContext('revealCards(root, ".card", namespace)', context);
    },
    enter(nodes, isIntersecting = true) { callback(nodes.map(target => ({ target, isIntersecting }))); },
  };
}
test('cards stay visible before observation and reveal only on viewport entry with bounded stagger', () => {
  const a = app(), nodes = Array.from({ length: 10 }, (_, i) => card(String(i + 1)));
  a.reveal(nodes);
  for (const node of nodes) assert.equal(node.classes.size, 0);
  a.enter(nodes, false);
  assert.equal(nodes[0].classes.size, 0);
  a.enter(nodes);
  for (const node of nodes) assert.ok(node.classes.has('card-reveal'));
  assert.equal(nodes[0].properties.get('--reveal-delay'), '0ms');
  assert.ok(parseInt(nodes[1].properties.get('--reveal-delay')) > 0);
  assert.ok(parseInt(nodes[9].properties.get('--reveal-delay')) <= 160);
  assert.equal(a.observed.size, 0);
});
test('replacement cards do not replay after routine refresh but unseen cards still reveal', () => {
  const a = app(); a.reveal([card('1')]); a.enter([...a.observed]);
  const replacement = card('1'), fresh = card('2'); a.reveal([replacement, fresh]);
  a.enter([replacement, fresh]);
  assert.equal(replacement.classes.size, 0); assert.ok(fresh.classes.has('card-reveal'));
});
test('result identities ignore changed decisions and remain scoped to tournament', () => {
  const a = app(), first = card(null); a.reveal([first], 'results:1'); a.enter([first]);
  const refreshed = card(null); a.reveal([refreshed], 'results:1');
  assert.equal(a.observed.size, 0);
  a.reveal([refreshed], 'results:2'); a.enter([refreshed]);
  assert.ok(refreshed.classes.has('card-reveal'));
});
test('missing or broken observers and reduced motion fail open', () => {
  for (const options of [{ missing: true }, { broken: true }, { reduced: true }]) {
    const a = app(options), node = card('1');
    assert.doesNotThrow(() => a.reveal([node]));
    assert.equal(node.classes.size, 0);
  }
});
test('enabling reduced motion while pending suppresses animation and subsequent replay', () => {
  const a = app(), node = card('1'); a.reveal([node]); a.media.matches = true; a.enter([node]);
  assert.equal(node.classes.size, 0); a.media.matches = false;
  a.reveal([card('1')]); assert.equal(a.observed.size, 0);
});
test('refresh releases detached cards without treating unseen replacements as already revealed', () => {
  const a = app(), old = card('1'); a.reveal([old]); old.isConnected = false;
  const next = card('1'); a.reveal([next]);
  assert.equal(a.observed.has(old), false); a.enter([next]);
  assert.ok(next.classes.has('card-reveal'));
});
