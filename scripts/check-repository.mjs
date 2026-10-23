import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=files.filter(p=>p.startsWith('.openai/')||p.startsWith('worker/')||p.startsWith('dist/')||/(^|\/)\.env(\.|$)/.test(p)&&!p.endsWith('.example')||/\.(pem|p12|key|tar\.gz)$/.test(p));
if(forbidden.length)throw Error('Unpublishable files tracked: '+forbidden.join(', '));
for(const file of files.filter(p=>/\.(mjs|js)$/.test(p)))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
if(fs.existsSync('ui.html')){const html=fs.readFileSync('ui.html','utf8');for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:'ui.html'});}
console.log('Repository hygiene and source syntax passed.');
