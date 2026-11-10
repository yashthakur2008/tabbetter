import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const css = fs.readFileSync('web/styles.css', 'utf8');

test('the brand mark is a scalable inline SVG, not a text glyph in a box', () => {
  const brand = html.slice(html.indexOf('class="brand"'), html.indexOf('</a>', html.indexOf('class="brand"')));
  assert.match(brand, /<svg/, 'the mark is drawn, not typed');
  assert.match(brand, /viewBox/, 'the mark scales with its container');
  assert.doesNotMatch(brand, /›/, 'the chevron glyph is gone');
  assert.match(brand, /aria-hidden="true"/, 'the decorative mark is hidden from assistive tech');
});

test('the brand mark uses theme tokens so it follows light and dark themes', () => {
  const brand = html.slice(html.indexOf('class="brand"'), html.indexOf('</a>', html.indexOf('class="brand"')));
  assert.match(brand, /currentColor|var\(--/, 'the mark inherits the theme rather than hardcoding a colour');
  assert.doesNotMatch(brand, /#[0-9a-f]{6}/i, 'no hardcoded hex colours in the mark');
});

test('the harsh offset shadow is gone from the mark', () => {
  const markRule = css.slice(css.indexOf('.mark {'), css.indexOf('}', css.indexOf('.mark {')));
  assert.doesNotMatch(markRule, /box-shadow:\s*-?\d+px\s+-?\d+px\s+0/, 'no hard offset shadow');
});
