import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {PublicKey,Keypair,SYSVAR_INSTRUCTIONS_PUBKEY,SystemProgram} from '@solana/web3.js';
import {assertSignatureBinding} from '../packages/protocol/precompile.mjs';
import {completionAddress,completionAnchorMessage,completionAnchorInstructions,discriminator,readAccount,PROGRAM_ID} from '../tools/chain-client.mjs';

const {subtle}=webcrypto;
const bytes=n=>Buffer.alloc(32,n);
async function fixture(){
 const keys=await subtle.generateKey('Ed25519',true,['sign','verify']);
 const raw=Buffer.from(await subtle.exportKey('raw',keys.publicKey));
 const authority=Keypair.generate().publicKey,show=new PublicKey(bytes(4)),device=new PublicKey(raw),policy=bytes(5),digest=bytes(6);
 const message=completionAnchorMessage(show,policy,device,digest);
 const signature=new Uint8Array(await subtle.sign('Ed25519',keys.privateKey,message));
 return {authority,show,device,policy,digest,message,signature};
}

test('completion anchor binds one device signature to show, policy and record digest',async()=>{
 const f=await fixture(),[verify,anchor]=completionAnchorInstructions(f.authority,f.show,f.policy,f.device,f.digest,f.signature);
 assertSignatureBinding({programId:verify.programId.toBase58(),accounts:[],data:new Uint8Array(verify.data)},f.device.toBuffer().toString('hex'),f.signature,f.message);
 assert.equal(anchor.programId.toBase58(),PROGRAM_ID.toBase58());
 assert.deepEqual(anchor.data.subarray(0,8),discriminator('global','anchor_completion'));
 assert.deepEqual(anchor.data.subarray(8,40),f.device.toBuffer());
 assert.deepEqual(anchor.data.subarray(40),f.digest);
 assert.deepEqual(anchor.keys.map(x=>x.pubkey.toBase58()),[f.authority,f.show,completionAddress(f.show,f.device),SYSVAR_INSTRUCTIONS_PUBKEY,SystemProgram.programId].map(x=>x.toBase58()));
 assert.deepEqual(anchor.keys.map(x=>[x.isWritable,x.isSigner]),[[true,true],[false,false],[true,false],[false,false],[false,false]]);
});

test('anchor message and PDA reject substitution and zero digest',async()=>{
 const f=await fixture();
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
 const f=await fixture(),data=Buffer.alloc(141);
 discriminator('account','Completion').copy(data,0);f.show.toBuffer().copy(data,8);f.policy.copy(data,40);f.device.toBuffer().copy(data,72);f.digest.copy(data,104);data.writeUInt32LE(1791234567,136);data[140]=250;
 const decoded=readAccount({owner:PROGRAM_ID,data},'Completion');
 assert.equal(decoded.show.toBase58(),f.show.toBase58());assert.equal(decoded.device.toBase58(),f.device.toBase58());
 assert.deepEqual(decoded.policy,f.policy);assert.deepEqual(decoded.recordDigest,f.digest);assert.equal(decoded.anchoredAt,1791234567);
 assert.equal('mint' in decoded,false);assert.equal('token' in decoded,false);assert.equal('nonTransferable' in decoded,false);
});
