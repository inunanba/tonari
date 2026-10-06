import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {PublicKey,Keypair,SYSVAR_INSTRUCTIONS_PUBKEY,SystemProgram} from '@solana/web3.js';
import {createDevice} from '../packages/protocol/swap.mjs';
import {freshJourney,advanceJourney,judgeSteps} from '../packages/games/judge-journey.mjs';
import {signCompletion,attestCompletion,verifyCompletion} from '../packages/protocol/completion.mjs';
import {completionAnchorBytes,prepareCompletionAnchor,verifyCompletionAnchorRequest} from '../packages/protocol/completion-anchor.mjs';
import {assertSignatureBinding} from '../packages/protocol/precompile.mjs';
import {completionAddress,completionAnchorMessage,completionAnchorInstructions,discriminator,readAccount,PROGRAM_ID} from '../tools/chain-client.mjs';
import {requireDevnetReadRPC,verifyCompletionAnchorOnChain} from '../tools/verify-completion-anchor.mjs';

const {subtle}=webcrypto;
const bytes=n=>Buffer.alloc(32,n);
async function chainFixture(){
 const keys=await subtle.generateKey('Ed25519',true,['sign','verify']);
 const raw=Buffer.from(await subtle.exportKey('raw',keys.publicKey));
 const authority=Keypair.generate().publicKey,show=new PublicKey(bytes(4)),device=new PublicKey(raw),policy=bytes(5),digest=bytes(6);
 const message=completionAnchorMessage(show,policy,device,digest);
 const signature=new Uint8Array(await subtle.sign('Ed25519',keys.privateKey,message));
 return {authority,show,device,policy,digest,message,signature};
}

test('completion anchor binds one device signature to show, policy and record digest',async()=>{
 const f=await chainFixture(),[verify,anchor]=completionAnchorInstructions(f.authority,f.show,f.policy,f.device,f.digest,f.signature);
 assertSignatureBinding({programId:verify.programId.toBase58(),accounts:[],data:new Uint8Array(verify.data)},f.device.toBuffer().toString('hex'),f.signature,f.message);
 assert.equal(anchor.programId.toBase58(),PROGRAM_ID.toBase58());
 assert.deepEqual(anchor.data.subarray(0,8),discriminator('global','anchor_completion'));
 assert.deepEqual(anchor.data.subarray(8,40),f.device.toBuffer());
 assert.deepEqual(anchor.data.subarray(40),f.digest);
 assert.deepEqual(anchor.keys.map(x=>x.pubkey.toBase58()),[f.authority,f.show,completionAddress(f.show,f.device),SYSVAR_INSTRUCTIONS_PUBKEY,SystemProgram.programId].map(x=>x.toBase58()));
 assert.deepEqual(anchor.keys.map(x=>[x.isWritable,x.isSigner]),[[true,true],[false,false],[true,false],[false,false],[false,false]]);
});

test('anchor message and PDA reject substitution and zero digest',async()=>{
 const f=await chainFixture();
 for(const changed of [
  completionAnchorMessage(new PublicKey(bytes(7)),f.policy,f.device,f.digest),
  completionAnchorMessage(f.show,bytes(7),f.device,f.digest),
  completionAnchorMessage(f.show,f.policy,new PublicKey(bytes(7)),f.digest),
  completionAnchorMessage(f.show,f.policy,f.device,bytes(7)),
 ])assert.notDeepEqual(changed,f.message);
 assert.throws(()=>completionAnchorMessage(f.show,f.policy,f.device,Buffer.alloc(32)),/BAD_COMPLETION_ANCHOR/);
 assert.notDeepEqual(completionAddress(f.show,f.device),completionAddress(new PublicKey(bytes(8)),f.device));
});

