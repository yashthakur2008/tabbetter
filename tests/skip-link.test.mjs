import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('skip link focuses the workspace without changing the tournament route', () => {
  const source = fs.readFileSync('web/app.js', 'utf8');
  const start = source.indexOf('$(".skip-link").addEventListener');
  assert.notEqual(start, -1, 'skip link must prevent native hash navigation');
  const setup = source.slice(start, source.indexOf('$("#jump-cancel")', start));
  let click, focused = false, prevented = false;
  const location = { hash: '#tournament/123/results' };
  const nodes = {
    '.skip-link': { addEventListener(type, handler) { assert.equal(type, 'click'); click = handler; } },
    '#app': { focus() { focused = true; } },
  };
  vm.runInNewContext(setup, { $: selector => nodes[selector], location });
  click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(focused, true);
  assert.equal(location.hash, '#tournament/123/results');
  assert.match(fs.readFileSync('web/index.html', 'utf8'), /id="app"[^>]*tabindex="-1"/);
});
