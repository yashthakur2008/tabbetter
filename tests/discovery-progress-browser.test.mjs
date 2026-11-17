// Real compiled Worker/DOM regression. Gate only external Tabroom responses so
// the manual second metadata batch stays pending until the assertions finish.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.js';
const modulePath=process.env.PLAYWRIGHT_MODULE;
const engine=process.env.BROWSER_ENGINE || 'chromium';
const records=Array.from({length:24},(_,i)=>({id:String(94001+i),name:'Published tournament '+String(i+1).padStart(2,'0')}));

test(`metadata progress (${engine}): manual pending feedback stays visible until the last batch completes`,{skip:!modulePath},async()=>{
  const playwright=await import(pathToFileURL(modulePath));
  if(process.env.TABBETTER_SCREENSHOT_DIR)fs.mkdirSync(process.env.TABBETTER_SCREENSHOT_DIR,{recursive:true});
  const originalFetch=globalThis.fetch;
  let release, started, delayedRequests=0;
  const gate=new Promise(resolve=>{release=resolve;});
  const secondBatchStarted=new Promise(resolve=>{started=resolve;});
  globalThis.fetch=async input=>{
    const url=new URL(typeof input==='string'?input:input.url);
    assert.equal(url.hostname,'www.tabroom.com');
    if(url.pathname==='/index/index.mhtml') return new Response('<table id="tournlist">'+records.map(r=>'<tr><td data-text="2026-46-1">11/16</td><td><a href="/index/tourn/main.mhtml?tourn_id='+r.id+'">'+r.name+'</a></td><td>San Jose</td><td><a href="index.mhtml?state=CA">CA</a></td><td><i title="Tournament has in-person events"></i></td><td>Due 11/15</td><td></td></tr>').join('')+'</table>');
    const record=records.find(r=>r.id===url.searchParams.get('tourn_id'));
    if(record && Number(record.id)>=94013){delayedRequests++;started();await gate;}
    if(url.pathname==='/api/download_data.mhtml'&&record) return Response.json({...record,public:'true',start:'2026-11-16',end:'2026-11-18',timezone:'America/Los_Angeles',schools:[],categories:[{name:'Speech',judges:[],events:[{id:'1',name:'Original Oratory',type:'speech',rounds:[]}]}]});
    if(url.pathname==='/index/tourn/main.mhtml'&&record) return new Response('<h2>'+record.name+'</h2><p>Published invitation.</p>');
    return new Response('Not published',{status:404});
  };
  const server=http.createServer(async(req,res)=>{
    try {const response=await worker.fetch(new Request('http://localhost'+req.url),{},{waitUntil:p=>p.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
    catch(error){console.error('Metadata progress browser server request failed:',error);res.writeHead(500);res.end('Internal server error');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;const evidence={engine};
  try {
    browser=await playwright[engine].launch({headless:true});
    const page=await browser.newPage({viewport:{width:390,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>document.querySelector('#discovery-coverage')?.textContent.startsWith('12 of 24'));
    await page.locator('#tutorial-not-now').click();
    const action=page.locator('#discovery-check-next');
    assert.equal(await action.isVisible(),true);assert.equal(await action.isEnabled(),true);
    assert.equal(await action.textContent(),'Check next 12');
    assert.equal(await page.locator('[data-discovery-row]').count(),24);
    const partialCoverage=await page.locator('#discovery-coverage').textContent();
    assert.match(partialCoverage,/12 with published details.*Matches may be incomplete/);
    await action.click();
    await Promise.race([secondBatchStarted,new Promise((_,reject)=>{setTimeout(()=>reject(Error('No delayed external metadata request started')),10000).unref();})]);
    evidence.pending=await page.evaluate(()=>({text:document.querySelector('#discovery-check-next').textContent,display:getComputedStyle(document.querySelector('#discovery-check-next')).display,coverage:document.querySelector('#discovery-coverage').textContent,unchecked:[...document.querySelectorAll('[data-discovery-row]')].filter(row=>row.innerText.includes('Details not checked')).length}));
    assert.ok(delayedRequests>0,'actual upstream response remains gated');
    assert.equal(await action.isVisible(),true,'busy metadata action must not disappear with disabled state');
    assert.equal(await action.isDisabled(),true,'pending action prevents duplicate checks');
    assert.equal(await action.textContent(),'Checking published details…');
    assert.equal(await page.locator('#discovery-coverage').textContent(),partialCoverage,'partial coverage remains truthful while checking');
    assert.equal(evidence.pending.unchecked,12,'unreturned details must not appear checked');
    assert.equal(await page.locator('#discovery-check-status').getAttribute('role'),'status');
    assert.equal(await page.locator('#discovery-check-status').getAttribute('aria-live'),'polite');
    assert.match(await page.locator('#discovery-check-status').innerText(),/Checking published details/);
    if(process.env.TABBETTER_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.TABBETTER_SCREENSHOT_DIR,`task2-${engine}-metadata-pending.png`),fullPage:true});
    release();
    await page.waitForFunction(()=>document.querySelector('#discovery-coverage')?.textContent.startsWith('24 of 24'));
    assert.equal(await action.isVisible(),false,'idle exhausted action stays out of compact layout');
    assert.equal(await action.isDisabled(),true);
    assert.match(await page.locator('#discovery-coverage').textContent(),/24 with published details/);
    assert.equal(await page.locator('#discovery-check-status').innerText(),'','busy feedback clears on completion');
    assert.doesNotMatch(await page.locator('#discovery-results').innerText(),/Details not checked/);
    evidence.completed={coverage:await page.locator('#discovery-coverage').textContent(),actionVisible:await action.isVisible()};
    assert.deepEqual(errors,[]);
  } finally {
    release();await browser?.close();await new Promise(resolve=>server.close(resolve));globalThis.fetch=originalFetch;
    if(process.env.TABBETTER_SCREENSHOT_DIR){fs.mkdirSync(process.env.TABBETTER_SCREENSHOT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.TABBETTER_SCREENSHOT_DIR,`task2-${engine}-metadata-progress.json`),JSON.stringify(evidence,null,2));}
  }
});
