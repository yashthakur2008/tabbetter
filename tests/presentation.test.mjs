import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/app.js', 'utf8');
function app(savedTheme = null, dark = false, blocked = false) {
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) nodes.set(key, { value: '', innerHTML: '', addEventListener(type, fn) { this[type] = fn; } });
    return nodes.get(key);
  };
  const media = { matches: dark, addEventListener(type, fn) { this[type] = fn; } };
  const store = new Map(savedTheme ? [['tabbetter-theme', savedTheme]] : []);
  const document = { documentElement: { dataset: {} }, querySelector: node };
  const context = vm.createContext({ document, window: { matchMedia: () => media }, localStorage: {
    getItem(key) { if (blocked) throw Error('blocked'); return store.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error('blocked'); store.set(key, value); },
  } });
  vm.runInContext(source.slice(0, source.indexOf('document\n  .querySelectorAll("[data-nav]")')), context);
  return { context, document, node, media, store };
}
const ballot = (entryId, value, judge = 'Judge A') => ({ entryId, entry: entryId, judge, side: '', scores: value === null ? [] : [{ tag: 'winloss', value }] });
function render(ballots, sub = 'results') {
  const a = app();
  a.context.fixture = { id: '1', resultSets: [], rounds: [{ id: '4', name: 'Round 4', event: 'PF', sections: [{ room: '101', ballots }] }] };
  vm.runInContext(`tournament = fixture; drawRounds(${JSON.stringify(sub)});`, a.context);
  return a.node('#round-list').innerHTML;
}
test('round 4 displays unambiguous LOSS and WIN instead of raw winloss', () => {
  const html = render([ballot('Yash/Paarth', '0'), ballot('Siddharth/Krishna', '1')]);
  assert.match(html, /Yash\/Paarth[\s\S]*?LOSS/);
  assert.match(html, /Siddharth\/Krishna[\s\S]*?WIN/);
  assert.doesNotMatch(html, /winloss:/);
});
test('all panel ballots survive grouping with published vote totals', () => {
  const html = render([ballot('Team', '1', 'Judge A'), ballot('Team', '0', 'Judge B'), ballot('Team', '1', 'Judge C')]);
  assert.match(html, /Published votes: 2 win · 1 loss/);
  for (const judge of ['Judge A', 'Judge B', 'Judge C']) assert.match(html, new RegExp(judge + '[\\s\\S]*?(WIN|LOSS)'));
});
test('missing and nonbinary decisions remain neutral and visible', () => {
  for (const value of [null, '', '2', 'null']) {
    const html = render([ballot('Team', value)]);
    assert.match(html, /Outcome not published/);
    assert.doesNotMatch(html, /class="badge outcome-(win|loss)"/);
  }
  assert.match(render([ballot('Team', '1'), ballot('Team', null, 'Judge B')]), /Panel outcome not confirmed/);
});
test('scores and escaped judge names are preserved, including third entries', () => {
  const b = ballot('Third', '0', '<Judge>');
  b.scores.push({ tag: 'point', value: '29' });
  const html = render([ballot('First', '1'), ballot('Second', '0'), b]);
  assert.match(html, /&lt;Judge&gt;/);
  assert.match(html, /point: 29/);
});
test('themes persist and system responds only while selected', () => {
  const a = app('midnight');
  vm.runInContext('initTheme()', a.context);
  assert.equal(a.document.documentElement.dataset.theme, 'midnight');
  const select = a.node('#theme');
  select.value = 'dark'; select.change();
  assert.equal(a.store.get('tabbetter-theme'), 'dark');
  a.media.matches = false; a.media.change();
  assert.equal(a.document.documentElement.dataset.theme, 'dark');
  select.value = 'system'; select.change();
  assert.equal(a.document.documentElement.dataset.theme, 'light');
  a.media.matches = true; a.media.change();
  assert.equal(a.document.documentElement.dataset.theme, 'dark');
});
test('invalid or unavailable storage falls back safely to system', () => {
  for (const blocked of [false, true]) {
    const a = app('invalid', true, blocked);
    vm.runInContext('initTheme()', a.context);
    assert.equal(a.document.documentElement.dataset.theme, 'dark');
    a.node('#theme').value = 'light';
    assert.doesNotThrow(() => a.node('#theme').change());
    assert.equal(a.document.documentElement.dataset.theme, 'light');
  }
});
test('every existing CSS and inline color uses theme tokens', () => {
  const css = fs.readFileSync('web/styles.css', 'utf8');
  const components = css.slice(css.indexOf('/* Components */'));
  assert.ok(css.includes('/* Components */'));
  assert.doesNotMatch(components, /#[\da-f]{3,8}\b|:\s*(?:white|black)\b|rgba?\(/i);
  assert.doesNotMatch(source, /(?:color|background):\s*#[\da-f]/i);
  assert.match(fs.readFileSync('web/index.html', 'utf8'), /<label[^>]*for="theme"/);
});
test('theme text and status pairs meet WCAG AA normal text contrast', () => {
  const css = fs.readFileSync('web/styles.css', 'utf8');
  const luminance = (hex) => {
    const rgb = hex.match(/\w\w/g).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const selector of [':root', ':root[data-theme="dark"]', ':root[data-theme="midnight"]']) {
    const block = css.slice(css.indexOf(selector)).split('}')[0];
    const vars = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*#([\da-f]{6});/g)].map((m) => [m[1], m[2]]));
    for (const [fg, bg] of [['text', 'canvas'], ['text', 'surface'], ['muted', 'surface'], ['muted', 'subtle'], ['accent', 'accent-bg'], ['on-strong', 'strong'], ['on-strong-muted', 'strong'], ['warning', 'warning-bg'], ['loss', 'loss-bg']]) {
      assert.ok(vars[fg] && vars[bg], `${selector}: missing ${fg}/${bg}`);
      const values = [luminance(vars[fg]), luminance(vars[bg])].sort((a,b) => b-a);
      assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${selector}: ${fg}/${bg}`);
    }
  }
});
test('ties remain published vote counts, never an overall winner', () => {
  const html = render([ballot('Team', 1, 'A'), ballot('Team', '0', 'B')]);
  assert.match(html, /Published votes: 1 win · 1 loss/);
  assert.match(html, /Panel outcome not confirmed/);
  assert.equal((html.match(/outcome-win/g) || []).length, 1);
  assert.equal((html.match(/outcome-loss/g) || []).length, 1);
});
test('conflicting decisions within one ballot are unknown rather than losses', () => {
  const b = ballot('Team', '1');
  b.scores.push({ tag: 'winloss', value: '0' });
  const html = render([b]);
  assert.match(html, /Published votes: 0 win · 0 loss/);
  assert.match(html, /Outcome not published/);
});
test('missing entry IDs do not merge unrelated entries and pairings hide scores', () => {
  const ballots = [ { ...ballot('', '1'), entry: 'First' }, { ...ballot('', '0'), entry: 'Second' } ];
  const html = render(ballots, 'pairings');
  assert.match(html, /First/);
  assert.match(html, /Second/);
  assert.doesNotMatch(html, /Published votes|outcome-win|outcome-loss/);
});
test('printing overrides every dark palette with readable light colors', () => {
  const css = fs.readFileSync('web/styles.css', 'utf8');
  const print = css.slice(css.indexOf('@media print'), css.indexOf('/* Components */'));
  assert.match(print, /:root\[data-theme\]/);
  assert.match(print, /--surface:\s*#ffffff/);
  assert.match(print, /--text:\s*#172b36/);
  assert.match(print, /color-scheme:\s*light/);
});
test('sections without any ballots explicitly say the outcome is unpublished', () => {
  assert.match(render([]), /Outcome not published/);
});

test('each result side has a green win or red loss panel, not only a small ballot badge', () => {
  const html = render([ballot('Winner', '1'), ballot('Loser', '0')]);
  assert.match(html, /class="entry-result entry-result-win"[\s\S]*?Winner/);
  assert.match(html, /class="entry-result entry-result-loss"[\s\S]*?Loser/);
});
test('split or incomplete panel votes never color the entire entry as a decided result', () => {
  for (const votes of [['1','0'], ['1',null], [null]]) {
    const html = render(votes.map((v,i)=>ballot('Team', v, 'Judge '+i)));
    assert.match(html, /class="entry-result entry-result-neutral"/);
    assert.doesNotMatch(html, /class="entry-result entry-result-(win|loss)"/);
  }
});
test('pairings have no win or loss panel styling before results view', () => {
  assert.doesNotMatch(render([ballot('Team','1')], 'pairings'), /entry-result-(win|loss)/);
});

function renderRound(ballots, event, eventType, sub = 'pairings') {
  const a = app();
  a.context.fixture = { id: '1', resultSets: [], rounds: [{ id: '4', name: 'Round 4', event, eventType, sections: [{ room: '101', ballots }] }] };
  vm.runInContext(`tournament = fixture; drawRounds(${JSON.stringify(sub)});`, a.context);
  return a.node('#round-list').innerHTML;
}
test('debate sides use Aff/Neg defaults and named Parli discloses its conventional fallback', () => {
  const ballots = [1, 2].map(side => ({ ...ballot('Team '+side, null), side: String(side) }));
  const debate = renderRound(ballots, 'Public Forum', 'debate');
  assert.match(debate, /<small>Aff<\/small>/);
  assert.match(debate, /<small>Neg<\/small>/);
  const parli = renderRound(ballots, 'Varsity Parliamentary Debate', 'debate');
  assert.match(parli, /title="[^"]*[Cc]onventional[^"]*">Gov/);
  assert.match(parli, />Opp<\/span>/);
  for (const type of ['speech', '', 'unknown']) {
    assert.doesNotMatch(renderRound(ballots, 'Original Oratory', type), /<small>(Aff|Neg)|>Gov|>Opp/);
  }
});
test('BP positions use speakerorder only, never ballot.side', () => {
  const ballots = [1,2,3,4].map(speakerorder => ({ ...ballot('Team '+speakerorder, null), side: '2', speakerorder: String(speakerorder) }));
  const html = renderRound(ballots, 'British Parliamentary', 'wudc');
  for (const label of ['OG','OO','CG','CO']) assert.match(html, new RegExp('<small>'+label+'</small>'));
  assert.doesNotMatch(renderRound([{ ...ballot('Team', null), side: '1' }], 'BP', 'wudc'), /<small>(OG|OO|CG|CO|Aff|Neg)/);
});
test('paradigm links use only validated person IDs in ballot rows and ID-deduplicated round meta', () => {
  const ballots = [
    { ...ballot('A', '1', '<Same>'), judgeId: '999', judgePersonId: '123' },
    { ...ballot('B', '0', '<Same>'), judgeId: '998', judgePersonId: '124' },
    { ...ballot('C', '0', 'Alias'), judgeId: '997', judgePersonId: '123' },
  ];
  const html = renderRound(ballots, 'PF', 'debate', 'results');
  const meta = html.split('<div class="round-meta">')[1];
  assert.equal((meta.match(/judge_person_id=123/g) || []).length, 1);
  assert.equal((meta.match(/judge_person_id=124/g) || []).length, 1);
  assert.equal((html.match(/judge_person_id=/g) || []).length, 5);
  assert.match(html, /https:\/\/www.tabroom.com\/index\/paradigm.mhtml\?judge_person_id=123/);
  assert.match(html, /Paradigm on Tabroom \(login required\)/);
  assert.match(html, /target="_blank" rel="noopener"/);
  assert.match(html, /&lt;Same&gt;/);
  assert.doesNotMatch(html, /judge_person_id=99/);
  for (const id of [undefined, '', '0', '-1', '1.5', '1e2', '123" onclick="bad', true]) {
    assert.doesNotMatch(renderRound([{ ...ballot('A','1'), judgePersonId: id, judgeId: '999' }], 'PF', 'debate', 'results'), /paradigm.mhtml/);
  }
});
test('cache shape version excludes old exports without judge person IDs', () => {
  const server = fs.readFileSync('src/server.mjs', 'utf8');
  assert.match(server, /\/_cache\/v3\//);
  assert.match(server, /tabbetter-public-v3/);
});
test('invalid BP speaker positions stay neutral, including inherited object keys', () => {
  for (const speakerorder of ['0', '5', '__proto__', 'constructor', 'toString']) {
    const html = renderRound([{ ...ballot('Team', null), side: '1', speakerorder }], 'BP', 'wudc');
    assert.match(html, /<small>Entry<\/small>/);
  }
});
test('absent ballots visible on opposing entry keep incomplete entry neutral', () => {
  const html = render([ballot('A', '1', 'Judge 1'), ballot('B', '0', 'Judge 1'), ballot('B', '1', 'Judge 2'), ballot('B', '1', 'Judge 3')]);
  assert.doesNotMatch(html, /entry-result-win/);
  assert.match(html, /entry-result-neutral/);
});

test('frontend versions API URLs to avoid browser-cached old export shapes', () => {
  assert.match(source, /schema=3/);
});
