import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { hydrateCorpus } from '../src/rankings/corpus.mjs';

const importer = fileURLToPath(new URL('../scripts/import-rankings.mjs', import.meta.url));
const preload = fileURLToPath(new URL('./fixtures/rankings/import-preload.mjs', import.meta.url));
const root = 'https://api.github.com/repos/skumar-ml/debate-rankings/contents/';
const raw = 'https://raw.githubusercontent.com/skumar-ml/debate-rankings/master/';
const npdl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQF5psWXOYYAiwJxzm1gdz0lLxHgfz1L1tgBj_Vu_hxkNafIIspTG2ToRuQIsUbaYqOK3I2puooSryQ/pub?gid=1327342258&single=true&output=csv';

function runImport(t, args = []) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tabbetter-import-test-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const fixtures = { [root]: ['2024-2025', '2025-2026', '2026-2027'].map((name) => ({ type: 'dir', name })),
    [npdl]: '#,School,Region,Debater 1,Debater 2,Points\n1,Example School,CA1,Alpha,Beta,42' };
  for (const { name: season } of fixtures[root]) {
    for (const event of ['LD', 'PF']) {
      fixtures[raw + season + '/' + event + '_Rankings/' + event + 'Rankings.csv'] =
        '1,Example AB,Alpha Beta,1800,N';
    }
  }
  const fixturePath = path.join(cwd, 'fixtures.json');
  const requestsPath = path.join(cwd, 'requests.txt');
  fs.writeFileSync(fixturePath, JSON.stringify(fixtures));
  const result = spawnSync(process.execPath, ['--import', preload, importer, ...args], {
    cwd, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, TABBETTER_IMPORT_FIXTURES: fixturePath, TABBETTER_IMPORT_REQUESTS: requestsPath },
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return {
    corpus: hydrateCorpus(JSON.parse(fs.readFileSync(path.join(cwd, 'build/rankings-corpus.json'), 'utf8'))),
    requests: fs.readFileSync(requestsPath, 'utf8').trim().split('\n'),
  };
}

test('the importer does not widen the default window to include newer sources', (t) => {
  const { corpus } = runImport(t);
  assert.deepEqual(corpus.window, { from: '2025-08-01', to: '2026-07-31' });
  assert.deepEqual(corpus.seasons, ['2025-2026']);
  assert.equal(corpus.competitors.length, 2);
  assert.ok(corpus.competitors.every((c) => c.season === '2025-2026'));
});

test('the importer only requests ranking files from the requested season window', (t) => {
  const { requests } = runImport(t);
  assert.ok(requests.some((url) => url.startsWith(raw + '2025-2026/')));
  assert.ok(!requests.some((url) => url.startsWith(raw + '2024-2025/')));
  assert.ok(!requests.some((url) => url.startsWith(raw + '2026-2027/')));
  assert.ok(!requests.includes(npdl), 'current-season NPDL is not requested for a previous-season import');
});

test('an explicit expanded window includes current-season NPDL without changing its season', (t) => {
  const { corpus } = runImport(t, ['--from=2025-08-01', '--to=2027-07-31']);
  assert.deepEqual(corpus.seasons, ['2025-2026', '2026-2027']);
  const parli = corpus.competitors.find((c) => c.event === 'Parliamentary');
  assert.equal(parli.season, '2026-2027');
  assert.match(parli.provider, /Parliamentary/);
});
