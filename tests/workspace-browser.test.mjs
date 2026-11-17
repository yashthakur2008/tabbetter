// Opt-in real Chromium checks against the compiled Worker, with no API fixtures.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node --test tests/workspace-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.js';
const modulePath=process.env.PLAYWRIGHT_MODULE;
async function screenshot(page, name) {
  const directory=process.env.TABBETTER_SCREENSHOT_DIR;
  if (!directory) return;
  fs.mkdirSync(directory,{recursive:true});
  await page.screenshot({path:path.join(directory,name+'.png'),fullPage:true});
}
test('compiled workspace: settings, tutorial, keyboard, drawer and storage fallback', {skip:!modulePath}, async()=>{
  const {chromium}=await import(pathToFileURL(modulePath));
  const server=http.createServer(async(req,res)=>{
    try {
      const response=await worker.fetch(new Request('http://localhost'+req.url),{}, {waitUntil:p=>p.catch(()=>{})});
      res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch(error) {console.error('Workspace browser test server request failed:',error);res.writeHead(500);res.end('Internal server error');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/#help');
    assert.equal(await page.locator('[data-nav="settings"]').count(),1,'persistent settings destination');
    assert.equal(await page.locator('[data-nav="settings"]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true,'settings fits in lower sidebar without page scrolling');
    assert.equal(await page.locator('#tutorial-welcome').isVisible(),true);
    assert.equal(await page.locator('dialog[open]').count(),0,'welcome is nonmodal');
    await page.locator('#tutorial-not-now').click(); await page.reload();
    assert.equal(await page.locator('#tutorial-welcome').isVisible(),false);
    await page.locator('[data-nav="settings"]').click(); await page.waitForURL('**/#settings');
    await page.locator('#theme').selectOption('midnight');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tabbetter-theme')),'midnight');
    await page.locator('#workspace-text-size').selectOption('extra-large');
    await page.locator('#workspace-motion').selectOption('reduce');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduce');
    assert.equal(await page.evaluate(()=>document.querySelector('#workspace-sidebar-slot').getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom),true,'sidebar does not overlap large-text header');
    const normalSize=await page.locator('#theme').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    assert.ok(normalSize>=18,'settings text scales');
    assert.equal(await page.locator('[data-nav="settings"]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true,'Settings remains visible with extra-large sidebar text');
    await screenshot(page,'task1-settings-desktop-extra-large');
    await page.locator('#tutorial-enabled').uncheck();
    await page.reload();
    assert.equal(await page.locator('#tutorial-enabled').isChecked(),false,'disabled state survives reload');
    assert.equal(await page.locator('#tutorial-welcome').isVisible(),false);
    await page.locator('#tutorial-enabled').check();
    assert.equal(await page.locator('dialog[open]').count(),0,'enabling never interrupts');
    await page.locator('#tutorial-enabled').uncheck();
    await page.locator('#tutorial-replay').click();
    assert.equal(await page.locator('#tutorial-enabled').isChecked(),true);
    await page.locator('#tutorial-dialog').waitFor({state:'visible'});
    assert.match(await page.locator('#tutorial-step-count').textContent(),/1 of 6/);
    for (const key of ['Tab','Shift+Tab']) for (let i=0;i<12;i++) {
      await page.keyboard.press(key);
      assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')?.id),'tutorial-dialog', 'tutorial focus stays inside on '+key);
    }
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')?.id),'tutorial-dialog');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')?.id),'tutorial-dialog');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tutorial-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tutorial-replay');
    await page.locator('#tutorial-replay').click();
    await page.locator('#tutorial-next').click(); await page.locator('#tutorial-back').click();
    assert.match(await page.locator('#tutorial-step-count').textContent(),/1 of 6/);
    for(let i=0;i<5;i++) {
      await page.locator('#tutorial-next').click();
      if(i===2) {
        assert.equal(await page.locator('#tutorial-illustration').isVisible(),true,'missing tournament uses a noninteractive illustration');
        assert.equal(await page.locator('#tutorial-illustration button, #tutorial-illustration a, #tutorial-illustration select').count(),0);
        assert.equal(new URL(page.url()).hash,'#settings','tour never changes route automatically');
      }
    }
    assert.match(await page.locator('#tutorial-dialog').textContent(),/You can turn this tutorial on or off in Settings → Tutorial. You can replay it there anytime\./);
    await screenshot(page,'task1-tutorial-final');
    await page.locator('#tutorial-finish').click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tabbetter-workspace-v1')).completedVersion),1);
    await page.reload(); assert.equal(await page.locator('dialog[open]').count(),0);
    await page.locator('#tutorial-replay').click();
    for(let i=0;i<5;i++)await page.locator('#tutorial-next').click();
    await page.locator('#tutorial-settings').click();
    assert.equal(await page.locator('#tutorial-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tutorial-enabled');
    await page.locator('#tutorial-replay').click();
    await page.evaluate(()=>location.hash='about'); await page.waitForURL('**/#about');
    assert.equal(await page.locator('#tutorial-dialog').isVisible(),false,'route stops active tour');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'app','route cleanup keeps focus on persistent workspace');
    await page.goBack();await page.locator('#theme').waitFor();
    assert.equal(await page.locator('#theme').inputValue(),'midnight');
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`no settings overflow at ${width}`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#workspace-menu').click();
    assert.equal(await page.locator('#workspace-drawer').isVisible(),true);
    assert.equal(await page.locator('[data-nav="settings"]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true,'drawer keeps Settings visible with extra-large text');
    await screenshot(page,'task1-mobile-drawer-extra-large');
    for(const key of ['Tab','Shift+Tab']) for(let i=0;i<18;i++) {
      await page.keyboard.press(key);
      assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')?.id),'workspace-drawer');
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-menu');
    await page.locator('#workspace-menu').click();
    await page.locator('#workspace-drawer [data-nav="saved"]').click();
    assert.equal(await page.locator('#workspace-drawer').isVisible(),false);
    await page.waitForURL('**/#saved');
    await page.locator('#workspace-menu').click();
    await page.locator('#workspace-drawer [data-nav="settings"]').click(); await page.locator('#theme').waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#workspace-motion').selectOption('device');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduce','OS always wins');
    await page.locator('#tutorial-replay').click();
    await page.evaluate(()=>tutorialController.setEnabled(false));
    assert.equal(await page.locator('#tutorial-dialog').isVisible(),false,'disabling closes active tutorial');
    assert.deepEqual(errors,[]);
    await context.close();
    const blocked=await browser.newContext();
    await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError');}});});
    const denied=await blocked.newPage(); const deniedErrors=[];denied.on('pageerror',e=>deniedErrors.push(e.message));
    await denied.goto(base+'/#settings');
    await denied.locator('#theme').selectOption('dark');
    await denied.locator('#workspace-text-size').selectOption('large');
    await denied.locator('#tutorial-replay').click(); await denied.locator('#tutorial-close').click();
    await denied.locator('[data-nav="help"]').click(); await denied.locator('[data-nav="settings"]').click();
    assert.equal(await denied.locator('#theme').inputValue(),'dark');
    assert.equal(await denied.locator('#workspace-text-size').inputValue(),'large');
    assert.equal(await denied.locator('#tutorial-welcome').isVisible(),false);
    assert.deepEqual(deniedErrors,[]);await blocked.close();
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
