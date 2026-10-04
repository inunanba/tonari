import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {DeviceStore} from '../packages/protocol/storage.mjs';
import {createDevice,hex,fromHex} from '../packages/protocol/swap.mjs';
import {signOffer,acceptOffer} from '../packages/protocol/swap-v2.mjs';
import {signAttestation,verifyAttestation,checkStateAdvance} from '../packages/protocol/attestation.mjs';
const id=n=>n.toString(16).padStart(2,'0').repeat(32);
async function fixture(){
 globalThis.indexedDB=new IDBFactory();const authority=await createDevice(),roots=await Promise.all([0,1,2].map(i=>DeviceStore.open('phone-'+i))),[a,b,c]=roots.map(r=>r.exchange);
 const config={show:id(22),policy:id(33),issuer:authority.publicKey,cluster:'localnet',programId:'2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA'};
 const state={kind:'state',show:config.show,policy:config.policy,issuer:config.issuer,cluster:config.cluster,slot:1,observedAt:100,deadline:1000,paused:false,tiles:roots.map((r,i)=>({id:id(i+1),owner:r.device.publicKey,version:0}))};
 const envelope=await signAttestation(state,authority);for(const s of [a,b,c])await s.saveState(envelope,config);
 const make=async(changes={})=>{const o={show:config.show,policy:config.policy,a:a.device.publicKey,b:b.device.publicKey,tileA:id(1),tileB:id(2),nonce:id(7).slice(0,32),issuedAt:100,expiresAt:220,versionA:0,versionB:0,settleBy:1000,reserved:0,...changes};const signed=await signOffer(a.device,o),packet=await acceptOffer(b.device,signed,{...config,now:100});return {o,signed,packet};};
 const settlement=async packet=>signAttestation({kind:'settled',show:config.show,policy:config.policy,issuer:config.issuer,cluster:config.cluster,slot:2,observedAt:240,id:hex(new Uint8Array(await crypto.subtle.digest('SHA-256',packet))),signature:'1'.repeat(88),commitment:'finalized'},authority);
 return {authority,roots,a,b,c,config,state,envelope,make,settlement};
}
test('v1 database migration preserves the nonextractable device identity',async()=>{
 globalThis.indexedDB=new IDBFactory();const device=await createDevice();
 await new Promise((resolve,reject)=>{const q=indexedDB.open('tonari-v1-phone-0',1);q.onupgradeneeded=()=>{for(const name of ['identity','intents'])q.result.createObjectStore(name);q.result.createObjectStore('receipts',{keyPath:'id'});q.transaction.objectStore('identity').add(device,'device');};q.onsuccess=()=>{q.result.close();resolve();};q.onerror=()=>reject(q.error);});
 const r=await DeviceStore.open('phone-0');assert.equal(r.device.publicKey,device.publicKey);assert.equal(r.device.privateKey.extractable,false);assert.equal(await r.exchange.config(),undefined);r.close();
});
test('authority signatures bind cluster/show/policy; ownership cannot roll back',async()=>{
 const f=await fixture(),bad=structuredClone(f.envelope);bad.value.tiles[0].version=12;
 await assert.rejects(()=>f.a.saveState(bad,f.config),/BAD_AUTHORITY_SIGNATURE/);
 await assert.rejects(()=>verifyAttestation(f.envelope,{...f.config,cluster:'devnet'}),/WRONG_ATTESTATION_SCOPE/);
 const advance=await signAttestation({...f.state,slot:2,tiles:f.state.tiles.map((t,i)=>i===0?{...t,version:1,owner:f.b.device.publicKey}:t)},f.authority);await f.a.saveState(advance,f.config);
 await assert.rejects(()=>f.a.saveState(f.envelope,f.config),/STALE_STATE/);
 const rollback=await signAttestation({...f.state,slot:3},f.authority);await assert.rejects(()=>f.a.saveState(rollback,f.config),/OWNERSHIP_ROLLBACK/);
 assert.throws(()=>checkStateAdvance(f.state,{...f.state,tiles:f.state.tiles.slice(1)}),/OWNERSHIP_ROLLBACK/);f.roots.forEach(r=>r.close());
});
test('dual-signed pending exchange, confirmation and reopen survive; foreign device stays empty',async()=>{
 const f=await fixture(),{signed,packet}=await f.make();await f.a.saveConfig(f.config);
 await f.a.saveIntent(f.config,{direction:'sent',signed},100);await f.b.saveIntent(f.config,{direction:'pending',signed},100);
 const [ra,rb]=await Promise.all([f.a.receive(packet,f.config,240),f.b.receive(packet,f.config,100)]);assert.equal(ra.ownershipFinal,false);assert.equal(rb.status,'PROVISIONAL');assert.equal(await f.a.intent(f.config.show),undefined);
 await assert.rejects(()=>f.c.receive(packet,f.config,100),/NOT_PARTICIPANT/);assert.equal((await f.c.receipts(f.config)).length,0);
 const receipt=await f.settlement(packet),tampered=structuredClone(receipt);tampered.value.id=id(9);
 await assert.rejects(()=>f.a.confirm(ra.id,tampered,f.config),/BAD_AUTHORITY_SIGNATURE/);assert.equal((await f.a.receipts(f.config))[0].ownershipFinal,false);
 const confirmed=await f.a.confirm(ra.id,receipt,f.config);assert.equal(confirmed.ownershipFinal,true);
 // The second side recovers the same finalized receipt, without a second transaction.
 await f.b.confirm(rb.id,receipt,f.config);await f.a.confirm(ra.id,receipt,f.config);
 f.roots[0].close();const reopened=await DeviceStore.open('phone-0');assert.equal(reopened.device.publicKey,f.a.device.publicKey);assert.deepEqual(await reopened.exchange.config(),f.config);assert.equal((await reopened.exchange.receipts(f.config))[0].status,'CONFIRMED');reopened.close();f.roots.slice(1).forEach(r=>r.close());
});
test('concurrent intents and receipt writers serialize; abort retains the pending intent',async()=>{
 const f=await fixture(),second=await DeviceStore.open('phone-0'),{signed,packet}=await f.make(),other=await f.make({nonce:id(8).slice(0,32)});
 const intents=await Promise.allSettled([f.a.saveIntent(f.config,{direction:'sent',signed},100),second.exchange.saveIntent(f.config,{direction:'sent',signed:other.signed},100)]);assert.equal(intents.filter(r=>r.status==='fulfilled').length,1);assert.equal(intents.find(r=>r.status==='rejected').reason.message,'INTENT_BUSY');
 const chosen=(await f.a.intent(f.config.show)).signed.body===signed.body?packet:other.packet;
 const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){if(this.name==='v2receipts'){this.transaction.abort();throw Error('INJECTED_ABORT');}return add.apply(this,args);};
 try{await assert.rejects(()=>f.a.receive(chosen,f.config,100),/INJECTED_ABORT/);}finally{IDBObjectStore.prototype.add=add;}
 assert.ok(await f.a.intent(f.config.show));assert.equal((await f.a.receipts(f.config)).length,0);
 const writes=await Promise.allSettled([f.a.receive(chosen,f.config,100),second.exchange.receive(chosen,f.config,100)]);assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.equal(writes.find(r=>r.status==='rejected').reason.message,'REPLAY');assert.equal((await f.a.receipts(f.config)).length,1);second.close();f.roots.forEach(r=>r.close());
});
test('pending tile reservations, stale versions, wrong packet and corrupt restore fail closed',async()=>{
 const f=await fixture(),{signed,packet}=await f.make();await f.a.saveIntent(f.config,{direction:'sent',signed},100);
 const wrong=await f.make({nonce:id(8).slice(0,32)});await assert.rejects(()=>f.a.receive(wrong.packet,f.config,100),/INTENT_MISMATCH/);
 await f.a.receive(packet,f.config,100);
 
 // A separately signed offer alone suffices to test the reservation before acceptance.
 const o={... (await f.make()).o,b:f.c.device.publicKey,tileB:id(3),nonce:id(8).slice(0,32)};
 await assert.rejects(async()=>f.a.saveIntent(f.config,{direction:'sent',signed:await signOffer(f.a.device,o)},100),/TILE_RESERVED/);
 const stale={...o,tileA:id(3),tileB:id(2),versionA:4};await assert.rejects(async()=>f.c.saveIntent(f.config,{direction:'sent',signed:await signOffer(f.a.device,stale)},100),/NOT_PARTICIPANT/);
 const rows=await f.a.read('v2receipts');rows[0].packet=hex(fromHex(rows[0].packet,368).map((b,i)=>i===300?b^1:b));await f.a.write(['v2receipts'],(tx,done)=>{tx.objectStore('v2receipts').put(rows[0]);done();});await assert.rejects(()=>f.a.receipts(f.config),/BAD_OFFER_SIGNATURE/);f.roots.forEach(r=>r.close());
});
test('validly signed foreign receipts, unfinalized attestations and stale ownership are rejected',async()=>{
 const f=await fixture(),{signed,packet,o}=await f.make();await f.a.saveIntent(f.config,{direction:'sent',signed},100);const row=await f.a.receive(packet,f.config,100);
 const wrong=await f.settlement(packet);wrong.value.id=id(19);const signedWrong=await signAttestation(wrong.value,f.authority);await assert.rejects(()=>f.a.confirm(row.id,signedWrong,f.config),/WRONG_SETTLEMENT/);
 const unfinalized=await f.settlement(packet);unfinalized.value.commitment='confirmed';await assert.rejects(()=>f.a.confirm(row.id,unfinalized,f.config),/NOT_FINALIZED/);
 assert.equal((await f.a.receipts(f.config))[0].ownershipFinal,false);
 const stale=await signOffer(f.b.device,{...o,a:f.b.device.publicKey,b:f.c.device.publicKey,tileA:id(2),tileB:id(3),versionA:1,nonce:id(9).slice(0,32)});await assert.rejects(()=>f.b.saveIntent(f.config,{direction:'sent',signed:stale},100),/STALE_OWNERSHIP/);f.roots.forEach(r=>r.close());
});
test('confirmation abort preserves provisional receipt and retry; immutable input is snapshotted',async()=>{
 const f=await fixture(),{signed,packet}=await f.make();await f.a.saveIntent(f.config,{direction:'sent',signed},100);const row=await f.a.receive(packet,f.config,100),envelope=await f.settlement(packet);
 const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='v2receipts'){this.transaction.abort();throw Error('CONFIRM_ABORT');}return put.apply(this,args);};
 try{await assert.rejects(()=>f.a.confirm(row.id,envelope,f.config),/CONFIRM_ABORT/);}finally{IDBObjectStore.prototype.put=put;}
 assert.equal((await f.a.receipts(f.config))[0].status,'PROVISIONAL');const promise=f.a.confirm(row.id,envelope,f.config);envelope.value.id=id(18);await promise;assert.equal((await f.a.receipts(f.config))[0].status,'CONFIRMED');f.roots.forEach(r=>r.close());
});
test('sender imports an already finalized peer packet after its cached owners advanced and deadline passed',async()=>{
 const f=await fixture(),{signed,packet}=await f.make();await f.a.saveIntent(f.config,{direction:'sent',signed},100);
 const advanced=await signAttestation({...f.state,slot:3,tiles:f.state.tiles.map((t,i)=>i<2?{...t,version:1,owner:i===0?f.b.device.publicKey:f.a.device.publicKey}:t)},f.authority);await f.a.saveState(advanced,f.config);
 await assert.rejects(()=>f.a.receive(packet,f.config,240),/STALE_OWNERSHIP/);
 const proof=await f.settlement(packet),row=await f.a.receive(packet,f.config,2000,proof);assert.equal(row.status,'CONFIRMED');assert.equal(row.importedAt,2000);assert.equal(row.acceptedAt,240);assert.equal((await f.a.receipts(f.config))[0].ownershipFinal,true);assert.equal(await f.a.intent(f.config.show),undefined);f.roots.forEach(r=>r.close());
});
test('historical packet import cannot bypass stale owners using a foreign or forged finalized proof',async()=>{
 const f=await fixture(),{signed,packet}=await f.make();await f.a.saveIntent(f.config,{direction:'sent',signed},100);
 const proof=await f.settlement(packet);proof.value.id=id(21);const wrong=await signAttestation(proof.value,f.authority);
 await assert.rejects(()=>f.a.receive(packet,f.config,2000,wrong),/WRONG_SETTLEMENT/);proof.value.id=id(22);await assert.rejects(()=>f.a.receive(packet,f.config,2000,proof),/BAD_AUTHORITY_SIGNATURE/);
 assert.equal((await f.a.receipts(f.config)).length,0);assert.ok(await f.a.intent(f.config.show));f.roots.forEach(r=>r.close());
});

