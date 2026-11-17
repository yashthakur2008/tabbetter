// Opt-in real browser acceptance of compiled Worker presentation. Only external
// Tabroom responses are deterministic fixtures, so adapters, routing and DOM run.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.js';
const modulePath=process.env.PLAYWRIGHT_MODULE;
const engine=process.env.BROWSER_ENGINE || 'chromium';
const records=Array.from({length:8},(_,i)=>({id:String(92001+i),name:i===0?'Bay Speech Invitational':i===1?'Coast Debate Open':'Tournament '+(i+1),city:'San Jose',state:'CA'}));
function externalFixture(input) {
  const url=new URL(typeof input==='string'?input:input.url);
  assert.equal(url.hostname,'www.tabroom.com');
  if(url.pathname==='/index/index.mhtml') return new Response('<table id="tournlist">'+records.map((r,i)=>'<tr><td data-text="2026-46-'+(i+1)+'">11/'+(16+i)+'</td><td><a href="/index/tourn/main.mhtml?tourn_id='+r.id+'">'+r.name+'</a></td><td>San Jose</td><td><a href="index.mhtml?state=CA">CA</a></td><td><i title="Tournament has in-person events"></i></td><td>Due 11/15 8:00 PM PST</td><td></td></tr>').join('')+'</table>');
  const record=records.find(r=>r.id===url.searchParams.get('tourn_id'));
  if(url.pathname==='/api/download_data.mhtml'&&record) return Response.json({...record,public:'true',start:'2026-11-16',end:'2026-11-18',timezone:'America/Los_Angeles',schools:[],categories:[{name:'Events',judges:[],events:[{id:'1',name:'Original Oratory',type:'speech',rounds:[]},{id:'2',name:'Public Forum',type:'debate',rounds:[]}]}]});
  if(url.pathname==='/index/tourn/main.mhtml'&&record) return new Response('<h2>'+record.name+'</h2><p>Published invitation.</p>');
  return new Response('Not published',{status:404});
}
async function metrics(page) {
  return page.evaluate(()=>{
    const rows=[...document.querySelectorAll('[data-discovery-row]')];
    const box=e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height,left:b.left,right:b.right}};
    return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,firstRow:box(rows[0]),firstTitle:box(rows[0].querySelector('h3 a')),fullyVisible:rows.filter(e=>{const b=box(e);return b.top>=0&&b.bottom<=innerHeight}).length,rendered:rows.length,welcome:!document.querySelector('#tutorial-welcome').hidden};
  });
}
async function capture(page,stem) {
  const directory=process.env.TABBETTER_SCREENSHOT_DIR;
  if(directory){fs.mkdirSync(directory,{recursive:true});await page.screenshot({path:path.join(directory,stem+'.png'),fullPage:true});}
}
test(`competition presentation (${engine}): density, task navigation, icons and large-text reflow`,{skip:!modulePath},async()=>{
  const playwright=await import(pathToFileURL(modulePath));
  const originalFetch=globalThis.fetch;globalThis.fetch=async input=>externalFixture(input);
  const server=http.createServer(async(req,res)=>{
    try {const response=await worker.fetch(new Request('http://localhost'+req.url),{},{waitUntil:p=>p.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
    catch(e){console.error('Competition browser test server request failed:',e);res.writeHead(500);res.end('Internal server error');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;let browser;const evidence=[];
  try {
    browser=await playwright[engine].launch({headless:true});
    for(const viewport of [{width:1440,height:1000},{width:390,height:900}]) {
      const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base);await page.waitForFunction(()=>document.querySelector('#discovery-coverage')?.textContent.includes('8 of 8'));
      await page.evaluate(()=>document.fonts.ready);await page.emulateMedia({reducedMotion:'reduce'});
      for(const state of ['fresh','dismissed']) {
        if(state==='dismissed')await page.locator('#tutorial-not-now').click();
        await page.evaluate(()=>scrollTo(0,0));const m=await metrics(page);evidence.push({engine,state,...m});
        assert.equal(m.welcome,state==='fresh');assert.equal(m.documentWidth,m.width);
        assert.ok(m.firstTitle.bottom<viewport.height,`${state}: first title must fit on ${viewport.width}, got ${m.firstTitle.bottom}`);
        if(viewport.width===1440)assert.ok(m.fullyVisible>=3,`${state}: at least 3 complete desktop rows`);
        await capture(page,`task2-${engine}-${viewport.width}-${state}`);
      }
      assert.match(await page.locator('#discovery-coverage').textContent(),/Matches may be incomplete/);
      await page.locator('#discovery-coverage-help summary').click();assert.match(await page.locator('#discovery-coverage-help').innerText(),/1 minute/);await page.locator('#discovery-coverage-help summary').click();
      const images=await page.locator('.brand img').evaluateAll(ns=>ns.map(n=>({loaded:n.complete&&n.naturalWidth>0,src:n.getAttribute('src'),alt:n.alt})));
      assert.deepEqual(images,[{loaded:true,src:'/assets/mark-v2.svg',alt:''}]);
      for(const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:900});
        // Exercise actual Settings rather than writing a dataset that bypasses preferences.
        await page.goto(base+'/#settings');await page.locator('#workspace-text-size').selectOption('extra-large');
        await page.goto(base+'/#discover');await page.locator('[data-discovery-row]').first().waitFor();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`directory reflow ${width}`);
        const targets=await page.locator('[data-discovery-row] button, [data-tournament-link]').evaluateAll(ns=>ns.map(n=>({text:n.textContent,height:n.getBoundingClientRect().height})));
        for(const target of targets)assert.ok(target.height>=44,JSON.stringify(target));
        evidence.push({engine,state:'extra-large-directory',...(await metrics(page)),minimumTargetHeight:Math.min(...targets.map(t=>t.height))});
        await capture(page,`task2-${engine}-${width}-extra-large-directory`);
        await page.goto(base+'/#tournament/92001');await page.locator('[data-sub="overview"]').waitFor();
        const expected=['Overview','Schedule','Pairings','Entries','Judges','Results'];
        assert.deepEqual(await page.locator('.tournament-tasks button').allTextContents(),expected);
        for(const button of await page.locator('.tournament-tasks button').all()) {
          const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,`visible task at ${width}`);assert.ok(box.height>=44);
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`tournament reflow ${width}`);
        evidence.push({engine,state:'extra-large-tournament',width,documentWidth:await page.evaluate(()=>document.documentElement.scrollWidth),tasks:await page.locator('.tournament-tasks button').evaluateAll(ns=>ns.map(n=>({label:n.textContent,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})))});
        await capture(page,`task2-${engine}-${width}-extra-large-tournament`);
      }
      for(const task of ['schedule','pairings','entries','judges','results','events','schools','statistics','resources','overview']) {
        await page.locator(`[data-sub="${task}"]`).click();await page.waitForURL(`**/#tournament/92001/${task}`);
        await page.waitForFunction(task=>document.querySelector(`[data-sub="${task}"]`)?.getAttribute('aria-current')==='page',task);
      }
      await page.goto(base+'/#about');await page.locator('.about-brand').waitFor();assert.equal(await page.locator('.about-brand').getAttribute('src'),'/assets/mark-v2.svg');
      await page.goto(base+'/#rankings/Lincoln-Douglas');await page.getByText('Historical rankings unavailable').waitFor();assert.match(await page.locator('#app').innerText(),/not a sign-in issue/);
      assert.deepEqual(errors,[]);await context.close();
    }
  } finally {
    await browser?.close();await new Promise(resolve=>server.close(resolve));globalThis.fetch=originalFetch;
    if(process.env.TABBETTER_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.TABBETTER_SCREENSHOT_DIR,`task2-${engine}-metrics.json`),JSON.stringify(evidence,null,2));
  }
});
