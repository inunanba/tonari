import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {allocate,allocateReference,initialAllocation} from '../packages/protocol/allocator.mjs';
const vectors=JSON.parse(readFileSync(new URL('./allocator-golden.json',import.meta.url))).vectors;
function close(a,b){if(typeof b==='number'){assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);return;}if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((v,k)=>close(a[k],v));return;}if(b&&typeof b==='object'){for(const k of Object.keys(b))close(a[k],b[k]);return;}assert.equal(a,b);}
test('TypeScript allocation reference matches 128 exact original Python AST vectors',()=>{for(const v of vectors)close(allocateReference(v.before,v.input),v.expected);});
test('busy checkpoint loses rare chance immediately; no new suggestion until a boundary',()=>{
 const base={waits:Array(8).fill(0),boundary:true,nudge:2,budget:60,given:0,spotGiven:Array(8).fill(0)};let s=initialAllocation();
 for(let k=0;k<30;k++)s=allocate(s,base).state;
 const busy={...base,waits:[0,0,0,0,9,0,0,0],boundary:false},r=allocate(s,busy);assert.equal(r.chances[4],0);assert.equal(r.state.zones[2],0);assert.equal(r.suggestions[4],0);
  const quiet=allocate(r.state,{...base,boundary:false});assert.equal(quiet.suggestions[4],0);assert.equal(quiet.state.levels[4],0);
 const originalBusy=allocateReference(s,busy);assert.ok(allocateReference(originalBusy.state,{...base,boundary:false}).suggestions[4]>0,'original same-window reentry defect remains reproducible');
 assert.ok(allocate(quiet.state,base).suggestions[4]>0);
});
test('spent per-spot/total caps deny suggestions, malformed sensor inputs fail closed',()=>{
 const i={waits:Array(8).fill(0),boundary:true,nudge:2,budget:60,given:60,spotGiven:Array(8).fill(0)};assert.equal(allocate(initialAllocation(),i).suggestions,null);
 for(const value of [NaN,Infinity,-1])assert.throws(()=>allocate(initialAllocation(),{...i,waits:[value,0,0,0,0,0,0,0]}),/VECTOR/);
});
