import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {ClaimOperator} from '../tools/claim-operator.mjs';
import {signDrop} from '../packages/protocol/drop.mjs';
import {createDevice} from '../packages/protocol/swap.mjs';
import {DeviceStore} from '../packages/protocol/storage.mjs';
const id=n=>n.toString(16).padStart(2,'0').repeat(32),scope={show:id(1),policy:id(2)},missing=[id(10),id(11),id(12)];
async function fixture({cap=2}={}){globalThis.indexedDB=new IDBFactory();let now=100;const checkpoint=await createDevice(),calls=[];
 const operator=new ClaimOperator({config:scope,checkpointKey:checkpoint.publicKey,signToken:value=>signDrop(value,checkpoint),clock:async()=>now,random:()=>Buffer.alloc(32,6),commitWindow:async value=>calls.push(['commit',value]),postRoot:async value=>calls.push(['root',value]),revealWindow:async value=>calls.push(['reveal',value])});
 await operator.open({window:4,startsIn:0,duration:20,revealDelay:2,probabilityPPM:1_000_000,cap});return {operator,checkpoint,calls,setNow:value=>now=value};}
async function claim(f,name,frame){const root=await DeviceStore.open(name),token=await f.operator.token({frame}),out=await root.claims.issueDrop(token,{...scope,checkpointKeys:[f.checkpoint.publicKey]},missing,105);root.close();return out.claim;}
test('operator hides entropy, issues auditable tokens, verifies claims and publishes one root',async()=>{const f=await fixture(),before=f.operator.status();assert.equal(before.secret,undefined);assert.equal(before.status,'OPEN');
 const row=await claim(f,'phone-0',1),accepted=await f.operator.submit(row);assert.equal(accepted.count,1);await assert.rejects(f.operator.submit(row),/CLAIM_REPLAY/);await assert.rejects(f.operator.publish(),/WINDOW_STILL_LIVE/);
 f.setNow(120);const posted=await f.operator.publish();assert.equal(posted.status,'ROOT_POSTED');assert.equal(posted.count,1);assert.match(posted.root,/^[0-9a-f]{64}$/);assert.equal(posted.secret,undefined);assert.equal(f.calls[1][0],'root');await assert.rejects(f.operator.publish(),/ROOT_ALREADY_POSTED/);
 f.setNow(122);const revealed=await f.operator.reveal();assert.equal(revealed.secret,id(6));assert.equal(revealed.status,'REVEALED');assert.equal(f.calls[2][0],'reveal');await assert.rejects(f.operator.reveal(),/NOT_READY_TO_REVEAL/);
});
test('operator rejects tokens it did not issue and altered eligibility evidence',async()=>{const f=await fixture(),row=await claim(f,'phone-0',1),foreign=structuredClone(row);foreign.token.value.frame=2;await assert.rejects(f.operator.submit(foreign),/TOKEN_NOT_ISSUED/);
 const changed=structuredClone(row);changed.missing=[id(20),id(21)];await assert.rejects(f.operator.submit(changed),/CLAIM_OUTCOME_MISMATCH|INELIGIBLE_CLAIM/);assert.equal(f.operator.status().claims,0);
});
test('serialized submissions enforce the committed global cap',async()=>{const f=await fixture({cap:1}),a=await claim(f,'phone-0',1),b=await claim(f,'phone-1',2),results=await Promise.allSettled([f.operator.submit(a),f.operator.submit(b)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/CLAIM_CAP/);assert.equal(f.operator.status().claims,1);});
