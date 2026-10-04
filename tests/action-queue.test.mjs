import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionQueue} from '../apps/web/action-queue.mjs';
import {connectionNotice} from '../apps/web/chain-api.mjs';
const gate=()=>{let release;const promise=new Promise(resolve=>release=resolve);return {promise,release};};
test('QR received during slow refresh executes once after it, never disappears',async()=>{
 const held=gate(),events=[],counts=[],q=new ActionQueue({onChange:n=>counts.push(n)});
 const refresh=q.run(async()=>{events.push('refresh start');await held.promise;events.push('refresh end');});
 await Promise.resolve();const qr=q.run(()=>{events.push('QR read');return 'verified';});
 await Promise.resolve();assert.deepEqual(events,['refresh start']);assert.equal(q.count,2);
 held.release();await refresh;assert.equal(await qr,'verified');assert.deepEqual(events,['refresh start','refresh end','QR read']);assert.equal(q.count,0);assert.deepEqual(counts,[1,2,1,0]);
});
test('rejected QR preserves feedback and later explicit consent/cancel execute in order',async()=>{
 const q=new ActionQueue(),events=[];
 const rejected=q.run(()=>{events.push('bad QR');throw Error('NOT_PARTICIPANT');});
 const next=q.run(()=>{events.push('next QR');return 'pending';});const cancel=q.run(()=>events.push('cancel'));
 await assert.rejects(()=>rejected,/NOT_PARTICIPANT/);assert.equal(await next,'pending');await cancel;assert.deepEqual(events,['bad QR','next QR','cancel']);assert.equal(q.count,0);
});
test('bounded backlog reports overflow and leaves accepted actions intact',async()=>{
 const held=gate(),q=new ActionQueue({limit:2});const first=q.run(()=>held.promise),second=q.run(()=>2);
 await assert.rejects(()=>q.run(()=>3),/ACTION_QUEUE_FULL/);assert.equal(q.count,2);held.release(1);await first;assert.equal(await second,2);assert.equal(await q.run(()=>4),4);
});
test('footer truthfully distinguishes configured Devnet and local chain',()=>{
 const config={show:'01'.repeat(32),policy:'02'.repeat(32),issuer:'03'.repeat(32),programId:'2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA',cluster:'devnet'};
 assert.match(connectionNotice(config),/Solana Devnet/);assert.match(connectionNotice(config),/常設接続は制作中/);
 assert.doesNotMatch(connectionNotice(config),/まだ利用できません/);assert.match(connectionNotice({...config,cluster:'localnet'}),/公開Devnetの取引ではありません/);
 assert.throws(()=>connectionNotice({...config,cluster:'mainnet-beta'}),/UNSUPPORTED_CHAIN/);
});

test('queued consent is bound to the offer visible when clicked, never a replacement',async()=>{
 const held=gate(),q=new ActionQueue();let current='offer A',signed=0;
 const refresh=q.run(async()=>{await held.promise;current='offer B';});
 const consent=q.runCurrent(current,()=>current,()=>signed++);
 held.release();await refresh;await assert.rejects(()=>consent,/ACTION_CONTEXT_CHANGED/);assert.equal(signed,0);
 await q.runCurrent(current,()=>current,()=>signed++);assert.equal(signed,1);
});
