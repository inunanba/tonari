import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createDevice} from '../packages/protocol/swap.mjs';
import {freshJourney,advanceJourney,judgeSteps} from '../packages/games/judge-journey.mjs';
import {completionBytes,signCompletion,verifyCompletionRequest,attestCompletion,verifyCompletion} from '../packages/protocol/completion.mjs';
import {verifyCompletionDocument} from '../tools/verify-completion.mjs';

const id=n=>n.toString(16).padStart(2,'0').repeat(32);
const scope={show:id(1),policy:id(2)};
const value=ticket=>({version:1,kind:'portable-signed-record',show:scope.show,policy:scope.policy,ticket,boardDigest:id(3),claimsRoot:id(4),settlementDigest:id(5),pieces:24,completedAt:1791234567});
const completed=()=>judgeSteps.reduce((state,step)=>advanceJourney(state,step,true),freshJourney());
async function fixture(){const device=await createDevice(),authority=await createDevice(),request=await signCompletion(value(device.publicKey),device,completed()),record=await attestCompletion(request,authority,scope);return {device,authority,request,record};}

test('device and show authority bind one canonical 24-piece completion record',async()=>{
 const {device,authority,request,record}=await fixture();
 assert.ok(completionBytes(record.value).length>200);
 assert.equal((await verifyCompletionRequest(request,scope)).value.ticket,device.publicKey);
 const verified=await verifyCompletion(record,{...scope,authority:authority.publicKey});
 assert.equal(verified.integrity,'VERIFIED');assert.equal(verified.recipient,device.publicKey);assert.equal(verified.pieces,24);
 assert.deepEqual({cNFT:verified.cNFT,onChainAnchor:verified.onChainAnchor,nonTransferability:verified.nonTransferability},{cNFT:'NOT_VERIFIED',onChainAnchor:'NOT_VERIFIED',nonTransferability:'NOT_VERIFIED'});
});

test('incomplete journey, wrong device, fields and bounds fail closed',async()=>{
 const device=await createDevice(),other=await createDevice();
 await assert.rejects(signCompletion(value(device.publicKey),device,freshJourney()),/JOURNEY_INCOMPLETE/);
 await assert.rejects(signCompletion(value(other.publicKey),device,completed()),/WRONG_COMPLETION_DEVICE/);
 for(const change of [{pieces:23},{completedAt:-1},{kind:'cnft'},{extra:true}]){
  const v={...value(device.publicKey),...change};assert.throws(()=>completionBytes(v),/BAD_COMPLETION/);
 }
});

test('every signed region, scope and authority reject tampering',async()=>{
 const {authority,record}=await fixture(),expected={...scope,authority:authority.publicKey};
 for(const [field,next] of [['boardDigest',id(8)],['claimsRoot',id(9)],['settlementDigest',id(10)],['completedAt',1791234568]]){
  const bad=structuredClone(record);bad.value[field]=next;await assert.rejects(verifyCompletion(bad,expected),/BAD_COMPLETION_DEVICE_SIGNATURE/);
 }
 const deviceSig=structuredClone(record);deviceSig.deviceSignature='00'.repeat(64);await assert.rejects(verifyCompletion(deviceSig,expected),/BAD_COMPLETION_DEVICE_SIGNATURE/);
 const authoritySig=structuredClone(record);authoritySig.authoritySignature='00'.repeat(64);await assert.rejects(verifyCompletion(authoritySig,expected),/BAD_COMPLETION_AUTHORITY_SIGNATURE/);
 await assert.rejects(verifyCompletion(record,{...expected,show:id(7)}),/WRONG_COMPLETION_SCOPE/);
 await assert.rejects(verifyCompletion(record,{...expected,authority:id(7)}),/WRONG_COMPLETION_AUTHORITY/);
});

test('read-only CLI verifies integrity but never upgrades chain or cNFT claims',async()=>{
 const {authority,record}=await fixture(),expected={...scope,authority:authority.publicKey};
 const direct=await verifyCompletionDocument({record},expected);assert.equal(direct.portableRecord,'VERIFIED');assert.equal(direct.cNFT,'NOT_VERIFIED');
 await assert.rejects(verifyCompletionDocument({record,extra:true},expected),/BAD_COMPLETION_DOCUMENT/);
 const dir=await mkdtemp(join(tmpdir(),'tonari-completion-')),file=join(dir,'record.json');await writeFile(file,JSON.stringify({record}));
 const run=spawnSync(process.execPath,['tools/verify-completion.mjs',file,scope.show,scope.policy,authority.publicKey],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const output=JSON.parse(run.stdout);assert.equal(output.integrity,'VERIFIED');assert.equal(output.onChainAnchor,'NOT_VERIFIED');
 const usage=spawnSync(process.execPath,['tools/verify-completion.mjs'],{encoding:'utf8'});assert.equal(usage.status,1);assert.match(usage.stderr,/Usage:/);
});
