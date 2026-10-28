import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync('web/index.html','utf8');
const source = fs.readFileSync('web/app.js','utf8');
test('horizontal navigation keeps all existing destinations and theme selection', () => {
  assert.match(html, /class="site-header"/);
  assert.doesNotMatch(html, /class="sidebar"/);
  for (const name of ['discover','saved','circuits','results','judging','paradigms','account','help'])
    assert.equal((html.match(new RegExp('data-nav="'+name+'"','g')) || []).length, 1);
  assert.match(html, /<details class="more-nav">/);
  assert.match(html, /id="theme"/);
});
test('hero has a debate-specific visual and escaped copy without sample result claims', () => {
  const context = vm.createContext({ document:{querySelector:()=>null}, localStorage:{getItem:()=>null} });
  vm.runInContext(source.slice(0,source.indexOf('document\n  .querySelectorAll("[data-nav]")')),context);
  const rendered = vm.runInContext('hero("<Title>","<Text>")',context);
  assert.match(rendered,/debate-illustration/);
  assert.match(rendered,/&lt;Title&gt;/);
  assert.match(rendered,/&lt;Text&gt;/);
  assert.doesNotMatch(rendered,/art-card|WIN|LOSS/);
});
