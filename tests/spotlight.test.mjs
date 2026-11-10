import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const css = fs.readFileSync('web/styles.css', 'utf8');
const source = fs.readFileSync('web/app.js', 'utf8');

// The spotlight is the one piece of the redesign that needs script support, so
// it is exercised through a DOM double rather than trusted by inspection.
function spotlight({ reduced = false } = {}) {
  let move;
  const listeners = new Map();
  const frames = [];
  const context = vm.createContext({
    document: {
      querySelector: () => null,
      addEventListener: (type, fn) => listeners.set(type, fn),
    },
    window: { matchMedia: () => ({ matches: reduced }) },
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
  });
  const start = source.indexOf('(function tileSpotlight()');
  vm.runInContext(source.slice(start), context);
  move = listeners.get('pointermove');
  return { move, frames, listeners };
}

function tile(rect = { left: 100, top: 50, width: 200, height: 100 }) {
  const properties = new Map();
  const node = {
    style: { setProperty: (k, v) => properties.set(k, v), getPropertyValue: (k) => properties.get(k) },
    getBoundingClientRect: () => rect,
    properties,
  };
  node.closest = (selector) => (selector === '.tile' ? node : null);
  return node;
}

test('pointer position becomes percentage custom properties on the tile', () => {
  const { move, frames } = spotlight();
  const node = tile();
  move({ target: node, clientX: 150, clientY: 75 });
  frames.forEach((fn) => fn());
  assert.equal(node.properties.get('--mx'), '25%');
  assert.equal(node.properties.get('--my'), '25%');
});

test('moves are coalesced into a single frame callback', () => {
  const { move, frames } = spotlight();
  const node = tile();
  move({ target: node, clientX: 120, clientY: 60 });
  move({ target: node, clientX: 300, clientY: 150 });
  move({ target: node, clientX: 200, clientY: 100 });
  // Many pointer events, one scheduled write.
  assert.equal(frames.length, 1);
  frames.forEach((fn) => fn());
  assert.equal(node.properties.get('--mx'), '50%');
});

test('pointer events away from a tile are ignored', () => {
  const { move, frames } = spotlight();
  const outside = { closest: () => null };
  move({ target: outside, clientX: 10, clientY: 10 });
  assert.equal(frames.length, 0);
});

test('a zero-sized tile never produces a division by zero', () => {
  const { move, frames } = spotlight();
  const node = tile({ left: 0, top: 0, width: 0, height: 0 });
  move({ target: node, clientX: 5, clientY: 5 });
  frames.forEach((fn) => fn());
  assert.equal(node.properties.get('--mx'), undefined);
});

test('reduced motion disables the listener entirely', () => {
  const { listeners } = spotlight({ reduced: true });
  assert.equal(listeners.has('pointermove'), false);
});

test('the spotlight gradient has a static fallback when script never runs', () => {
  const block = css.slice(css.indexOf('.tile::before'));
  // Defaults inside var() keep the sheen sensible before any pointer move.
  assert.match(block, /var\(--mx,\s*\d+%\)/);
  assert.match(block, /var\(--my,\s*\d+%\)/);
});

test('every themed palette defines the depth tints the elevation scale uses', () => {
  for (const selector of [':root {', ':root[data-theme="dark"] {', ':root[data-theme="midnight"] {']) {
    const block = css.slice(css.indexOf(selector)).split('}')[0];
    for (const token of ['--shade-1', '--shade-2', '--shade-3', '--sheen'])
      assert.ok(block.includes(token), `${selector} missing ${token}`);
  }
});

test('motion-sensitive users lose transforms and the loading scan', () => {
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /transform:\s*none/);
  assert.match(reduced, /\.loading::after\s*\{\s*animation:\s*none/);
});

test('the sticky header paints above page content', () => {
  // The header was briefly sticky but stacked *under* the scrolling table,
  // so rows slid over it. Position alone is not enough; it needs a z-index
  // above the `main` stacking context that the ambient wash introduced.
  const header = [...css.matchAll(/\.site-header\s*\{([^}]*)\}/g)]
    .map(([, body]) => body)
    .find((body) => body.includes('position: sticky'));
  assert.ok(header, 'no sticky .site-header rule found');
  const headerLayer = Number((header.match(/z-index:\s*(\d+)/) || [])[1]);
  assert.ok(headerLayer > 0, 'sticky header needs an explicit z-index');

  const mainRule = [...css.matchAll(/(^|\n)\s*main\s*\{([^}]*)\}/g)]
    .map(([, , body]) => body)
    .find((body) => body.includes('z-index'));
  const mainLayer = Number(((mainRule || '').match(/z-index:\s*(\d+)/) || [])[1] || 0);
  assert.ok(headerLayer > mainLayer, `header z-index ${headerLayer} must beat main ${mainLayer}`);
});

test('the header stays opaque enough to hide content scrolling under it', () => {
  // Match the rule that actually paints the bar, not a later media-query tweak.
  const block = [...css.matchAll(/\.site-header\s*\{([^}]*)\}/g)]
    .map(([, body]) => body)
    .find((body) => body.includes('color-mix'));
  assert.ok(block, 'no .site-header rule sets a canvas-based background');
  const mix = block.match(/var\(--canvas\)\s*(\d+)%/);
  assert.ok(mix, 'header background should mix the canvas colour');
  assert.ok(Number(mix[1]) >= 90, `header too transparent: ${mix[1]}%`);
});
