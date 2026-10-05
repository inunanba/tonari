import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,normalize,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),swPath=resolve(root,'apps/web/sw.mjs');
const local=p=>normalize(relative(root,resolve(dirname(swPath),p))).replaceAll('\\','/');
test('service worker precache closes the static module import graph for offline reload',async()=>{
 const sw=await readFile(swPath,'utf8'),assetPattern=/['"]([^'"]+\.(?:mjs|html|css))['"]/g;
 const cached=new Set([...sw.matchAll(assetPattern)].map(m=>local(m[1])));
 for(const required of ['packages/protocol/storage.mjs','packages/protocol/claim-store.mjs','packages/protocol/drop.mjs','packages/protocol/claims.mjs'])assert.ok(cached.has(required),`missing offline asset ${required}`);
 const missing=[];
 for(const file of [...cached].filter(x=>x.endsWith('.mjs'))){
  const source=await readFile(resolve(root,file),'utf8'),imports=source.matchAll(/(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g);
  for(const match of imports){if(!match[1].startsWith('.'))continue;const dependency=normalize(relative(root,resolve(dirname(resolve(root,file)),match[1]))).replaceAll('\\','/');if(!cached.has(dependency))missing.push(`${file} -> ${dependency}`);}
 }
 assert.deepEqual(missing,[],'offline module dependencies must be explicitly precached');
 assert.match(sw,/tonari-shell-v0\.7\.6/);
});
