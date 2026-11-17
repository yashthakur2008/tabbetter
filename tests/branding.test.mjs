import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker/index.js';

const assets = [
  ['mark-v2.svg', 'image/svg+xml'], ['mark-mono-v2.svg', 'image/svg+xml'],
  ['favicon-16-v2.png', 'image/png'], ['favicon-32-v2.png', 'image/png'],
  ['touch-icon-v2.png', 'image/png'], ['favicon-v2.ico', 'image/x-icon'],
];
test('compiled Worker serves versioned brand assets with exact bytes, MIME and immutable caching', async () => {
  for (const [name, mime] of assets) {
    const response = await worker.fetch(new Request('https://example.test/assets/'+name), {}, {});
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get('content-type'), mime);
    assert.match(response.headers.get('cache-control'), /immutable/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync('assets/'+name));
  }
});
test('compiled page declares SVG, raster and touch icons and uses the canonical decorative brand', async () => {
  const response = await worker.fetch(new Request('https://example.test/'), {}, {});
  const html = await response.text();
  assert.match(html, /rel="icon"[^>]*href="\/assets\/mark-v2.svg"/);
  for (const size of [16,32]) assert.match(html, new RegExp('rel="icon"[^>]*sizes="'+size+'x'+size+'"[^>]*href="/assets/favicon-'+size+'-v2.png"'));
  assert.match(html, /rel="apple-touch-icon"[^>]*href="\/assets\/touch-icon-v2.png"/);
  assert.match(html, /aria-label="TabBetter home"[^>]*><img[^>]*src="\/assets\/mark-v2.svg"[^>]*alt=""/);
  assert.doesNotMatch(html, /src="\/logo.png"/);
  assert.match(html, /class="about-brand" src="\/assets\/mark-v2.svg" alt=""/);
});
test('PNG variants have exact declared dimensions and a matching SVG master', () => {
  for (const [name,size] of [['favicon-16-v2.png',16],['favicon-32-v2.png',32],['touch-icon-v2.png',180]]) {
    const png=fs.readFileSync('assets/'+name);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),size); assert.equal(png.readUInt32BE(20),size);
  }
  const svg=fs.readFileSync('assets/mark-v2.svg','utf8');
  assert.match(svg, /<title[^>]*>TabBetter/);
  assert.match(svg, /viewBox="0 0 32 32"/);
});

test('conventional favicon and legacy logo routes return the current mark without stale caching', async () => {
  for(const [route,file,type] of [['/favicon.ico','favicon-v2.ico','image/x-icon'],['/logo.png','touch-icon-v2.png','image/png']]) {
    const response=await worker.fetch(new Request('https://example.test'+route),{},{});
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),type);
    assert.equal(response.headers.get('cache-control'),'no-cache');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync('assets/'+file));
  }
  const ico=fs.readFileSync('assets/favicon-v2.ico');
  assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),2);
  for(const [index,size] of [[0,16],[1,32]]) {
    const entry=6+16*index;assert.equal(ico[entry],size);assert.equal(ico[entry+1],size);
    const offset=ico.readUInt32LE(entry+12),length=ico.readUInt32LE(entry+8);
    assert.deepEqual(ico.subarray(offset,offset+length),fs.readFileSync(`assets/favicon-${size}-v2.png`));
  }
});
