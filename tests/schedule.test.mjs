import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {source4slots} from './fixtures/schedule-41209.mjs';
function api() {
  const c=vm.createContext({Intl,Date});
  if(fs.existsSync('web/schedule.js')) vm.runInContext(fs.readFileSync('web/schedule.js','utf8'),c);
  assert.equal(typeof c.analyzeSchedule,'function','focused schedule API is implemented');
  return c;
}
const tournament={id:'41209',name:'CFL Super Debate 1',timezone:'America/Los_Angeles',timeslots:source4slots};
test('exact four public slots require interpretation, never silently become UTC',()=>{
  const a=api(); const unresolved=a.analyzeSchedule(tournament,'');
  assert.equal(unresolved.status,'choice'); assert.match(unresolved.message,/Timezone not specified in source/);
  assert.equal(unresolved.rows.length,4); assert.match(unresolved.rows[0].startLabel,/15:30/);
  for(const [choice,first,last] of [['UTC','20261024T153000Z','20261025T003000Z'],['America/Los_Angeles','20261024T223000Z','20261025T073000Z']]) {
    const result=a.analyzeSchedule(tournament,choice); assert.equal(result.status,'ready');
    const ics=a.scheduleICS(tournament,result,new Date('2026-11-17T20:00:00Z'));
    assert.equal(ics.match(/BEGIN:VEVENT/g).length,4);
    assert.match(ics,new RegExp('DTSTART:'+first));assert.match(ics,new RegExp('DTEND:'+last));
    assert.equal(ics.match(/DTSTAMP:20261117T200000Z/g).length,4);
    assert.equal(new Set([...ics.matchAll(/UID:(.*)/g)].map(m=>m[1])).size,4);
    assert.equal(ics.replaceAll('\r\n','').includes('\n'),false);
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  }
  assert.throws(()=>a.scheduleICS(tournament,unresolved),/interpret|choice/i);
});
test('T, space, explicit Z and numeric offsets including mixed ranges resolve consistently',()=>{
  const a=api();
  for(const [start,end] of [['2026-10-24 15:30:00','2026-10-24T17:15:00'],['2026-10-24T15:30:00Z','2026-10-24 10:15:00-07:00'],['2026-10-24T17:30:00+02:00','2026-10-24T17:15:00Z']]) {
    const r=a.analyzeSchedule({...tournament,timeslots:[{name:'Round',start,end}]},'UTC');
    assert.equal(r.status,'ready'); assert.equal(r.rows[0].start,new Date('2026-10-24T15:30:00Z').getTime());
    assert.equal(r.rows[0].end,new Date('2026-10-24T17:15:00Z').getTime());
  }
  const zoned=a.analyzeSchedule({...tournament,timeslots:[{start:'2026-10-24T15:30:00Z',end:'2026-10-24T17:15:00Z'}]},'');
  assert.equal(zoned.status,'ready');assert.equal(zoned.needsChoice,false);
  const mixed=a.analyzeSchedule({...tournament,timeslots:[{start:'2026-10-24T15:30:00Z',end:'2026-10-24T17:15:00'}]},'');
  assert.equal(mixed.status,'choice'); assert.match(mixed.rows[0].startLabel,/PDT/); assert.match(mixed.rows[0].endLabel,/17:15/);
});
test('calendar validity, missing fields and reversed ranges block entire export rather than dropping events',()=>{
  const a=api();
  for(const start of ['2026-02-29T15:30:00','2026-04-31 15:30:00','2026-10-24T24:00:00','2026-10-24T15:60:00','2026-10-24T15:30:60','2026-10-24T15:30:00+25:00','nonsense','']) {
    const r=a.analyzeSchedule({...tournament,timeslots:[...source4slots,{start,end:'2026-10-25T17:15:00'}]},'UTC');
    assert.equal(r.status,'invalid',start);assert.match(r.message,/invalid|malformed/i);
    assert.throws(()=>a.scheduleICS(tournament,r));
  }
  for(const end of ['2026-10-24T15:30:00','2026-10-23T15:30:00'])assert.equal(a.analyzeSchedule({...tournament,timeslots:[{start:source4slots[0].start,end}]},'UTC').status,'invalid');
  assert.equal(a.analyzeSchedule({...tournament,timeslots:[{start:'2024-02-29T23:30:00',end:'2024-03-01T00:30:00'}]},'UTC').status,'ready');
  assert.equal(a.analyzeSchedule({...tournament,timeslots:[]},'UTC').status,'empty');
});
test('DST gaps/folds and invalid tournament zones produce precise blocking feedback',()=>{
  const a=api();
  for(const [start,end,pattern] of [['2026-03-08T02:30:00','2026-03-08T04:00:00',/nonexistent/i],['2026-11-01T01:30:00','2026-11-01T03:00:00',/ambiguous/i]]) {
    const r=a.analyzeSchedule({...tournament,timeslots:[{name:'DST round',start,end}]},'America/Los_Angeles');
    assert.equal(r.status,'invalid');assert.match(r.message,pattern);
  }
  const invalid=a.analyzeSchedule({...tournament,timezone:'Not/AZone'},'UTC');
  assert.equal(invalid.status,'invalid');assert.match(invalid.message,/timezone/i);
  assert.equal(a.analyzeSchedule({...tournament,timezone:''},'UTC').status,'invalid');
});
test('ICS escaping prevents injected properties and folds long Unicode lines by UTF-8 octets',()=>{
  const a=api(); const d={...tournament,name:'Speech, debate; \\ club\r\nINJECT:bad',timeslots:[{...source4slots[0],name:'é'.repeat(80)}]};
  const ics=a.scheduleICS(d,a.analyzeSchedule(d,'UTC'),new Date('2026-11-17T20:00:00Z'));
  const unfolded=ics.replaceAll('\r\n ','');
  assert.match(unfolded,/Speech\\, debate\\; \\\\ club\\nINJECT:bad/);assert.ok(!ics.includes('\r\nINJECT:'));
  for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
test('interpretation state preserves current tournament, clears on switch, and rejects unoffered choices',()=>{
  const a=api(), state=a.createScheduleChoice();
  state.enter('41209');state.choose('UTC',['UTC','America/Los_Angeles']);state.enter('41209');assert.equal(state.get(),'UTC');
  state.enter('41210');assert.equal(state.get(),'');state.enter('41209');assert.equal(state.get(),'');
  state.choose('Europe/London',['UTC','America/Los_Angeles']);assert.equal(state.get(),'');
});
test('UTC options deduplicate and offset-bearing times are unaffected by interpretation',()=>{
  const a=api();
  for(const timezone of ['UTC','Etc/UTC'])assert.deepEqual(Array.from(a.analyzeSchedule({...tournament,timezone},'').options),['UTC']);
  const d={...tournament,timeslots:[{start:'2026-10-24T15:30:00-07:00',end:'2026-10-25T00:30:00+02:00'}]};
  // Equal endpoints describe an invalid interval even with different wall dates.
  assert.equal(a.analyzeSchedule(d,'UTC').status,'invalid');
  d.timeslots[0].end='2026-10-25T01:30:00+02:00';
  assert.equal(a.analyzeSchedule(d,'').rows[0].start,a.analyzeSchedule(d,'America/Los_Angeles').rows[0].start);
});
test('non-hour DST and skipped civil dates are never guessed',()=>{
  const a=api();
  for(const [timezone,start,end,pattern] of [
    ['Australia/Lord_Howe','2026-04-05T01:45:00','2026-04-05T03:00:00',/Ambiguous/],
    ['Australia/Lord_Howe','2026-10-04T02:15:00','2026-10-04T04:00:00',/Nonexistent/],
    ['Pacific/Apia','2011-12-30T10:00:00','2011-12-31T10:00:00',/Nonexistent/],
  ]) {
    const r=a.analyzeSchedule({...tournament,timezone,timeslots:[{start,end}]},timezone);
    assert.equal(r.status,'invalid');assert.match(r.message,pattern);
  }
});
test('invalid tournament timezone does not substitute a UTC display zone',()=>{
  const a=api();
  const r=a.analyzeSchedule({...tournament,timezone:'Not/AZone'},'UTC');
  assert.equal(r.status,'invalid');
  assert.match(r.rows[0].startLabel,/2026-10-24 15:30:00/);
  assert.doesNotMatch(r.rows[0].startLabel,/UTC|PDT/);
});
test('validated tournament IANA alias is offered under its published name',()=>{
  const a=api(), d={...tournament,timezone:'US/Pacific'};
  assert.deepEqual(Array.from(a.analyzeSchedule(d,'').options),['UTC','US/Pacific']);
  assert.equal(a.analyzeSchedule(d,'US/Pacific').status,'ready');
});
test('explicit-only instants export without tournament timezone using disclosed UTC presentation',()=>{
  const a=api();
  for(const timezone of ['', 'Not/AZone'])for(const [start,end] of [
    ['2026-10-24T15:30:00Z','2026-10-24T17:15:00Z'],
    ['2026-10-24T08:30:00-07:00','2026-10-24T19:15:00+02:00'],
    ['2026-10-24T15:30:00Z','2026-10-24T10:15:00-07:00'],
  ]) {
    const d={...tournament,timezone,timeslots:[{name:'Explicit round',start,end}]},r=a.analyzeSchedule(d,'');
    assert.equal(r.status,'ready');assert.equal(r.needsChoice,false);
    assert.match(r.message,/tournament timezone.*(?:not published|invalid)/i);
    assert.match(r.message,/displayed in UTC/i);assert.match(r.rows[0].startLabel,/3:30 PM UTC/);
    assert.equal(d.timezone,timezone,'display fallback must not invent source metadata');
    const ics=a.scheduleICS(d,r);assert.match(ics,/DTSTART:20261024T153000Z/);assert.match(ics,/DTEND:20261024T171500Z/);
  }
});
test('missing or invalid tournament zone never auto-interprets mixed or offsetless values',()=>{
  const a=api();
  for(const timezone of ['', 'Not/AZone'])for(const start of ['2026-10-24T15:30:00Z','2026-10-24T15:30:00']) {
    const d={...tournament,timezone,timeslots:[{start,end:'2026-10-24T17:15:00'}]};
    const r=a.analyzeSchedule(d,'');assert.equal(r.status,'invalid');assert.equal(r.needsChoice,true);
    assert.equal(r.rows[0].end,null);assert.throws(()=>a.scheduleICS(d,r));
  }
});
