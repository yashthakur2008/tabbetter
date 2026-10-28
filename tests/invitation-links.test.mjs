import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseInvitation } from '../src/data.mjs';

const source = fs.readFileSync('web/app.js', 'utf8');
function render(invitation) {
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) nodes.set(key, { innerHTML: '' });
    return nodes.get(key);
  };
  const context = vm.createContext({
    URL,
    document: { querySelector: node, querySelectorAll: () => [] },
    localStorage: { getItem: () => null },
    location: { hash: '#tournament/41209/overview' },
    fixture: invitation,
  });
  vm.runInContext(source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")')), context);
  vm.runInContext('invitation = fixture; renderDetail();', context);
  return node('#detail-content').innerHTML;
}
const parse = (body) => parseInvitation('<h2>CFL41209 Milpitas</h2>' + body, '41209');

test('CFL41209 published key links render their exact source destinations', () => {
  // Public invitation excerpt checked against Tabroom on 2026-10-26.
  const targets = [
    ['Milpitas Campus Map', 'https://drive.google.com/file/d/14zbkFOGoToByYiuWMihsH46A_LyIlwxa/view?usp=sharing'],
    ['Judge Info Sheet', 'https://docs.google.com/document/d/16AFGAHM9QwWZR-UZi6g7NRH9BI78XYHj60OkJ41D6zs/edit?usp=sharing'],
    ['Parli Topic Doc', 'https://docs.google.com/document/d/1406cBBBt3o4iuSJT5RnQMQdUw98p484gX8xGqAmpvsc/edit?tab=t.0'],
  ];
  const html = render(parse(targets.map(([label, url]) => `<p><a href="${url}">${label}</a></p>`).join('')));
  for (const [label, url] of targets)
    assert.ok(html.includes(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`));
});

test('source labels remain clickable in their original invitation paragraphs', () => {
  const inv = parse('<p>Before <a href="/map">Campus Map</a>, then <a href="https://example.org/judges?a=1&amp;b=2">Judge Info Sheet</a> and <a href="http://example.org/topics">Parli Topic Doc</a>.</p>');
  assert.deepEqual(inv.paragraphs, ['Before Campus Map, then Judge Info Sheet and Parli Topic Doc.']);
  assert.ok(Array.isArray(inv.paragraphSegments));
  const html = render(inv);
  assert.match(html, /Before <a[^>]*href="https:\/\/www\.tabroom\.com\/map"[^>]*>Campus Map<\/a>, then /);
  assert.match(html, /href="https:\/\/example.org\/judges\?a=1&amp;b=2"[^>]*>Judge Info Sheet<\/a>/);
  assert.match(html, / and <a[^>]*href="http:\/\/example.org\/topics"[^>]*>Parli Topic Doc<\/a>\./);
  assert.match(html, /rel="noopener(?: noreferrer)?"/);
});

test('inline formatting preserves adjacency while line breaks and whitespace remain readable', () => {
  const inv = parse('<p>  Read <a href=/map><b>Campus</b> Map</a>,<br>then <em>Judge</em> Info &amp; topics.  </p><p>Next</p>');
  assert.deepEqual(inv.paragraphs, ['Read Campus Map, then Judge Info & topics.', 'Next']);
  assert.match(render(inv), /Campus Map<\/a>, then Judge Info &amp; topics\./);
});

test('script style and comment content never creates paragraphs or links', () => {
  const inv = parse('<script><p><a href="https://evil.test">script fake</a></p></script><style><p>style fake</p></style><!-- <p>comment fake</p> --><p>Safe <a href="/safe" title="greater > than">link</a><script>hidden()</script></p>');
  assert.deepEqual(inv.paragraphs, ['Safe link']);
  assert.deepEqual(inv.links, [{ label: 'link', url: 'https://www.tabroom.com/safe' }]);
  assert.doesNotMatch(render(inv), /script fake|style fake|comment fake|hidden|evil\.test/);
});

test('source text and link attributes are decoded once and escaped rather than interpreted', () => {
  const inv = parse('<p>&lt;img src=x onerror=alert(1)&gt; &amp;lt;b&amp;gt; <a href="https://example.org/?q=&amp;quot;&amp;x=1" onclick="evil()">&lt;Map&gt; &amp;lt;safe&amp;gt;</a></p>');
  assert.equal(inv.paragraphs[0], '<img src=x onerror=alert(1)> &lt;b&gt; <Map> &lt;safe&gt;');
  const html = render(inv);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp;lt;b&amp;gt;/);
  assert.match(html, />&lt;Map&gt; &amp;lt;safe&amp;gt;<\/a>/);
  assert.match(html, /q=&amp;quot;&amp;x=1/);
  assert.doesNotMatch(html, /<img|onclick=|<script/);
});

test('unsafe and encoded unsafe protocols keep labels but never become anchors', () => {
  for (const url of ['javascript:alert(1)', 'jav&#x61;script:alert(1)', 'data:text/html,evil', 'vbscript:evil', 'java&#10;script:evil']) {
    const inv = parse(`<p>Read <a href="${url}">bad</a> now.</p>`);
    assert.deepEqual(inv.paragraphs, ['Read bad now.']);
    assert.doesNotMatch(render(inv), /<a\b/);
    assert.deepEqual(inv.links, []);
  }
});

test('renderer independently rejects unsafe segment URLs and escapes segment text', () => {
  const html = render({ name: 'Test', paragraphs: ['fallback'], paragraphSegments: [[{ text: '<bad>', url: 'javascript:evil()' }, { text: '&lt;b&gt;', url: 'https://example.org/" onclick="evil' }]] });
  assert.doesNotMatch(html, /href="javascript:|<bad>|" onclick="/);
  assert.match(html, /&lt;bad&gt;/);
  assert.match(html, /&amp;lt;b&amp;gt;/);
});

test('older invitation payloads retain escaped plain paragraph rendering', () => {
  const html = render({ name: 'Old', paragraphs: ['Read <Campus Map> & notes.'] });
  assert.match(html, /<p>Read &lt;Campus Map&gt; &amp; notes\.<\/p>/);
});

test('href parsing ignores decoy attributes and handles quoted greater-than signs', () => {
  const inv = parse(`<P><A title='href="https://decoy.test" >' data-href="https://decoy.test" HREF='/real?a=1&#38;b=2'>Real</A> <a href="" data-href="/fake">Empty</a> <a data-href="/fake">Absent</a></P>`);
  assert.deepEqual(inv.links, [{ label: 'Real', url: 'https://www.tabroom.com/real?a=1&b=2' }]);
  assert.equal((render(inv).match(/<a\b/g) || []).length, 1);
});

test('adjacent links and inline spans neither lose nor invent whitespace', () => {
  const inv = parse('<p><a href="/a">A </a> <a href="/b"> B</a><span>,9:</span><span>3</span><span>5</span> <a href="/c">C</a>D.</p>');
  assert.deepEqual(inv.paragraphs, ['A B,9:35 CD.']);
  assert.equal(inv.paragraphSegments[0].map(s => s.text).join(''), inv.paragraphs[0]);
  assert.match(render(inv), />C<\/a>D\./);
});

test('malformed or unclosed raw content cannot supply fake links', () => {
  for (const raw of ['<script>', '<style>', '<!--']) {
    const inv = parse('<p>Visible</p>' + raw + '<p><a href="https://evil.test">hidden</a></p>');
    assert.deepEqual(inv.paragraphs, ['Visible']);
    assert.deepEqual(inv.links, []);
  }
});

test('invitation links are visually identifiable rather than looking like plain text', () => {
  const html = render(parse('<p>Read <a href="https://example.org/map">Campus Map</a>.</p>'));
  assert.match(html, /<a href="https:\/\/example.org\/map"[^>]*>Campus Map<\/a>/);
  const css = fs.readFileSync('web/styles.css', 'utf8');
  const rule = css.slice(css.indexOf('.prose a {'), css.indexOf('}', css.indexOf('.prose a {')));
  assert.ok(rule, 'expected a .prose a rule styling invitation links');
  assert.match(rule, /color: var\(--accent\)/);
  assert.match(rule, /text-decoration: underline/);
  const after = css.slice(css.indexOf('.prose a::after {'), css.indexOf('}', css.indexOf('.prose a::after {')));
  assert.match(after, /content: "(\u2197|\\2197)"/);
});
