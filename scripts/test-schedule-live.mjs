// Unintercepted public acceptance against the local compiled Worker. No roster
// payloads are written. Network/source failures are reported, never fixtured.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.js';
import {source4slots,interpretedInstants} from '../tests/fixtures/schedule-41209.mjs';
const playwright=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const server=http.createServer(async(req,res)=>{
  try {const r=await worker.fetch(new Request('http://localhost'+req.url),{},{waitUntil:p=>p.catch(()=>{})});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}
  catch(error){console.error('Schedule live server request failed:',error);res.writeHead(500);res.end('Internal server error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await playwright.chromium.launch({headless:true});
const evidence={at:new Date().toISOString(),kind:'Live public source through compiled Worker, no response interception',schedule:[],invitationVisits:[],workflows:[]};
async function verifyInvitation(page, invitation) {
  await page.locator('[data-sub="overview"][aria-current="page"]').waitFor();
  const content=await page.locator('#detail-content').innerText();
  assert.doesNotMatch(content,/Section not found\.|The structured export is unavailable/);
  assert.ok(invitation.paragraphs?.length,'public invitation prose unavailable; cannot claim content acceptance');
  const prose=page.locator('#detail-content .prose');await prose.waitFor();
  const normalize=text=>text.replace(/\s+/g,' ').trim();
  const text=normalize(await prose.innerText());
  for(const paragraph of invitation.paragraphs)assert.ok(text.includes(normalize(paragraph)),'received public invitation paragraph is rendered');
  assert.equal(await prose.locator('p').count(),invitation.paragraphs.length);
}
async function visitInvitationAndReturn(page, invitation, select, choice, timezoneId) {
  const previous=await page.locator('.schedule').innerText();
  await page.locator('#schedule-invitation').click();
  await page.waitForFunction(()=>!document.querySelector('#schedule-invitation') && document.querySelector('#detail-content'));
  assert.doesNotMatch(await page.locator('#detail-content').innerText(),/Section not found\./);
  await verifyInvitation(page,invitation);
  await page.locator('[data-sub="schedule"]').click();await select.waitFor();
  assert.equal(await select.inputValue(),choice);assert.equal(await page.locator('.schedule').innerText(),previous);
  evidence.invitationVisits.push({timezoneId,choice:choice||'unselected',paragraphs:invitation.paragraphs.length,choicePreserved:true});
}
try {
  const views=[];
  for(const timezoneId of ['America/Los_Angeles','UTC']) {
    const context=await browser.newContext({timezoneId});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const receivedInvitation=page.waitForResponse(r=>r.url().includes('/api/invitation?id=41209'));
    const received=page.waitForResponse(r=>r.url().includes('/api/tournament?id=41209'));
    await page.goto(base+'/#tournament/41209/schedule');const response=await received;const data=await response.json();
    const invitationResponse=await receivedInvitation;const invitation=await invitationResponse.json();
    assert.equal(invitationResponse.status(),200,'public invitation must be available for this acceptance run');
    if(!response.ok() || !data.timeslots?.length)throw Error('Public structured schedule unavailable: HTTP '+response.status());
    // Persist only the minimal source contract, not entries, schools or judges.
    evidence.source={status:response.status(),timezone:data.timezone,timeslots:data.timeslots};
    assert.deepEqual(data.timeslots,source4slots,'live source shape changed: review expectations rather than substitute fixtures');
    await page.locator('.schedule-row').first().waitFor();
    const select=page.getByLabel('Interpret source times as',{exact:true});
    const offsetless=data.timeslots.some(t=>[t.start,t.end].some(s=>!/(Z|[+-]\d{2}:\d{2})$/.test(s)));
    const states=[await page.locator('.schedule').innerText()];
    if(offsetless){assert.equal(await select.inputValue(),'');await page.locator('#ics').click();assert.equal(await select.evaluate(e=>e===document.activeElement),true);}
    await visitInvitationAndReturn(page,invitation,select,'',timezoneId);
    for(const choice of offsetless?['UTC',data.timezone]:['explicit offsets']) {
      if(offsetless)await select.selectOption(choice);
      states.push(await page.locator('.schedule').innerText());
      await visitInvitationAndReturn(page,invitation,select,choice,timezoneId);
      const pending=page.waitForEvent('download');await page.locator('#ics').click();const d=await pending;const ics=await fs.readFile(await d.path(),'utf8');
      const events=ics.match(/BEGIN:VEVENT/g)||[];assert.equal(events.length,data.timeslots.length);
      assert.equal((ics.match(/DTSTART:\d{8}T\d{6}Z/g)||[]).length,events.length);
      assert.equal((ics.match(/DTEND:\d{8}T\d{6}Z/g)||[]).length,events.length);
      assert.equal((ics.match(/DTSTAMP:\d{8}T\d{6}Z/g)||[]).length,events.length);
      assert.equal(ics.replaceAll('\r\n','').includes('\n'),false);
      assert.deepEqual([...ics.matchAll(/DTSTART:(.*)/g)].map(m=>m[1]),interpretedInstants[choice].starts);
      assert.deepEqual([...ics.matchAll(/DTEND:(.*)/g)].map(m=>m[1]),interpretedInstants[choice].ends);
      assert.equal(new Set([...ics.matchAll(/UID:(.*)/g)].map(m=>m[1])).size,events.length);
      evidence.schedule.push({timezoneId,choice,filename:d.suggestedFilename(),events:events.length,bytes:Buffer.byteLength(ics),starts:[...ics.matchAll(/DTSTART:(.*)/g)].map(m=>m[1]),ends:[...ics.matchAll(/DTEND:(.*)/g)].map(m=>m[1])});
    }
    views.push(states);
    if(timezoneId==='America/Los_Angeles') {
      for(const tab of ['overview','events','entries','schools','judges','pairings','results','statistics','resources']) {
        await page.locator('[data-sub="'+tab+'"]').click();
        await page.locator('[data-sub="'+tab+'"][aria-current="page"]').waitFor();
        const content=page.locator('#detail-content');
        assert.doesNotMatch(await content.innerText(),/Section not found\.|The structured export is unavailable/);
        if(tab==='overview')await verifyInvitation(page,invitation);
        if(tab==='events') {assert.equal(await content.locator('h2').innerText(),'Events & divisions');assert.equal(await content.locator('.resource-grid article').count(),data.events.length);}
        if(tab==='schools') {assert.equal(await content.locator('h2').innerText(),'Participating schools');assert.equal(await content.locator('tbody tr').count(),data.schools.length);}
        if(tab==='statistics') {assert.equal(await content.locator('h2').innerText(),'Published statistics');await page.locator('#stat-event').waitFor();assert.ok((await page.locator('#statistics-list').innerText()).length>0);}
        if(tab==='resources') {assert.equal(await content.locator('h2').innerText(),'Tournament links & resources');assert.ok(await content.locator('a.linkrow').count()>0);}

        if(['entries','judges'].includes(tab)){const search=page.locator('#detail-search');assert.equal(await search.getAttribute('aria-label'),'Search '+tab);assert.equal(await page.locator('#people-list tbody tr').count(),Math.min(300,data[tab].length));await search.fill('zzzznonexistent');assert.equal(await page.locator('#people-list tbody tr').count(),0);await search.fill('');}
        if(['pairings','results'].includes(tab)) {
          const event=data.events.find(e=>e.name==='Lincoln Douglas JV');assert.ok(event,'public event remains available');
          await page.locator('#round-event').selectOption(event.id);const rounds=page.locator('#round-filter');
          const option=await rounds.locator('option').evaluateAll(nodes=>nodes.find(n=>n.value)?.value);assert.ok(option);await rounds.selectOption(option);
          assert.ok(await page.locator('.round-card').count()>0,'published round content');
        }
        evidence.workflows.push({tab,sectionSpecificChecks:true});
      }
      await page.goto(base+'/#tournament/41209/judges');
      const member=page.locator('a.member-link[href="#tournament/41209/member/judge:registration:2898901"]');await member.click();
      const paradigm=page.locator('.member-card .paradigm-link');assert.match(await paradigm.getAttribute('href'),/judge_person_id=881819$/);assert.match(await paradigm.innerText(),/login required/);
      await page.locator('.member-back').click();await page.locator('#detail-search').waitFor();evidence.workflows.push({identity:'registration:2898901 -> person:881819',back:true,officialLoginRequired:true});
      await page.goto(base+'/#discover');await page.locator('[data-discovery-row]').first().waitFor({timeout:60000});
      const before=await page.locator('[data-discovery-row]').count();await page.locator('#discovery-search').fill('zzzznonexistent');await page.waitForFunction(()=>document.querySelectorAll('[data-discovery-row]').length===0);await page.locator('#discovery-search').fill('');
      await page.locator('[data-discovery-row]').first().waitFor();
      const row=page.locator('[data-discovery-row]').first(), savedId=await row.getAttribute('data-discovery-row');
      await row.locator('[data-discovery-save]').click();await page.goto(base+'/#saved');
      await page.locator('[data-discovery-row="'+savedId+'"]').waitFor();await page.reload();await page.locator('[data-discovery-row="'+savedId+'"]').waitFor();
      evidence.workflows.push({directoryRows:before,search:true,savedAndReloaded:true});
    }
    assert.deepEqual(errors,[]);await context.close();
  }
  assert.deepEqual(views[0],views[1]);evidence.viewerTimezoneIndependent=true;
  console.log(JSON.stringify(evidence,null,2));
} catch(error) { console.error(JSON.stringify({...evidence,failure:error.message},null,2));process.exitCode=1; }
finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
