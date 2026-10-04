import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {govern,governReference,initialGovernor,earlyMultiplier} from '../packages/protocol/allocator.mjs';
const vectors=JSON.parse(readFileSync(new URL('./governor-golden.json',import.meta.url))).vectors;
function close(a,b){if(typeof b==='number'){assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);return;}if(b&&typeof b==='object'){for(const k of Object.keys(b))close(a[k],b[k]);return;}assert.equal(a,b);}
test('governor reference matches 54 actual Python AST warning/window/early vectors',()=>{for(const v of vectors)close(governReference(v.before,v.input),v.expected);});
const input={time:0,target:4,waits:[0,0,0,0,7,0,0,0],induced10:[0,0,0,0,8,0,0,0],boundary:false,windowMinutes:6,early:false};
test('caused-arrival warning halves next frame only, respects refractory and recovers after a quiet window',()=>{
 let r=govern(initialGovernor(4),input);assert.equal(r.effectiveForFrame,4);assert.equal(r.state.effective,2);assert.equal(r.warning,true);
 r=govern(r.state,{...input,time:1.5});assert.equal(r.cut,false);assert.equal(r.state.effective,2);
 r=govern(r.state,{...input,time:2});assert.equal(r.cut,true);assert.equal(r.state.effective,1);
 const quiet={...input,time:6,boundary:true,waits:Array(8).fill(0),induced10:Array(8).fill(0)};
 r=govern(r.state,quiet);assert.equal(r.state.effective,1);assert.equal(r.state.hot,false);
 r=govern(r.state,{...quiet,time:12});assert.equal(r.state.effective,2);
 assert.equal(govern(initialGovernor(4),{...input,induced10:Array(8).fill(0)}).warning,false);
 assert.equal(govern(initialGovernor(4),{...input,waits:Array(8).fill(6)}).warning,false);
});
test('operator stop/low cap never increases during a warning; original restart defect is reproducible',()=>{
 for(const target of [0,.5,1,2,4,8]){
  const i={...input,target};const r=govern(initialGovernor(target),i);assert.ok(r.state.effective<=target);
 }
 assert.equal(governReference(initialGovernor(0),{...input,target:0}).state.effective,1);
 assert.equal(govern(initialGovernor(0),{...input,target:0}).state.effective,0);
 assert.equal(govern(initialGovernor(4),{...input,target:0}).effectiveForFrame,0);
 assert.equal(earlyMultiplier(0,true),1.5);assert.equal(earlyMultiplier(45,true),1.25);assert.equal(earlyMultiplier(90,true),1);assert.equal(earlyMultiplier(100,true),1);
 for(const time of [NaN,Infinity,-1])assert.throws(()=>govern(initialGovernor(),{...input,time}),/BAD_GOVERNOR_INPUT/);
 assert.throws(()=>govern(initialGovernor(),{...input,induced10:[.5,0,0,0,0,0,0,0]}),/VECTOR|BAD_GOVERNOR_INPUT/);
});
