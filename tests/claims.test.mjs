import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createDevice} from '../packages/protocol/swap.mjs';
import {claimBytes,signClaim,verifyClaim,buildClaimsBatch,verifyClaimProof,verifyClaimLog} from '../packages/protocol/claims.mjs';
import {verifyClaimsDocument} from '../tools/verify-claims.mjs';
const scope={show:'11'.repeat(32),policy:'22'.repeat(32)};
function value(device,n=0,previous='00'.repeat(32)){return {...scope,ticket:device.publicKey,checkpoint:3,window:4,frame:5,tile:(n+1).toString(16).padStart(2,'0').repeat(32),tokenDigest:'33'.repeat(32),boardDigest:'44'.repeat(32),previous,sequence:n};}
async function fixture(){const device=await createDevice(),a=await signClaim(value(device),device),id=(await verifyClaim(a,scope)).id,b=await signClaim(value(device,1,id),device);return {device,a,b};}
test('claim has fixed encoding/domain and authentic device signature; payload tampering rejected',async()=>{
 const {a,device}=await fixture();assert.equal(claimBytes(a.value).length,256);assert.equal(new TextDecoder().decode(claimBytes(a.value).slice(0,16)),'TONARI/v2/claim\0');
 assert.equal((await verifyClaim(a,scope)).value.ticket,device.publicKey);
 const bad=structuredClone(a);bad.value.tile='ff'.repeat(32);await assert.rejects(verifyClaim(bad,scope),/BAD_CLAIM_SIGNATURE/);
 await assert.rejects(signClaim({...a.value,ticket:'00'.repeat(32)},device),/WRONG_CLAIMANT/);
});
test('strict schema, canonical hex, bounded integers and cross-show policy binding',async()=>{
 const {a}=await fixture();for(const bad of [{...a.value,extra:0},{...a.value,frame:-1},{...a.value,sequence:2**32},{...a.value,tile:'AB'.repeat(32)}])assert.throws(()=>claimBytes(bad));
 await assert.rejects(verifyClaim(a,{...scope,policy:'44'.repeat(32)}),/WRONG_CLAIM_SCOPE/);
});
test('Merkle root independent SHA256 construction binds scope/count/ordered leaves',async()=>{
 const {a,b}=await fixture(),batch=await buildClaimsBatch([b,a],scope),h=(...parts)=>createHash('sha256').update(Buffer.concat(parts.map(x=>typeof x==='string'?Buffer.from(x):x))).digest(),raw=x=>Buffer.from(x,'hex');
 const leaves=batch.claims.map(c=>h('TONARI/v2/claim-leaf\0',raw(c.id))),node=h('TONARI/v2/claim-node\0',...leaves),count=Buffer.alloc(4);count.writeUInt32LE(2);
 const root=h('TONARI/v2/claims-root\0',raw(scope.show),raw(scope.policy),count,node).toString('hex');assert.equal(batch.root,root);assert.equal((await buildClaimsBatch([a,b],scope)).root,root);
 for(const e of [a,b]){const id=(await verifyClaim(e,scope)).id;await verifyClaimProof(e,batch.proofs.find(p=>p.id===id),scope,root);}
});
test('odd tree proofs enforce duplicate-last, exact depth, count and position',async()=>{
 const {a,b,device}=await fixture(),c=await signClaim(value(device,2,(await verifyClaim(b,scope)).id),device),batch=await buildClaimsBatch([a,b,c],scope);
 for(const e of [a,b,c]){const id=(await verifyClaim(e,scope)).id,p=batch.proofs.find(p=>p.id===id);await verifyClaimProof(e,p,scope,batch.root);
  for(const bad of [{...p,count:4},{...p,index:3},{...p,siblings:[...p.siblings,'00'.repeat(32)]},{...p,siblings:p.siblings.map(()=> '00'.repeat(32))}])await assert.rejects(verifyClaimProof(e,bad,scope,batch.root));}
});
test('duplicate claims rejected; empty batch has scoped deterministic root and no membership proof',async()=>{
 const {a}=await fixture();await assert.rejects(buildClaimsBatch([a,a],scope),/DUPLICATE_CLAIM/);const empty=await buildClaimsBatch([],scope);assert.equal(empty.count,0);assert.deepEqual(empty.proofs,[]);assert.notEqual(empty.root,(await buildClaimsBatch([],{...scope,show:'55'.repeat(32)})).root);await assert.rejects(verifyClaimProof(a,{id:'00'.repeat(32),index:0,count:0,siblings:[]},scope,empty.root));
});
test('complete per-ticket hash log rejects omission, reordering and fork despite valid signatures',async()=>{
 const {a,b,device}=await fixture();assert.equal((await verifyClaimLog([a,b],scope,device.publicKey)).length,2);
 for(const list of [[b],[b,a],[a,a],[a,await signClaim(value(device,1),device)]])await assert.rejects(verifyClaimLog(list,scope,device.publicKey),/BROKEN_CLAIM_LOG/);
});
test('batch verification snapshots all envelopes and expected scope before crypto awaits',async()=>{
 const {a,b}=await fixture(),input=[a,b],s={...scope},pending=buildClaimsBatch(input,s);a.value.frame=999;b.value.frame=999;s.show='ff'.repeat(32);input.length=0;const batch=await pending;assert.equal(batch.count,2);assert.equal(batch.scope.show,scope.show);assert.ok(batch.claims.every(c=>c.value.frame===5));
});
test('read-only verifier needs independent root/scope and complete logs; never claims eligibility or anchoring',async()=>{
 const {a,b}=await fixture(),claims=[b,a],batch=await buildClaimsBatch(claims,scope),report=await verifyClaimsDocument({scope,claims},batch.root,scope);assert.equal(report.integrity,'VERIFIED');assert.equal(report.issuanceEligibility,'NOT_VERIFIED');assert.equal(report.onChainAnchor,'NOT_VERIFIED');
 await assert.rejects(verifyClaimsDocument({scope,claims},'00'.repeat(32),scope),/ROOT_MISMATCH/);
 const incomplete=await buildClaimsBatch([b],scope);await assert.rejects(verifyClaimsDocument({scope,claims:[b]},incomplete.root,scope),/BROKEN_CLAIM_LOG/);
 const cli=spawnSync(process.execPath,['tools/verify-claims.mjs'],{encoding:'utf8'});assert.equal(cli.status,1);assert.match(cli.stderr,/Usage:/);
});
