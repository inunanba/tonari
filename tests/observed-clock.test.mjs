import test from 'node:test';
import assert from 'node:assert/strict';
import {observedNow,offerTime} from '../packages/protocol/observed-clock.mjs';
import {createDevice} from '../packages/protocol/swap.mjs';
import {signOffer,acceptOffer,inspectPacket} from '../packages/protocol/swap-v2.mjs';
test('one hour fast device clock produces chain-valid signatures and delayed settlement',async()=>{
 const anchor={slot:10,observedAt:1000,receivedAt:4600},state={slot:10,observedAt:1000,deadline:2800};
 const [a,b]=await Promise.all([createDevice(),createDevice()]),id=n=>n.toString(16).padStart(2,'0').repeat(32),config={show:id(1),policy:id(2)};
 const times=offerTime(state,anchor,4608);assert.equal(times.issuedAt,1000);assert.equal(observedNow(anchor,4608),1008);
 const offer={...config,a:a.publicKey,b:b.publicKey,tileA:id(3),tileB:id(4),nonce:'05'.repeat(16),versionA:0,versionB:0,reserved:0,...times};
 const signed=await signOffer(a,offer),packet=await acceptOffer(b,signed,{...config,now:observedNow(anchor,4610)});
 assert.equal((await inspectPacket(packet,{...config,now:1002},{settlement:true})).offer.issuedAt,1000);
 await assert.rejects(()=>inspectPacket(packet,{...config,now:2801},{settlement:true}),/SETTLEMENT_EXPIRED_OR_FUTURE/);
 // Old wall-clock-issued packets reproduce the future-time rejection.
 const old=await signOffer(a,{...offer,issuedAt:4608,expiresAt:4728,settleBy:5000});
 const oldPacket=await acceptOffer(b,old,{...config,now:4610});
 await assert.rejects(()=>inspectPacket(oldPacket,{...config,now:1002},{settlement:true}),/SETTLEMENT_EXPIRED_OR_FUTURE/);
});
test('offline acceptance ages across reload; stale state and local clock rollback fail closed',()=>{
 const anchor={slot:10,observedAt:1000,receivedAt:4600},state={slot:10,observedAt:1000,deadline:2800};
 assert.equal(observedNow(structuredClone(anchor),4720),1120);
 assert.throws(()=>offerTime(state,structuredClone(anchor),4721),/OWNERSHIP_OBSERVATION_EXPIRED/);
 assert.throws(()=>observedNow(anchor,4599),/LOCAL_CLOCK_ROLLBACK/);
 assert.throws(()=>offerTime({...state,slot:11},anchor,4600),/CLOCK_ANCHOR_UNAVAILABLE/);
 assert.throws(()=>offerTime({...state,deadline:1119},anchor,4600),/SHOW_DEADLINE/);
});
