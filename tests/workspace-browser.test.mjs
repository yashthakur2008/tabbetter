// Opt-in real Chromium/Firefox/WebKit checks against the compiled Worker, with no API fixtures.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs BROWSER_ENGINE=webkit node --test tests/workspace-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.js';
const modulePath=process.env.PLAYWRIGHT_MODULE;
const engineName=process.env.BROWSER_ENGINE || 'chromium';
async function assertFocusCycle(page, dialog, selectors) {
  for (const key of ['Tab','Shift+Tab']) {
    await page.locator(selectors[0]).focus();
    for (let i=1;i<=selectors.length*2;i++) {
      await page.keyboard.press(key);
      const index=key==='Tab' ? i%selectors.length : (selectors.length-i%selectors.length)%selectors.length;
      assert.equal(await page.evaluate(selector=>document.activeElement.matches(selector),selectors[index]),true,`${engineName} ${key} must reach ${selectors[index]}`);
      assert.equal(await page.evaluate(selector=>document.activeElement.closest(selector)!==null,dialog),true);
      assert.equal(await page.evaluate(()=>document.hasFocus()),true);
    }
  }
}
async function screenshot(page, name) {
  const directory=process.env.TABBETTER_SCREENSHOT_DIR;
  if (!directory) return;
  fs.mkdirSync(directory,{recursive:true});
  await page.screenshot({path:path.join(directory,name+'.png'),fullPage:true});
}
async function withCompiledBrowser(run) {
  const playwright=await import(pathToFileURL(modulePath));
  assert.ok(['chromium','firefox','webkit'].includes(engineName),'supported browser engine');
  const server=http.createServer(async(req,res)=>{
    try {
      const response=await worker.fetch(new Request('http://localhost'+req.url),{}, {waitUntil:p=>p.catch(()=>{})});
      res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch(error) {console.error('Workspace browser test server request failed:',error);res.writeHead(500);res.end('Internal server error');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await playwright[engineName].launch({headless:true});
    await run(browser,`http://127.0.0.1:${server.address().port}`);
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
test(`compiled workspace (${engineName}): settings, tutorial, keyboard, drawer and storage fallback`, {skip:!modulePath}, ()=>withCompiledBrowser(async(browser,base)=>{
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
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tutorial-title','initial heading focus remains');
    await assertFocusCycle(page,'#tutorial-dialog',['#tutorial-close','#tutorial-next']);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tutorial-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tutorial-replay');
    await page.locator('#tutorial-replay').click();
    await page.locator('#tutorial-next').click();
    await assertFocusCycle(page,'#tutorial-dialog',['#tutorial-close','#tutorial-back','#tutorial-next']);
    await page.locator('#tutorial-back').click();
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
    await assertFocusCycle(page,'#tutorial-dialog',['#tutorial-close','#tutorial-back','#tutorial-settings','#tutorial-finish']);
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
    await assertFocusCycle(page,'#workspace-drawer',[
      '#workspace-drawer-close', '[data-nav="discover"]', '[data-nav="saved"]',
      '[data-nav="circuits"]', '[data-nav="rankings"]', '[data-nav="results"]',
      '[data-nav="help"]', '#workspace-navigation a[href="#about"]',
      '[data-nav="judging"]', '[data-nav="paradigms"]', '[data-nav="account"]',
      '#workspace-navigation a[href="https://www.tabroom.com/user/home.mhtml"]', '[data-nav="settings"]',
    ]);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-menu');
    await page.locator('#workspace-menu').click();
    await page.locator('#workspace-drawer [data-nav="saved"]').click();
    assert.equal(await page.locator('#workspace-drawer').isVisible(),false);
    await page.waitForURL('**/#saved');
    await page.locator('#workspace-menu').click();
    await page.locator('#workspace-drawer [data-nav="settings"]').click(); await page.locator('#theme').waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#workspace-motion').selectOption('device');
    await page.waitForFunction(()=>document.documentElement.dataset.motion==='reduce');
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
}));

for (const focused of ['#workspace-drawer-close','[data-nav="saved"]']) {
  test(`compiled workspace (${engineName}): desktop resize restores focus from ${focused}`, {skip:!modulePath}, ()=>withCompiledBrowser(async(browser,base)=>{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(base+'/#settings');
    await page.locator('#workspace-menu').click();
    await page.locator(focused).focus();
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#workspace-drawer').waitFor({state:'hidden'});
    const destination=focused==='#workspace-drawer-close' ? '[data-nav="settings"]' : focused;
    assert.equal(await page.evaluate(selector=>document.activeElement.matches(selector),destination),true,'focus returns to visible desktop destination');
    assert.equal(await page.locator(destination).isVisible(),true);
    assert.equal(await page.evaluate(()=>document.hasFocus()),true);
    assert.equal(await page.locator('#workspace-menu').getAttribute('aria-expanded'),'false');
  }));
}
test(`compiled workspace (${engineName}): malformed preferences recover truthful persistence status`, {skip:!modulePath}, ()=>withCompiledBrowser(async(browser,base)=>{
  const page=await browser.newPage();
  await page.goto(base+'/#settings');
  await page.evaluate(()=>localStorage.setItem('tabbetter-workspace-v1','broken'));
  await page.reload();
  assert.equal(await page.locator('#workspace-text-size').inputValue(),'default');
  await page.locator('#workspace-text-size').selectOption('large');
  assert.match(await page.locator('#workspace-persistence').textContent(),/Saved locally/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tabbetter-workspace-v1')).textSize),'large');
  await page.reload();
  assert.equal(await page.locator('#workspace-text-size').inputValue(),'large');
  assert.match(await page.locator('#workspace-persistence').textContent(),/Saved locally/);
}));

for (const focused of ['#workspace-sidebar-toggle','[data-nav="saved"]']) {
  test(`compiled workspace (${engineName}): mobile resize restores visible focus from ${focused}`, {skip:!modulePath}, ()=>withCompiledBrowser(async(browser,base)=>{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.goto(base+'/#settings');await page.locator(focused).focus();
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>document.activeElement.id==='workspace-menu',{},{timeout:3000});
    assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-menu','breakpoint must not leave focus in hidden desktop chrome');
    await page.keyboard.press('Enter');assert.equal(await page.locator('#workspace-drawer').isVisible(),true);
  }));
}