test('completion account readback is exact and remains explicitly non-token',async()=>{
 const f=await chainFixture(),data=Buffer.alloc(141);
 discriminator('account','Completion').copy(data,0);f.show.toBuffer().copy(data,8);f.policy.copy(data,40);f.device.toBuffer().copy(data,72);f.digest.copy(data,104);data.writeUInt32LE(1791234567,136);data[140]=250;
 const decoded=readAccount({owner:PROGRAM_ID,data},'Completion');
 assert.equal(decoded.show.toBase58(),f.show.toBase58());assert.equal(decoded.device.toBase58(),f.device.toBase58());
 assert.deepEqual(decoded.policy,f.policy);assert.deepEqual(decoded.recordDigest,f.digest);assert.equal(decoded.anchoredAt,1791234567);
 assert.equal('mint' in decoded,false);assert.equal('token' in decoded,false);assert.equal('nonTransferable' in decoded,false);
});

const id=n=>n.toString(16).padStart(2,'0').repeat(32);
const completed=()=>judgeSteps.reduce((state,step)=>advanceJourney(state,step,true),freshJourney());
async function portableFixture(){
 const device=await createDevice(),authority=await createDevice(),expected={show:id(11),policy:id(12),authority:authority.publicKey};
 const value={version:1,kind:'portable-signed-record',show:expected.show,policy:expected.policy,ticket:device.publicKey,boardDigest:id(13),claimsRoot:id(14),settlementDigest:id(15),pieces:24,completedAt:1791234567};
 const request=await signCompletion(value,device,completed()),record=await attestCompletion(request,authority,{show:expected.show,policy:expected.policy});
 return {device,authority,expected,record};
}
function completionAccount(show,policy,device,digest,anchoredAt=1791234599){
 const data=Buffer.alloc(141);discriminator('account','Completion').copy(data);show.toBuffer().copy(data,8);Buffer.from(policy,'hex').copy(data,40);device.toBuffer().copy(data,72);Buffer.from(digest,'hex').copy(data,104);data.writeUInt32LE(anchoredAt,136);data[140]=1;return {owner:PROGRAM_ID,data};
}

test('portable record prepares the exact device-signed anchor request',async()=>{
 const f=await portableFixture(),prepared=await prepareCompletionAnchor(f.record,f.expected,f.device),portable=await verifyCompletion(f.record,f.expected);
 assert.equal(prepared.value.recordDigest,portable.id);assert.equal(prepared.value.device,portable.recipient);
 const checked=await verifyCompletionAnchorRequest(prepared,f.record,f.expected);
 assert.equal(checked.portableRecord,'VERIFIED');assert.equal(checked.onChainAnchor,'NOT_VERIFIED');assert.equal(checked.cNFT,'NOT_VERIFIED');
 assert.deepEqual(Buffer.from(completionAnchorBytes(prepared.value)),completionAnchorMessage(new PublicKey(Buffer.from(f.expected.show,'hex')),Buffer.from(f.expected.policy,'hex'),new PublicKey(Buffer.from(f.device.publicKey,'hex')),Buffer.from(portable.id,'hex')));
});

test('anchor preparation rejects foreign device and every record binding substitution',async()=>{
 const f=await portableFixture(),other=await createDevice();
 await assert.rejects(prepareCompletionAnchor(f.record,f.expected,other),/WRONG_COMPLETION_ANCHOR_DEVICE/);
 const prepared=await prepareCompletionAnchor(f.record,f.expected,f.device);
 for(const [field,value] of [['show',id(21)],['policy',id(22)],['device',id(23)],['recordDigest',id(24)]]){
  const bad=structuredClone(prepared);bad.value[field]=value;await assert.rejects(verifyCompletionAnchorRequest(bad,f.record,f.expected),/WRONG_COMPLETION_ANCHOR_BINDING|BAD_COMPLETION_ANCHOR_SIGNATURE/);
 }
 const bad=structuredClone(prepared);bad.deviceSignature='00'.repeat(64);await assert.rejects(verifyCompletionAnchorRequest(bad,f.record,f.expected),/BAD_COMPLETION_ANCHOR_SIGNATURE/);
});

