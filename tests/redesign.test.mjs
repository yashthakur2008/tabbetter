import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync('web/index.html','utf8');
const source = fs.readFileSync('web/app.js','utf8');
test('workspace navigation keeps existing destinations and centralizes settings', () => {
  assert.match(html, /class="site-header"/);
  assert.match(html, /id="workspace-navigation"/);
  for (const name of ['discover','saved','circuits','results','judging','paradigms','account','help','settings'])
    assert.equal((html.match(new RegExp('data-nav="'+name+'"','g')) || []).length, 1);
  assert.doesNotMatch(html, /<details class="more-nav">/);
  assert.doesNotMatch(html, /id="theme"/);
  assert.match(fs.readFileSync("web/workspace.js", "utf8"), /id="theme"/);
});
test('hero is text-only with escaped copy and no sample result claims', () => {
  const context = vm.createContext({ document:{querySelector:()=>null}, localStorage:{getItem:()=>null} });
  vm.runInContext(source.slice(0,source.indexOf('document\n  .querySelectorAll("[data-nav]")')),context);
  const rendered = vm.runInContext('hero("<Title>","<Text>")',context);
  // The stock illustration was removed: it carried no information and pushed
  // the real content below the fold.
  assert.doesNotMatch(rendered,/debate-illustration|debate-person|podium/);
  assert.match(rendered,/page-hero/);
  assert.match(rendered,/&lt;Title&gt;/);
  assert.match(rendered,/&lt;Text&gt;/);
  assert.doesNotMatch(rendered,/art-card|WIN|LOSS/);
});
