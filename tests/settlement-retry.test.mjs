import test from 'node:test';
import assert from 'node:assert/strict';
import {SettlementRetry} from '../apps/web/settlement-retry.mjs';
test('default timers retain the browser global receiver during restored receipt start and cleanup',()=>{
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let scheduled=0,cleared=0;
 globalThis.setTimeout=function(fn,ms){assert.equal(this,globalThis,'native browser setTimeout requires its Window receiver');assert.equal(typeof fn,'function');assert.equal(ms,2000);scheduled++;return 42;};
 globalThis.clearTimeout=function(id){assert.equal(this,globalThis,'native browser clearTimeout requires its Window receiver');assert.equal(id,42);cleared++;};
 try{const sync=new SettlementRetry({attempt:async()=>({done:true}),isPending:()=>true,isOnline:()=>false});sync.start();assert.equal(scheduled,1);sync.stop();assert.equal(cleared,1);assert.equal(sync.timer,null);}finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
function fixture(attempt){
 let seq=0;const timers=new Map(),state={pending:true,online:false,visible:true};
 const sync=new SettlementRetry({attempt,isPending:()=>state.pending,isOnline:()=>state.online,isVisible:()=>state.visible,setTimer:fn=>{timers.set(++seq,fn);return seq;},clearTimer:id=>timers.delete(id)});
 const tick=async()=>{const [id,fn]=timers.entries().next().value||[];assert.ok(fn,'expected timer');timers.delete(id);await fn();};return {sync,state,timers,tick};
}
test('restored provisional receipt settles after transport recovery without any online event',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;f.state.pending=false;return {done:true};});f.sync.start();await f.tick();assert.equal(calls,0);assert.equal(f.sync.attempts,0);
 f.state.online=true;await f.tick();assert.equal(calls,1);assert.equal(f.timers.size,0);assert.equal(f.sync.active,false);
});
test('transient network errors are bounded to three automatic sends; manual retry remains usable',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {done:false,retryable:true};});f.state.online=true;f.sync.start();await f.tick();await f.tick();await f.tick();assert.equal(calls,3);assert.equal(f.timers.size,0);
 await f.sync.request(false);assert.equal(calls,3);await f.sync.request(true);assert.equal(calls,4);assert.equal(f.state.pending,true);
});
test('button, online hint and timer cannot create overlapping confirmation requests',async()=>{
 let resolve,calls=0;const f=fixture(()=>{calls++;return new Promise(r=>resolve=r);});f.state.online=true;f.sync.start();const job=f.sync.request(true);await f.sync.request(false);await f.sync.request(true);assert.equal(calls,1);assert.equal(f.timers.size,0);
 f.state.pending=false;resolve({done:true});await job;assert.equal(f.sync.busy,false);assert.equal(f.timers.size,0);
});
test('hidden or offline pages do not send; final receipt and pagehide stop all timers',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {done:false,retryable:true};});f.state.online=true;f.state.visible=false;f.sync.start();await f.tick();assert.equal(calls,0);assert.equal(f.sync.attempts,0);
 f.sync.stop();assert.equal(f.timers.size,0);f.state.pending=false;f.sync.start();assert.equal(f.timers.size,0);
});
test('signature/program/storage failure blocks automatic resubmission while retaining manual recovery',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {done:false,retryable:false};});f.state.online=true;f.sync.start();await f.tick();assert.equal(calls,1);assert.equal(f.timers.size,0);await f.sync.request(false);assert.equal(calls,1);assert.equal(f.state.pending,true);
 await f.sync.request(true);assert.equal(calls,2);
});
