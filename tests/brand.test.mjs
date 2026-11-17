import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const css = fs.readFileSync('web/styles.css', 'utf8');

test('the brand mark loads the canonical scalable SVG, not a text glyph in a box', () => {
  const brand = html.slice(html.indexOf('class="brand"'), html.indexOf('</a>', html.indexOf('class="brand"')));
  assert.match(brand, /<img[^>]*src="\/assets\/mark-v2.svg"/);
  assert.match(fs.readFileSync('assets/mark-v2.svg','utf8'), /viewBox="0 0 32 32"/);
  assert.doesNotMatch(brand, /›/);
  assert.match(brand, /alt=""/, 'the repeated decorative mark has no redundant accessible name');
  assert.match(brand, /aria-label="TabBetter home"/);
});

test('the mark keeps contrasting white details on teal and has a currentColor monochrome fallback', () => {
  const svg=fs.readFileSync('assets/mark-v2.svg','utf8');
  const luminance=hex=>hex.match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const background=svg.match(/fill="#([0-9a-f]{6})"/)[1];
  assert.ok(1.05/(luminance(background)+.05)>=4.5);
  assert.match(svg,/fill="#fff"/);
  assert.match(fs.readFileSync('assets/mark-mono-v2.svg','utf8'), /fill="currentColor"/);
});

test('the harsh offset shadow is gone from the mark', () => {
  const markRule = css.slice(css.indexOf('.mark {'), css.indexOf('}', css.indexOf('.mark {')));
  assert.doesNotMatch(markRule, /box-shadow:\s*-?\d+px\s+-?\d+px\s+0/, 'no hard offset shadow');
});