test('finalized PDA readback upgrades only the on-chain anchor capability',async()=>{
 const f=await portableFixture(),portable=await verifyCompletion(f.record,f.expected),show=new PublicKey(Buffer.from(f.expected.show,'hex')),device=new PublicKey(Buffer.from(f.device.publicKey,'hex')),address=completionAddress(show,device),signature='1'.repeat(88),slot=77;
 const connection={
  getSignatureStatuses:async()=>({value:[{err:null,confirmationStatus:'finalized',slot}]}),
  getSignaturesForAddress:async(key)=>{assert(key.equals(address));return [{signature,err:null,confirmationStatus:'finalized',slot}];},
  getAccountInfoAndContext:async(key,options)=>{assert(key.equals(address));assert.equal(options.minContextSlot,slot);return {context:{slot},value:completionAccount(show,f.expected.policy,device,portable.id)};}
 };
 const verified=await verifyCompletionAnchorOnChain({record:f.record,expected:f.expected,connection,signature});
 assert.equal(verified.onChainAnchor,'VERIFIED');assert.equal(verified.cNFT,'NOT_VERIFIED');assert.equal(verified.nonTransferability,'NOT_VERIFIED');assert.equal(verified.address,address.toBase58());assert.equal(verified.recordDigest,portable.id);
});

test('read-only verifier rejects unfinalized, unrelated and mismatched evidence',async()=>{
 const f=await portableFixture(),portable=await verifyCompletion(f.record,f.expected),show=new PublicKey(Buffer.from(f.expected.show,'hex')),device=new PublicKey(Buffer.from(f.device.publicKey,'hex')),signature='2'.repeat(88),slot=91,info=completionAccount(show,f.expected.policy,device,portable.id);
 const base={getSignatureStatuses:async()=>({value:[{err:null,confirmationStatus:'finalized',slot}]}),getSignaturesForAddress:async()=>[{signature,err:null,confirmationStatus:'finalized',slot}],getAccountInfoAndContext:async()=>({context:{slot},value:info})};
 await assert.rejects(verifyCompletionAnchorOnChain({record:f.record,expected:f.expected,connection:{...base,getSignatureStatuses:async()=>({value:[{err:null,confirmationStatus:'confirmed',slot}]})},signature}),/NOT_FINALIZED/);
 await assert.rejects(verifyCompletionAnchorOnChain({record:f.record,expected:f.expected,connection:{...base,getSignaturesForAddress:async()=>[]},signature}),/NOT_BOUND/);
 const wrong=completionAccount(show,f.expected.policy,device,id(31));await assert.rejects(verifyCompletionAnchorOnChain({record:f.record,expected:f.expected,connection:{...base,getAccountInfoAndContext:async()=>({context:{slot},value:wrong})},signature}),/ACCOUNT_MISMATCH/);
 assert.equal(requireDevnetReadRPC('https://api.devnet.solana.com'),'https://api.devnet.solana.com/');
 for(const rpc of ['http://api.devnet.solana.com','https://api.mainnet-beta.solana.com','https://api.devnet.solana.com.evil.example'])assert.throws(()=>requireDevnetReadRPC(rpc),/DEVNET_RPC_REQUIRED/);
});

test('anchor verifier CLI fails closed before any network access',()=>{
 const usage=spawnSync(process.execPath,['tools/verify-completion-anchor.mjs'],{encoding:'utf8'});assert.equal(usage.status,1);assert.match(usage.stderr,/Usage:/);
 const badRpc=spawnSync(process.execPath,['tools/verify-completion-anchor.mjs','missing.json',id(1),id(2),id(3),'https://api.mainnet-beta.solana.com','1'.repeat(88)],{encoding:'utf8'});assert.equal(badRpc.status,1);assert.doesNotMatch(badRpc.stderr,/fetch|network|ECONN/i);
});
