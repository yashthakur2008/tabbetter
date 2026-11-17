import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function tutorial(blocked=false) {
  const context=vm.createContext({});
  for (const file of ['web/workspace.js','web/tutorial.js']) if(fs.existsSync(file)) vm.runInContext(fs.readFileSync(file,'utf8'),context);
  assert.equal(typeof context.createTutorialController,'function','tutorial controller is implemented');
  const store=new Map();
  const storage={getItem:k=>store.get(k),setItem(k,v){if(blocked) throw Error('denied');store.set(k,v);}};
  const prefs=context.createWorkspacePreferences(storage);
  const seen=[]; let closes=0; let syncs=0;
  const tour=context.createTutorialController(prefs,{show:step=>seen.push(step),hide:()=>closes++,sync:()=>syncs++});
  return {tour,prefs,seen,store,context,storage,closes:()=>closes,syncs:()=>syncs};
}
test('first-use offer is non-running and dismissal survives reload separately from completion',()=>{
  const {tour,prefs,context,storage}=tutorial();
  assert.equal(tour.offer(),true); assert.equal(tour.active(),false);
  tour.dismiss(); assert.equal(tour.offer(),false); assert.equal(prefs.get().completedVersion,0);
  const reloaded=context.createTutorialController(context.createWorkspacePreferences(storage),{});
  assert.equal(reloaded.offer(),false); assert.equal(reloaded.active(),false);
});
test('six-step tutorial bounds back/next and records completion only on Finish',()=>{
  const {tour,prefs,seen,closes}=tutorial();
  tour.start(); tour.back(); assert.equal(seen.at(-1),0);
  for(let i=0;i<8;i++) tour.next();
  assert.equal(seen.at(-1),5); assert.equal(tour.active(),true); assert.equal(prefs.get().completedVersion,0);
  tour.back(); assert.equal(seen.at(-1),4); tour.next(); tour.finish();
  assert.equal(tour.active(),false); assert.equal(prefs.get().completedVersion,1); assert.equal(tour.offer(),false); assert.equal(closes(),1);
});
test('off closes immediately; on never interrupts; replay deliberately enables with synchronized state',()=>{
  const {tour,prefs,syncs}=tutorial();
  tour.start(); tour.setEnabled(false); assert.equal(tour.active(),false); assert.equal(tour.offer(),false);
  tour.setEnabled(true); assert.equal(tour.active(),false); assert.equal(tour.offer(),false);
  tour.setEnabled(false); tour.start(); assert.equal(prefs.get().tutorialEnabled,true); assert.equal(tour.active(),true); assert.ok(syncs()>0);
  tour.stop(); assert.equal(tour.active(),false); assert.equal(prefs.get().completedVersion,0); assert.equal(tour.offer(),false);
});
test('blocked storage preserves close, completion, disabling and replay within the session',()=>{
  const {tour,prefs}=tutorial(true);
  tour.dismiss(); assert.equal(tour.offer(),false); tour.start(); tour.stop();
  assert.equal(tour.offer(),false); tour.start(); for(let i=0;i<5;i++)tour.next(); tour.finish();
  assert.equal(prefs.get().completedVersion,1); tour.setEnabled(false); tour.start(); assert.equal(tour.active(),true);
});
