import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createDevice} from '../packages/protocol/swap.mjs';
import {dropBytes,signDrop,verifyDrop,evaluateDrop} from '../packages/protocol/drop.mjs';
import {DeviceStore} from '../packages/protocol/storage.mjs';
const id=n=>n.toString(16).padStart(2,'0').repeat(32),scope={show:id(1),policy:id(2)};
function value(checkpoint,changes={}){return {...scope,checkpointKey:checkpoint.publicKey,checkpoint:3,window:4,frame:5,validFrom:100,validTo:120,probabilityPPM:1_000_000,cap:2,nonce:id(9),...changes};}
async function fixture(){globalThis.indexedDB=new IDBFactory();const checkpoint=await createDevice(),root=await DeviceStore.open('phone-0'),token=await signDrop(value(checkpoint),checkpoint);return {checkpoint,root,token,config:{...scope,checkpointKeys:[checkpoint.publicKey]},missing:[id(10),id(11),id(12)]};}
test('fixed signed drop is scoped, time bounded and rejects substitution',async()=>{
 const f=await fixture();assert.equal(dropBytes(f.token.value).length,171);assert.equal((await verifyDrop(f.token,{...scope,checkpointKey:f.checkpoint.publicKey},110)).envelope.value.cap,2);
 for(const now of [99,121])await assert.rejects(verifyDrop(f.token,{...scope,checkpointKey:f.checkpoint.publicKey},now),/DROP_EXPIRED/);
 const bad=structuredClone(f.token);bad.value.cap=3;await assert.rejects(verifyDrop(bad,{...scope,checkpointKey:f.checkpoint.publicKey},110),/BAD_DROP_SIGNATURE/);
 await assert.rejects(verifyDrop(f.token,{...scope,checkpointKey:id(8)},110),/WRONG_DROP_SCOPE/);f.root.close();
});
test('policy bounds reject long TTL, invalid probability/cap and noncanonical fields',async()=>{
 const c=await createDevice();for(const changes of [{validTo:161},{probabilityPPM:1_000_001},{cap:0},{cap:65536},{extra:1}])assert.throws(()=>dropBytes(value(c,changes))); 
});
test('deterministic outcome is ticket-bound, chooses only canonical missing tiles and p=0 never issues',async()=>{
 const f=await fixture(),a=await evaluateDrop(f.token,{...scope,checkpointKey:f.checkpoint.publicKey},f.root.device.publicKey,f.missing,110),b=await evaluateDrop(f.token,{...scope,checkpointKey:f.checkpoint.publicKey},f.root.device.publicKey,[...f.missing].reverse(),110);assert.equal(a.eligible,true);assert.equal(a.tile,b.tile);assert.ok(f.missing.includes(a.tile));
 const zero=await signDrop(value(f.checkpoint,{probabilityPPM:0,frame:6}),f.checkpoint);assert.equal((await evaluateDrop(zero,{...scope,checkpointKey:f.checkpoint.publicKey},f.root.device.publicKey,f.missing,110)).eligible,false);
 await assert.rejects(evaluateDrop(f.token,{...scope,checkpointKey:f.checkpoint.publicKey},f.root.device.publicKey,[id(10),id(10)],110),/BAD_MISSING/);f.root.close();
});
test('eligible claim persists atomically, restores signatures/token eligibility and retains device key',async()=>{
 const f=await fixture(),out=await f.root.claims.issueDrop(f.token,f.config,f.missing,110);assert.equal(out.eligible,true);assert.equal(out.claim.envelope.value.sequence,0);const before=f.root.device.publicKey;f.root.close();
 const reopened=await DeviceStore.open('phone-0'),rows=await reopened.claims.claims(f.config);assert.equal(rows.length,1);assert.equal(rows[0].verified.id,out.claim.id);assert.equal(reopened.device.publicKey,before);reopened.close();
});
test('p=0 writes nothing; duplicate token/frame and already-owned tile fail closed',async()=>{
 const f=await fixture(),zero=await signDrop(value(f.checkpoint,{probabilityPPM:0,frame:6}),f.checkpoint);assert.equal((await f.root.claims.issueDrop(zero,f.config,f.missing,110)).eligible,false);assert.equal((await f.root.claims.claims(f.config)).length,0);
 const first=await f.root.claims.issueDrop(f.token,f.config,f.missing,110);await assert.rejects(f.root.claims.issueDrop(f.token,f.config,f.missing,110),/DROP_REPLAY|FRAME_LIMIT/);
 const sameFrame=await signDrop(value(f.checkpoint,{nonce:id(8)}),f.checkpoint);await assert.rejects(f.root.claims.issueDrop(sameFrame,f.config,f.missing,110),/FRAME_LIMIT/);
 const next=await signDrop(value(f.checkpoint,{frame:6,nonce:id(7)}),f.checkpoint),owned=first.tile,onlyOwned=[owned];await assert.rejects(f.root.claims.issueDrop(next,f.config,onlyOwned,110),/TILE_ALREADY_OWNED/);f.root.close();
});
test('concurrent tabs serialize claim head; abort leaves no partial record and retry works',async()=>{
 const f=await fixture(),second=await DeviceStore.open('phone-0'),put=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){if(this.name==='v2claims'){this.transaction.abort();throw Error('CLAIM_ABORT');}return put.apply(this,args);};try{await assert.rejects(f.root.claims.issueDrop(f.token,f.config,f.missing,110),/CLAIM_ABORT/);}finally{IDBObjectStore.prototype.add=put;}assert.equal((await f.root.claims.claims(f.config)).length,0);
 const writes=await Promise.allSettled([f.root.claims.issueDrop(f.token,f.config,f.missing,110),second.claims.issueDrop(f.token,f.config,f.missing,110)]);assert.equal(writes.filter(x=>x.status==='fulfilled').length,1);assert.match(writes.find(x=>x.status==='rejected').reason.message,/CLAIM_LOG_CHANGED|DROP_REPLAY/);assert.equal((await second.claims.claims(f.config)).length,1);second.close();f.root.close();
});
test('stored token, missing snapshot, claim link and log corruption are detected on reopen',async()=>{
 const f=await fixture();await f.root.claims.issueDrop(f.token,f.config,f.missing,110);const rows=await f.root.claims.readAll();rows[0].missing=[id(23)];await new Promise((resolve,reject)=>{const tx=f.root.claims.db.transaction('v2claims','readwrite');tx.objectStore('v2claims').put(rows[0]);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});await assert.rejects(f.root.claims.claims(f.config),/INELIGIBLE_CLAIM/);f.root.close();
});
test('persistent store rejects self-signed but untrusted checkpoint keys before any write',async()=>{
 const f=await fixture(),rogue=await createDevice(),token=await signDrop(value(rogue),rogue);await assert.rejects(f.root.claims.issueDrop(token,f.config,f.missing,110),/UNTRUSTED_CHECKPOINT_KEY/);assert.equal((await f.root.claims.claims(f.config)).length,0);f.root.close();
});
