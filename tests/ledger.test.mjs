import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkReceipt} from '../packages/protocol/ledger.mjs';
const key=n=>n.toString(16).padStart(2,'0').repeat(32);
const receipt=(changes={})=>({id:key(8),offer:{show:key(1),a:key(2),b:key(3),nonce:'00'.repeat(16),issuedAt:100,expiresAt:220,...changes.offer},acceptedAt:100,...Object.fromEntries(Object.entries(changes).filter(([k])=>k!=='offer'))});
test('receipt accepts only a participant, regardless of valid third-party signatures',()=>{
  assert.equal(checkReceipt([],receipt(),key(2)).ownershipFinal,undefined);
  assert.throws(()=>checkReceipt([],receipt(),key(4)),/NOT_PARTICIPANT/);
});
test('reopening a persisted receipt history still rejects replay and reused nonce',()=>{
  const restored=structuredClone([receipt()]);
  assert.throws(()=>checkReceipt(restored,receipt(),key(2)),/REPLAY/);
  assert.throws(()=>checkReceipt(restored,receipt({id:key(9),offer:{b:key(4)}}),key(2)),/REPLAY/);
});
test('pair limit survives fresh nonce and reversed participant order',()=>{
  assert.throws(()=>checkReceipt([receipt()],receipt({id:key(9),acceptedAt:220,offer:{a:key(3),b:key(2),nonce:'01'.repeat(16)}}),key(2)),/PAIR_LIMIT/);
});
test('participant cooldown lasts 120 seconds, including backward clock rejection',()=>{
  const next=at=>receipt({id:key(9),acceptedAt:at,offer:{b:key(4),nonce:'01'.repeat(16),issuedAt:0,expiresAt:300}});
  for(const at of [90,100,219])assert.throws(()=>checkReceipt([receipt()],next(at),key(2)),/COOLDOWN/);
  assert.equal(checkReceipt([receipt()],next(220),key(2)).acceptedAt,220);
});
test('separate show namespace permits same pair, with no cross-show cooldown',()=>{
  const next=receipt({id:key(9),offer:{show:key(5)}});
  assert.equal(checkReceipt([receipt()],next,key(2)),next);
});
test('tampered acceptance times are rejected before writing policy state',()=>{
  for(const acceptedAt of [99,221,NaN,100.5,-1])assert.throws(()=>checkReceipt([],receipt({acceptedAt}),key(2)),/BAD_RECEIPT_TIME/);
});
