// Recreate raster fallbacks from the canonical SVG. Uses an already installed
// Playwright, never downloads a package or browser. Run from the repository root:
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/render-brand-icons.mjs
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
if (!process.env.PLAYWRIGHT_MODULE) throw Error('Set PLAYWRIGHT_MODULE to an existing Playwright installation');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({deviceScaleFactor:1});
  const svg=fs.readFileSync('assets/mark-v2.svg','utf8');
  for (const [name,size] of [['favicon-16-v2.png',16],['favicon-32-v2.png',32],['touch-icon-v2.png',180]]) {
    await page.setViewportSize({width:size,height:size});
    await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>'+svg);
    await page.screenshot({path:'assets/'+name,omitBackground:true});
  }
} finally {await browser.close();}
// ICO is a directory of the exact PNG payloads, not a second drawing.
const images=[16,32].map(size=>({size,data:fs.readFileSync(`assets/favicon-${size}-v2.png`)}));
const directory=Buffer.alloc(6+16*images.length);
directory.writeUInt16LE(1,2);directory.writeUInt16LE(images.length,4);
let offset=directory.length;
images.forEach(({size,data},i)=>{
  const entry=6+i*16;directory[entry]=size;directory[entry+1]=size;
  directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);
  directory.writeUInt32LE(data.length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=data.length;
});
fs.writeFileSync('assets/favicon-v2.ico',Buffer.concat([directory,...images.map(image=>image.data)]));
fs.copyFileSync('assets/touch-icon-v2.png','assets/logo.png');