test('verified observation clock persists through reopen; replay cannot renew acceptance time',async()=>{
 const f=await fixture();
 const next=await signAttestation({...f.state,slot:2,observedAt:110},f.authority);
 await f.a.saveState(next,f.config,3710);assert.deepEqual(await f.a.clockAnchor(f.config),{slot:2,observedAt:110,receivedAt:3710});
 await f.a.saveState(next,f.config,3800);assert.equal((await f.a.clockAnchor(f.config)).receivedAt,3710);
 f.roots[0].close();const reopened=await DeviceStore.open('phone-0');assert.equal((await reopened.exchange.clockAnchor(f.config)).receivedAt,3710);
 const forged=structuredClone(next);forged.value.observedAt=10000;await assert.rejects(()=>reopened.exchange.saveState(forged,f.config,3800),/BAD_AUTHORITY_SIGNATURE/);
 assert.equal((await reopened.exchange.clockAnchor(f.config)).observedAt,110);reopened.close();f.roots.slice(1).forEach(r=>r.close());
});
test('clock anchor and ownership snapshot commit together or both roll back',async()=>{
 const f=await fixture(),before=await f.a.clockAnchor(f.config),next=await signAttestation({...f.state,slot:2,observedAt:110},f.authority);
 const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='v2states'){this.transaction.abort();throw Error('STATE_ABORT');}return put.apply(this,args);};
 try{await assert.rejects(()=>f.a.saveState(next,f.config,3710),/STATE_ABORT/);}finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(await f.a.clockAnchor(f.config),before);assert.equal((await f.a.state(f.config)).slot,1);f.roots.forEach(r=>r.close());
});
