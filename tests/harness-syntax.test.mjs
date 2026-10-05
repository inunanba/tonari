import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('host-only integration harnesses and operator tools parse before dispatch',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 for(const directory of ['tests','tools'])for(const file of readdirSync(new URL(`../${directory}/`,import.meta.url))){
  if(!/\.(mjs|cjs)$/.test(file)||file.endsWith('.test.mjs'))continue;
  const result=spawnSync(process.execPath,['--check',`${directory}/${file}`],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,`${directory}/${file}: ${result.stderr||result.error||'syntax check failed'}`);
 }
});
