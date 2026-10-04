import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDevice,signOffer,acceptOffer,fromHex,concat,digest,decodeOffer} from '../packages/protocol/swap.mjs';
import {swapSignatureInstructions,assertSignatureBinding,signatureInstruction} from '../packages/protocol/precompile.mjs';
const bytes=n=>n.toString(16).padStart(2,'0').repeat(32);
async function fixture(){const a=await createDevice(),b=await createDevice(),offer={show:bytes(1),a:a.publicKey,b:b.publicKey,tileA:bytes(2),tileB:bytes(3),nonce:'04'.repeat(16),issuedAt:100,expiresAt:220};const packet=await acceptOffer(b,await signOffer(a,offer),{show:offer.show,now:101});return {packet,offer};}
test('precompile pair binds original offer and distinct acceptance domain with actual valid signatures',async()=>{
 const {packet,offer}=await fixture(),ix=await swapSignatureInstructions(packet),body=packet.slice(0,192),sigA=packet.slice(192,256),sigB=packet.slice(256),accept=concat(new TextEncoder().encode('TONARI/v1/swap-accept\0'),await digest(body),sigA);
 for(const [i,key,sig,msg] of [[0,offer.a,sigA,body],[1,offer.b,sigB,accept]]){
  assert.deepEqual(assertSignatureBinding(ix[i],key,sig,msg),{bound:true,signatureVerified:false});
  const k=await crypto.subtle.importKey('raw',fromHex(key,32),'Ed25519',false,['verify']);assert.equal(await crypto.subtle.verify('Ed25519',k,ix[i].data.slice(48,112),ix[i].data.slice(112)),true);
 }
 assert.equal(ix[0].data.length,304);assert.equal(ix[1].data.length,230);
 assert.throws(()=>assertSignatureBinding(ix[0],offer.b,sigB,accept),/BINDING/);
});
test('reject all header/offset changes, external references, substitute program/account/message/signature and trailing data',async()=>{
 const {packet,offer}=await fixture(),[ix]=await swapSignatureInstructions(packet),body=packet.slice(0,192),sig=packet.slice(192,256);
 for(let i=0;i<ix.data.length;i++) {const data=ix.data.slice();data[i]^=1;assert.throws(()=>assertSignatureBinding({...ix,data},offer.a,sig,body),/BINDING/);}
 for(const bad of [{...ix,programId:offer.a},{...ix,accounts:[offer.a]},{...ix,data:concat(ix.data,new Uint8Array(1))},{...ix,data:ix.data.slice(1)}])assert.throws(()=>assertSignatureBinding(bad,offer.a,sig,body),/BINDING/);
});
test('instruction builder snapshots inputs and malformed packet cannot bypass strict offer codec',async()=>{
 const sig=new Uint8Array(64),msg=new Uint8Array([1,2,3]),ix=signatureInstruction(bytes(4),sig,msg);sig[0]=9;msg[0]=9;assert.equal(ix.data[48],0);assert.equal(ix.data[112],1);
 const {packet}=await fixture();packet[0]=0;await assert.rejects(swapSignatureInstructions(packet),/BAD_DOMAIN/);
 assert.throws(()=>signatureInstruction(bytes(4),new Uint8Array(63),msg),/INPUT/);
});
