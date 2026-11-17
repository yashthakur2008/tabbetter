import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Exercise the actual local-server callbacks with an injected failing worker.
// This verifies the HTTP boundary without booting a browser or touching upstream.
for(const file of ['scripts/test-schedule-live.mjs','tests/schedule-browser.test.mjs']) {
  test(`${file}: HTTP500 is generic and exception diagnostics remain server-side`,async()=>{
    const source=fs.readFileSync(file,'utf8');
    const match=/const server=http.createServer\(([\s\S]*?)\);\s*await new Promise/.exec(source);
    assert.ok(match,'locate real server request callback');
    const diagnostic=Error('private internal diagnostic'),logs=[];
    const context=vm.createContext({Request,Buffer,worker:{fetch:async()=>{throw diagnostic;}},console:{error:(...args)=>logs.push(args)}});
    const handler=vm.runInContext('('+match[1]+')',context);let status,body;
    await handler({url:'/'},{writeHead:value=>{status=value;},end:value=>{body=value;}});
    assert.equal(status,500);assert.equal(body,'Internal server error');
    assert.ok(logs.some(args=>args.includes(diagnostic)),'keep error object in server-side diagnostics');
  });
}
