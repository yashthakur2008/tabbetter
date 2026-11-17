import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function preferences(initial, blocked = false) {
  const values = new Map(initial ? [['tabbetter-workspace-v1', initial]] : []);
  const storage = { getItem(k) { if (blocked) throw Error('denied'); return values.get(k); }, setItem(k,v) { if (blocked) throw Error('denied'); values.set(k,v); } };
  const context = vm.createContext({});
  if (fs.existsSync('web/workspace.js')) vm.runInContext(fs.readFileSync('web/workspace.js', 'utf8'), context);
  assert.equal(typeof context.createWorkspacePreferences, 'function', 'workspace preferences API is implemented');
  return { prefs: context.createWorkspacePreferences(storage), values, storage, context };
}
test('workspace rejects invalid schema and unsafe preference values', () => {
  for (const raw of ['broken', 'null', '[]', '{"version":2,"textSize":"large"}', '{"version":1,"textSize":"huge","motion":"animate","tutorialEnabled":"false"}']) {
    const {prefs} = preferences(raw);
    assert.equal(prefs.get().textSize, 'default');
    assert.equal(prefs.get().motion, 'device');
    assert.equal(prefs.get().tutorialEnabled, true);
    assert.equal(prefs.get().dismissedVersion, 0);
    assert.equal(prefs.get().completedVersion, 0);
  }
});
test('validated preferences round trip with bounded storage and immutable snapshots', () => {
  const {prefs, values, storage, context} = preferences();
  prefs.update({textSize:'extra-large', motion:'reduce', tutorialEnabled:false, dismissedVersion:1, completedVersion:1, unknown:'bad'});
  const copy = prefs.get(); copy.textSize = 'bad';
  assert.equal(prefs.get().textSize, 'extra-large');
  const loaded = context.createWorkspacePreferences(storage).get();
  assert.equal(loaded.motion, 'reduce'); assert.equal(loaded.tutorialEnabled, false);
  assert.equal(loaded.completedVersion, 1); assert.equal(loaded.dismissedVersion, 1);
  assert.equal('unknown' in loaded, false);
  assert.equal(values.size, 1);
  prefs.update({textSize:'bad', motion:'force', completedVersion:999});
  assert.equal(prefs.get().textSize, 'extra-large');
  assert.equal(prefs.get().completedVersion, 1);
});
test('storage denial retains all choices for the current session', () => {
  const {prefs} = preferences(null, true);
  assert.doesNotThrow(() => prefs.update({textSize:'large', motion:'reduce', tutorialEnabled:false}));
  assert.equal(prefs.get().textSize, 'large'); assert.equal(prefs.get().tutorialEnabled, false);
  assert.equal(prefs.persistent(), false);
});
test('theme initializes without a permanent select and binds remounted settings without resetting session choices', () => {
  const source = fs.readFileSync('web/app.js', 'utf8');
  let select = null;
  const media = {matches:true, addEventListener(_,fn) { this.change=fn; }};
  const root = {dataset:{}};
  const context = vm.createContext({document:{querySelector:()=>select,documentElement:root},window:{matchMedia:()=>media},localStorage:{getItem:()=> 'midnight',setItem(){throw Error('denied');}}});
  vm.runInContext(source.slice(0,source.indexOf('document\n  .querySelectorAll("[data-nav]")')),context);
  assert.doesNotThrow(() => vm.runInContext('initTheme()',context));
  assert.equal(root.dataset.theme, 'midnight');
  select = {value:'',addEventListener(_,fn){this.change=fn;}};
  vm.runInContext('initTheme()',context);
  assert.equal(select.value, 'midnight');
  select.value='system'; select.change(); assert.equal(root.dataset.theme,'dark');
  media.matches=false; media.change(); assert.equal(root.dataset.theme,'light');
  select={value:'',addEventListener(_,fn){this.change=fn;}};
  vm.runInContext('initTheme()',context); assert.equal(select.value,'system');
});

test('malformed JSON is invalid data, not storage denial, and a valid write repairs it', () => {
  const {prefs,storage,context}=preferences('broken');
  assert.equal(prefs.get().textSize,'default');
  assert.equal(prefs.persistent(),true);
  prefs.update({textSize:'large'});
  assert.equal(prefs.persistent(),true);
  assert.equal(context.createWorkspacePreferences(storage).get().textSize,'large');
});
test('getItem rejection and setItem rejection are independent of malformed data and can recover', () => {
  const {context}=preferences();
  let readDenied=true, writeDenied=false;
  const values=new Map();
  const storage={
    getItem(key) { if(readDenied)throw Error('read denied'); return values.get(key); },
    setItem(key,value) { if(writeDenied)throw Error('write denied'); values.set(key,value); },
  };
  const prefs=context.createWorkspacePreferences(storage);
  assert.equal(prefs.persistent(),false);
  prefs.update({textSize:'large'});
  assert.equal(prefs.persistent(),true,'successful write restores persistence feedback');
  writeDenied=true;
  prefs.update({textSize:'extra-large'});
  assert.equal(prefs.get().textSize,'extra-large','write rejection retains session selection');
  assert.equal(prefs.persistent(),false);
  readDenied=false;writeDenied=false;
  prefs.update({motion:'reduce'});
  assert.equal(prefs.persistent(),true);
  const reloaded=context.createWorkspacePreferences(storage).get();
  assert.equal(reloaded.textSize,'extra-large');assert.equal(reloaded.motion,'reduce');
});
