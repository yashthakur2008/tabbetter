// Supplemental fixtures through the real compiled Worker and public UI, not live evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.js';
import {source4slots,interpretedInstants} from './fixtures/schedule-41209.mjs';
const modulePath=process.env.PLAYWRIGHT_MODULE;
const engine=process.env.BROWSER_ENGINE || 'chromium';
const slotCases = {
  '41211': source4slots.map(t=>({...t,start:t.start+'Z',end:t.end+'Z'})),
  '41212': [{name:'DST gap',start:'2026-03-08T02:30:00',end:'2026-03-08T04:00:00'}],
  '41213': [{name:'Mixed',start:'2026-10-24T15:30:00Z',end:'2026-10-24 17:15:00'}],
  '41214': [],
  '41215': [{name:'Malformed',start:'2026-02-30T01:00:00',end:'2026-03-01T01:00:00'}],
  '41216': [{name:'DST fold',start:'2026-11-01T01:30:00',end:'2026-11-01T03:00:00'}],
};
const explicitSlots = [
  {name:'Explicit Z',start:'2026-10-24T15:30:00Z',end:'2026-10-24T17:15:00Z'},
  {name:'Numeric offsets',start:'2026-10-24T08:30:00-07:00',end:'2026-10-24T19:15:00+02:00'},
  {name:'Mixed explicit offsets',start:'2026-10-24T15:30:00Z',end:'2026-10-24T10:15:00-07:00'},
];
slotCases['41219']=explicitSlots;slotCases['41220']=explicitSlots;
slotCases['41221']=slotCases['41213'];slotCases['41222']=slotCases['41213'];
const timezoneCases={'41217':'Not/AZone','41218':'UTC','41219':'','41220':'Not/AZone','41221':'','41222':'Not/AZone'};
function fixture(input) {
  const url=new URL(typeof input==='string'?input:input.url),id=url.searchParams.get('tourn_id');
  assert.equal(url.hostname,'www.tabroom.com');
  if(url.pathname==='/api/download_data.mhtml')return Response.json({id,name:'CFL, Debate; \\ club\nSchedule',public:'true',timezone:timezoneCases[id] ?? 'America/Los_Angeles',start:'2026-10-24 15:00:00',end:'2026-10-25 06:55:00',timeslots:slotCases[id] ?? source4slots,categories:[],schools:[]});
  if(url.pathname==='/index/tourn/main.mhtml' && id==='41223')return new Response('Not published',{status:404});
  if(url.pathname==='/index/tourn/main.mhtml')return new Response('<h2>CFL Super Debate 1</h2><p>Published invitation.</p>');
  return new Response('Not published',{status:404});
}
async function downloadICS(page) {
  const pending=page.waitForEvent('download');await page.locator('#ics').click();const d=await pending;
  assert.match(d.suggestedFilename(),/\.ics$/);return fs.readFile(await d.path(),'utf8');
}
async function checkInvitationAndReturn(page, select, choice) {
  await page.locator('#schedule-invitation').click();
  await page.waitForFunction(()=>!document.querySelector('#schedule-invitation') && document.querySelector('#detail-content'));
  const content=await page.locator('#detail-content').innerText();
  assert.doesNotMatch(content,/Section not found/);
  assert.match(await page.locator('#detail-content .prose').innerText(),/Published invitation\./);
  assert.equal(new URL(page.url()).hash,'#tournament/41209/overview');
  await page.locator('[data-sub="schedule"]').click();await select.waitFor();
  assert.equal(await select.inputValue(),choice,'invitation visit preserves this tournament interpretation');
}
test(`schedule compiled browser (${engine}): explicit interpretation, exact downloads and choice lifecycle in LA/UTC`,{skip:!modulePath},async()=>{
  const playwright=await import(pathToFileURL(modulePath));const original=globalThis.fetch;globalThis.fetch=async input=>fixture(input);
  const server=http.createServer(async(req,res)=>{try{const r=await worker.fetch(new Request('http://localhost'+req.url),{},{waitUntil:p=>p.catch(()=>{})});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){console.error('Schedule browser server request failed:',e);res.writeHead(500);res.end('Internal server error');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  let browser;const views=[];
  try {
    browser=await playwright[engine].launch({headless:true});
    for(const timezoneId of ['America/Los_Angeles','UTC']) {
      const context=await browser.newContext({timezoneId});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/#tournament/41209/schedule');await page.locator('.schedule-row').first().waitFor();
      assert.match(await page.locator('#detail-content').textContent(),/Timezone not specified in source/);
      const select=page.getByLabel('Interpret source times as',{exact:true});assert.equal(await select.inputValue(),'');
      const states=[await page.locator('.schedule').innerText()];assert.match(states[0],/2026-10-24 15:30:00/);assert.doesNotMatch(states[0],/PDT|UTC/);
      let downloads=0;page.on('download',()=>downloads++);await page.locator('#ics').click();
      assert.equal(await select.evaluate(e=>e===document.activeElement),true);assert.match(await page.locator('#schedule-feedback').innerText(),/Choose.*display.*calendar/i);assert.equal(downloads,0);
      await checkInvitationAndReturn(page,select,'');
      for(const [choice,first,last] of [['UTC','20261024T153000Z','20261025T003000Z'],['America/Los_Angeles','20261024T223000Z','20261025T073000Z']]) {
        await select.selectOption(choice);states.push(await page.locator('.schedule').innerText());
        await checkInvitationAndReturn(page,select,choice);
        const ics=await downloadICS(page);assert.equal(ics.match(/BEGIN:VEVENT/g).length,4);
        assert.match(ics,new RegExp('DTSTART:'+first));assert.match(ics,new RegExp('DTEND:'+last));
        assert.deepEqual([...ics.matchAll(/DTSTART:(.*)/g)].map(m=>m[1]),interpretedInstants[choice].starts);
        assert.deepEqual([...ics.matchAll(/DTEND:(.*)/g)].map(m=>m[1]),interpretedInstants[choice].ends);
        assert.match(ics,/^BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/);assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
        for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
        assert.equal(ics.match(/DTSTAMP:\d{8}T\d{6}Z/g).length,4);assert.equal(ics.match(/UID:41209-\d@tabbetter/g).length,4);
        assert.match(ics.replaceAll('\r\n ',''),/SUMMARY:CFL\\, Debate\\; \\\\ club\\nSchedule/);
        assert.equal(ics.replaceAll('\r\n','').includes('\n'),false);
      }
      const refreshed=page.waitForResponse(r=>r.url().includes('/api/tournament?id=41209'));await page.locator('#refresh-detail').click();await refreshed;
      await page.waitForFunction(()=>document.querySelector('#sync-status')?.textContent.startsWith('Updated '));
      assert.equal(await select.inputValue(),'America/Los_Angeles');
      await page.goto(base+'/#tournament/41209/judges');await page.locator('#detail-search').waitFor();
      await page.goto(base+'/#tournament/41209/schedule');assert.equal(await select.inputValue(),'America/Los_Angeles');
      await page.goto(base+'/#tournament/41210/schedule');await page.waitForFunction(()=>document.querySelector('#schedule-interpretation')?.value==='');
      await page.goto(base+'/#tournament/41209/schedule');assert.equal(await select.inputValue(),'');
      await page.goto(base+'/#tournament/41211/schedule');await page.locator('.schedule-row').first().waitFor();assert.equal(await select.count(),0);assert.equal((await downloadICS(page)).match(/BEGIN:VEVENT/g).length,4);
      await page.goto(base+'/#tournament/41212/schedule');await select.selectOption('America/Los_Angeles');assert.match(await page.locator('#schedule-feedback').innerText(),/nonexistent/i);assert.equal(await page.locator('#ics').isDisabled(),true);
      await page.goto(base+'/#tournament/41213/schedule');await page.locator('.schedule-row').first().waitFor();assert.match(await page.locator('.schedule').innerText(),/PDT/);await select.selectOption('UTC');assert.equal((await downloadICS(page)).match(/BEGIN:VEVENT/g).length,1);
      for(const [id,pattern] of [['41214',/No structured schedule/],['41215',/invalid|malformed/i]]) {await page.goto(base+`/#tournament/${id}/schedule`);await page.waitForFunction(()=>document.querySelector('#ics')?.disabled);assert.match(await page.locator('#schedule-feedback').innerText(),pattern);}
      await page.goto(base+'/#tournament/41216/schedule');await select.selectOption('America/Los_Angeles');
      assert.match(await page.locator('#schedule-feedback').innerText(),/ambiguous/i);assert.equal(await page.locator('#ics').isDisabled(),true);
      await page.goto(base+'/#tournament/41217/schedule');await select.waitFor();assert.match(await page.locator('#schedule-feedback').innerText(),/Invalid or missing tournament timezone/);assert.equal(await page.locator('#ics').isDisabled(),true);
      await page.goto(base+'/#tournament/41218/schedule');await select.waitFor();assert.deepEqual(await select.locator('option').evaluateAll(ns=>ns.map(n=>n.value)),['','UTC']);
      for(const [id,zoneLabel] of [['41219','Not published'],['41220','Not/AZone']]) {
        await page.goto(base+`/#tournament/${id}/schedule`);await page.locator('.schedule-row').first().waitFor();
        assert.equal(await select.count(),0);assert.equal(await page.locator('#ics').isDisabled(),false);
        assert.match(await page.locator('#schedule-feedback').innerText(),/Tournament timezone.*(?:not published|invalid).*displayed in UTC/);
        assert.ok((await page.locator('#detail-content').innerText()).includes('Tournament timezone: '+zoneLabel));
        assert.match(await page.locator('.schedule').innerText(),/3:30 PM UTC/);states.push(await page.locator('.schedule').innerText());
        const ics=await downloadICS(page);assert.equal(ics.match(/BEGIN:VEVENT/g).length,3);
        assert.equal(ics.match(/DTSTART:20261024T153000Z/g).length,3);assert.equal(ics.match(/DTEND:20261024T171500Z/g).length,3);
      }
      for(const id of ['41221','41222']) {
        await page.goto(base+`/#tournament/${id}/schedule`);await select.waitFor();assert.equal(await select.inputValue(),'');
        assert.equal(await page.locator('#ics').isDisabled(),true);assert.match(await page.locator('#schedule-feedback').innerText(),/Invalid or missing tournament timezone/);
      }
      await page.goto(base+'/#tournament/41223/schedule');await select.selectOption('UTC');
      await page.locator('#schedule-invitation').click();await page.locator('[data-sub="overview"][aria-current="page"]').waitFor();
      assert.doesNotMatch(await page.locator('#detail-content').innerText(),/Section not found/);
      assert.match(await page.locator('#detail-content .empty').innerText(),/invitation text is not available/);
      assert.equal(await page.getByRole('link',{name:'Read the official invitation'}).getAttribute('href'),'https://www.tabroom.com/index/tourn/main.mhtml?tourn_id=41223');
      await page.locator('[data-sub="schedule"]').click();await select.waitFor();assert.equal(await select.inputValue(),'UTC');
      await page.goto(base+'/#settings');await page.locator('#workspace-text-size').selectOption('extra-large');
      await page.goto(base+'/#tournament/41209/schedule');await select.waitFor();
      for(const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'schedule reflows at '+width);
        await select.selectOption('UTC');assert.equal(await select.evaluate(e=>e===document.activeElement),true);
        await select.selectOption('');
        if(process.env.TABBETTER_SCREENSHOT_DIR && timezoneId==='UTC' && [320,1440].includes(width)) {
          await fs.mkdir(process.env.TABBETTER_SCREENSHOT_DIR,{recursive:true});
          await page.screenshot({path:process.env.TABBETTER_SCREENSHOT_DIR+`/schedule-${engine}-${width}.png`,fullPage:true});
        }
      }
      await page.reload();await select.waitFor();assert.equal(await select.inputValue(),'','no interpretation persisted across reload');
      views.push(states);assert.deepEqual(errors,[]);await context.close();
    }
    assert.deepEqual(views[0],views[1],'raw and both interpreted schedule displays are viewer-zone independent');
  } finally {await browser?.close();globalThis.fetch=original;await new Promise(resolve=>server.close(resolve));}
});
