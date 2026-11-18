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
// Retain the independent review's all-theme and System/OS cases in CI.
const themeCases=[
  {theme:'light',os:'light'}, {theme:'dark',os:'light'},
  {theme:'midnight',os:'light'}, {theme:'system',os:'light'}, {theme:'system',os:'dark'},
];
async function selectPersistedTheme(page,base,theme,os) {
  await page.emulateMedia({colorScheme:os});
  await page.goto(base+'/#settings');await page.locator('#theme').selectOption(theme);
  await page.reload();
  assert.equal(await page.locator('#theme').inputValue(),theme,'theme choice survives reload');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==='system'?os:theme,'System resolves the current OS scheme');
}
async function assertThemePresentation(page) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'all-theme reflow');
  const colors=await page.locator('.event-speech,.event-debate').evaluateAll(elements=>elements.slice(0,2).map(e=>{
    const style=getComputedStyle(e);return {color:style.color,background:style.backgroundColor};
  }));
  assert.equal(colors.length,2,'published speech/debate chips rendered');
  const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{
    v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
  }).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  for(const {color,background} of colors) {
    const a=luminance(color),b=luminance(background);
    assert.ok((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,'event chip text contrast in each theme');
  }
  assert.notEqual(colors[0].background,colors[1].background,'categories remain distinct in each theme');
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
// Breaks caught: lost preference, stranded hidden navigation, focus loss on resize,
// nonexpanding content, ignored reduced motion, unsaved bookmark and guessed chip type.
test(`sidebar refinement (${engine}): persistent keyboard toggle, reflow and motion`,{skip:!modulePath},async()=>{
  const playwright=await import(pathToFileURL(modulePath));
  const originalFetch=globalThis.fetch;globalThis.fetch=async input=>externalFixture(input);
  const server=http.createServer(async(req,res)=>{
    try {const response=await worker.fetch(new Request('http://localhost'+req.url),{},{waitUntil:p=>p.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
    catch(error){console.error(error);res.writeHead(500);res.end('Internal server error');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;let browser;const evidence=[];
  try {
    browser=await playwright[engine].launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.locator('[data-discovery-row]').first().waitFor();
    const official=page.locator('#workspace-navigation a[href="https://www.tabroom.com/user/home.mhtml"]');
    assert.equal((await official.textContent()).trim(),'Open official Tabroom','external link label does not duplicate its custom icon');
    assert.equal(await official.locator('svg[aria-hidden="true"]').count(),1,'custom external-link icon retained');
    const toggle=page.locator('#workspace-sidebar-toggle');
    assert.equal(await toggle.count(),1,'permanent desktop header toggle exists');
    assert.equal(await toggle.getAttribute('aria-controls'),'workspace-sidebar-slot');
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.equal(await toggle.getAttribute('aria-label'),'Hide sidebar');
    const shownWidth=await page.locator('main').evaluate(e=>e.getBoundingClientRect().width);
    await toggle.focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector('main').getBoundingClientRect().width===innerWidth);
    assert.ok(await page.locator('main').evaluate(e=>e.getBoundingClientRect().width)>shownWidth+200);
    assert.equal(await toggle.getAttribute('aria-label'),'Show sidebar');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-sidebar-toggle');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#workspace-navigation')),false,'hidden nav not tabbable');
    for(const hidden of [false,true]) {
      await page.setViewportSize({width:1440,height:1000});
      if((await toggle.getAttribute('aria-expanded')==='false')!==hidden)await toggle.click();
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});
        for(const {theme,os} of themeCases) {
          await selectPersistedTheme(page,base,theme,os);
          await page.goto(base+'/#discover');await page.waitForFunction(()=>document.querySelector('#discovery-coverage')?.textContent.includes('8 of 8'));
          await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
          await assertThemePresentation(page);
          const m=await metrics(page);evidence.push({engine,hidden,theme,os,textSize:'default',...m});
          assert.equal(m.documentWidth,width);if(width===1440)assert.ok(m.fullyVisible>=3,'compact default rows retained');
          assert.notEqual(await page.locator('.site-header').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','header has opaque canvas beneath lighting');
          await capture(page,`sidebar-${engine}-${width}-${hidden?'hidden':'shown'}-${theme==='system'?'system-'+os:theme}-default`);
        }
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.reload();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await page.goto(base+'/#settings');await page.locator('#workspace-text-size').selectOption('extra-large');
    await page.goto(base+'/#discover');assert.equal(await toggle.getAttribute('aria-expanded'),'false','route remount retains hidden state');
    for(const hidden of [true,false]) {
      await page.setViewportSize({width:1440,height:1000});
      if((await toggle.getAttribute('aria-expanded')==='false')!==hidden) {await toggle.focus();await page.keyboard.press('Enter');}
      for(const width of [320,390,768,901,1440]) {
        await page.setViewportSize({width,height:1000});
        await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`extra-large ${width} hidden=${hidden}`);
        assert.equal(await page.locator('#discovery-count').evaluate(e=>{
          const text=e.firstChild, range=document.createRange();range.setStart(text,text.textContent.indexOf('tournaments'));range.setEnd(text,text.length);return range.getClientRects().length;
        }),1,`result count must not split a word at ${width}`);
        if(width<=900) {
          await page.locator('#workspace-menu').click();
          assert.equal(await page.locator('[data-nav="settings"]').isVisible(),true,'mobile remains reachable');
          await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-menu');
        }
        for(const {theme,os} of themeCases) {
          await selectPersistedTheme(page,base,theme,os);
          await page.goto(base+'/#discover');await page.locator('[data-discovery-row]').first().waitFor();
          await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
          await assertThemePresentation(page);
          evidence.push({engine,hidden,theme,os,textSize:'extra-large',...(await metrics(page))});
          await capture(page,`sidebar-${engine}-${width}-${hidden?'hidden':'shown'}-${theme==='system'?'system-'+os:theme}`);
        }
      }
    }
    assert.ok(await page.locator('.discovery-row h3').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=24,'directory text respects extra-large setting');
    const speech=page.locator('.event-speech').first(), debate=page.locator('.event-debate').first();
    assert.notEqual(await speech.evaluate(e=>getComputedStyle(e).backgroundColor),await debate.evaluate(e=>getComputedStyle(e).backgroundColor),'speech and debate visually distinct');
    await page.locator('#discovery-events summary').click();
    await page.locator('[data-event="oo"]').check();await page.locator('[data-event="pf"]').check();
    await page.locator('#discovery-events summary').click();
    assert.equal(await speech.evaluate(e=>e.classList.contains('is-match')),true);
    assert.equal(await debate.evaluate(e=>e.classList.contains('is-match')),true);
    assert.notEqual(await speech.evaluate(e=>getComputedStyle(e).backgroundColor),await debate.evaluate(e=>getComputedStyle(e).backgroundColor),'selected event matches retain distinct categories');
    await page.locator('#discovery-clear-all').click();
    const row=page.locator('[data-discovery-row]').first();
    await toggle.hover();const resting=await row.evaluate(e=>getComputedStyle(e).backgroundColor);
    await row.hover();await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
    assert.notEqual(await row.evaluate(e=>getComputedStyle(e).backgroundColor),resting,'row hover feedback');
    // Hide while desktop, open mobile drawer, then resize with navigation focused.
    if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
    await page.setViewportSize({width:390,height:900});await page.locator('#workspace-menu').click();
    await page.locator('[data-nav="saved"]').focus();await page.setViewportSize({width:1440,height:1000});
    await page.locator('#workspace-drawer').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-sidebar-toggle');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    // Real save animation must be finite, survive no longer than motion allows,
    // and never delay actual persistence or replace the focused button.
    const save=page.locator('[data-discovery-save]').first();
    await page.emulateMedia({reducedMotion:'no-preference'});await save.focus();await page.keyboard.press('Enter');
    assert.equal(await save.getAttribute('aria-pressed'),'true');
    assert.equal(await save.evaluate(e=>document.activeElement===e),true,'save preserves the actual focused control');
    assert.ok(await save.evaluate(e=>e.getAnimations().some(a=>a.effect.getKeyframes().some(f=>f.transform && f.transform!=='none'))),'save starts a bounded transform animation');
    assert.equal(await save.evaluate(e=>e.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>f.transform)).every(a=>a.effect.getTiming().iterations===1 && a.effect.getTiming().duration<=300)),true,'save is finite and brief');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.documentElement.dataset.motion==='reduce');
    assert.equal(await save.evaluate(e=>e.getAnimations().length),0,'OS cancels running save animation');
    await page.reload();await page.locator('[data-discovery-row]').first().waitFor();
    assert.equal(await save.getAttribute('aria-pressed'),'true','save persisted before animation completed');
    await save.click();assert.equal(await save.evaluate(e=>e.getAnimations().length),0);
    await page.goto(base+'/#settings');await page.locator('#workspace-motion').selectOption('reduce');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(base+'/#discover');
    await save.click();assert.equal(await save.evaluate(e=>e.getAnimations().length),0,'user reduction authoritative');
    await toggle.click();assert.equal(await page.evaluate(()=>document.getAnimations().length),0,'no sidebar animation with user reduction');
    assert.deepEqual(errors,[]);
    const blocked=await browser.newContext({viewport:{width:1440,height:900}});
    await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}));
    const denied=await blocked.newPage();await denied.goto(base+'/#settings');await denied.locator('#workspace-sidebar-toggle').click();
    await denied.goto(base+'/#help');assert.equal(await denied.locator('#workspace-sidebar-toggle').getAttribute('aria-expanded'),'false');
    await denied.locator('#workspace-sidebar-toggle').click();assert.equal(await denied.locator('[data-nav="settings"]').isVisible(),true);
  } finally {
    await browser?.close();await new Promise(resolve=>server.close(resolve));globalThis.fetch=originalFetch;
    if(process.env.TABBETTER_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.TABBETTER_SCREENSHOT_DIR,`sidebar-${engine}-metrics.json`),JSON.stringify(evidence,null,2));
  }
});
