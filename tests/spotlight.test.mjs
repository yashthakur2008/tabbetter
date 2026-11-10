import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// These replace the old Signal/spotlight requirements. The approved discovery
// design deliberately removes ambient effects rather than hiding them in light.
const css = fs.readFileSync('web/styles.css', 'utf8');
const discovery = fs.readFileSync('web/discovery.css', 'utf8');
const source = fs.readFileSync('web/app.js', 'utf8');
const ui = fs.readFileSync('web/discovery.js', 'utf8');

test('the ambient glow and pointer spotlight are removed at source', () => {
  assert.doesNotMatch(source, /tileSpotlight|pointermove|--mx|--my/);
  assert.doesNotMatch(css, /body::before|\.tile::before|--glow:|--hairline:|Signal: a darker/);
  assert.doesNotMatch(discovery, /gradient\(|backdrop-filter|border-(?:top|bottom):/);
});

test('the shared header uses an opaque canvas and a filled current navigation state', () => {
  const header = [...css.matchAll(/\.site-header\s*\{([^}]*)\}/g)].map(([,body])=>body);
  assert.ok(header.some(body => /background:\s*var\(--canvas\)/.test(body)));
  assert.ok(header.every(body => !/backdrop-filter|color-mix|border-bottom/.test(body)));
  assert.match(css, /\.primary-nav > button\.active\s*\{[^}]*background:\s*var\(--accent-bg\)/);
  assert.match(source, /setAttribute\("aria-current", "page"\)/);
});

test('discovery rows own generous borderless composition without reviving old tile styles', () => {
  assert.match(discovery, /\.discovery-row\s*\{[^}]*padding:\s*24px/);
  assert.match(discovery, /\.discovery-row\s*\{[^}]*minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /\.tile(?:\s|:|\{)|\.hero-directory|\.directory-shortcuts/);
  assert.doesNotMatch(discovery, /overflow-x:\s*hidden/);
});

test('reduced motion disables discovery movement without hiding content', () => {
  const reduced = discovery.slice(discovery.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /animation:\s*none/);
  assert.match(reduced, /transition:\s*none/);
  assert.doesNotMatch(reduced, /opacity:\s*0(?:;|\s)|visibility:\s*hidden/);
  assert.match(ui, /removeEventListener\('change',discoveryCancelMotion\)/);
  assert.match(ui, /animation\?\.cancel\(\)/);
});

test('discovery motion stays short and purposeful with overlay-only elevation', () => {
  const durations = [...discovery.matchAll(/(?:animation|transition):[^;]*?(\d+)ms/g)].map(m=>Number(m[1]));
  assert.ok(durations.length >= 3);
  assert.ok(durations.every(n=>n>=140 && n<=240));
  const row = discovery.match(/\.discovery-row\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(row, /box-shadow|border:/);
  assert.match(discovery, /:focus-visible\s*\{[^}]*2px solid var\(--accent\)/);
});
