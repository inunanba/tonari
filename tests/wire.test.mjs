import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDevice,signOffer,acceptOffer,inspectOffer,inspectPacket} from '../packages/protocol/swap.mjs';
import {publicKeyWire,signedOfferWire,readPublicKeyWire,readSignedOfferWire,encodeWire,decodeWire,readReceiptWire} from '../packages/protocol/wire.mjs';
async function fixture(){const a=await createDevice(),b=await createDevice();const offer={show:'11'.repeat(32),a:a.publicKey,b:b.publicKey,tileA:'01'.repeat(32),tileB:'02'.repeat(32),nonce:'00'.repeat(16),issuedAt:100,expiresAt:220};const context={show:offer.show,now:100};const signed=await signOffer(a,offer),packet=await acceptOffer(b,signed,context);return {a,b,offer,signed,packet,context};}
test('three QR stages roundtrip without exporting private keys, retaining real signatures',async()=>{
 const f=await fixture();assert.equal(readPublicKeyWire(publicKeyWire(f.b.publicKey)),f.b.publicKey);
 const signed=readSignedOfferWire(signedOfferWire(f.signed));assert.deepEqual(await inspectOffer(signed,f.context),f.offer);
 const packet=readReceiptWire(encodeWire('R',f.packet));assert.equal((await inspectPacket(packet,f.context)).ownershipFinal,false);
 assert.deepEqual(packet,f.packet);
});
test('exact wire size: public key53, signed offer352, receipt437 ASCII characters',async()=>{
 const f=await fixture();assert.equal(publicKeyWire(f.b.publicKey).length,53);assert.equal(signedOfferWire(f.signed).length,352);assert.equal(encodeWire('R',f.packet).length,437);
});
test('reject schemes, other apps, unsupported types, padding, whitespace and oversized input',()=>{
 const good=publicKeyWire('01'.repeat(32));
 for(const bad of ['https://'+good,'solana:'+good,good.replace('TONARI1','TONARI2'),good.replace(':K:',':X:'),good+'=',good+'\n',' '+good,'A'.repeat(5000)])assert.throws(()=>decodeWire(bad));
});
test('reject noncanonical unused base64 bits and wrong exact byte size',()=>{
 const good=publicKeyWire('00'.repeat(32));assert.throws(()=>decodeWire(good.slice(0,-1)+'B'),/NONCANONICAL/);
 assert.throws(()=>decodeWire(good.slice(0,-1)),/LENGTH/);assert.throws(()=>encodeWire('R',new Uint8Array(319)),/LENGTH/);
});
test('wrong-stage payload cannot substitute key, offer or accepted receipt',async()=>{
 const f=await fixture(),key=publicKeyWire(f.a.publicKey),offer=signedOfferWire(f.signed),receipt=encodeWire('R',f.packet);
 assert.throws(()=>readPublicKeyWire(offer),/EXPECTED_KEY/);assert.throws(()=>readSignedOfferWire(receipt),/EXPECTED_OFFER/);assert.throws(()=>readReceiptWire(key),/EXPECTED_RECEIPT/);
});
test('wire decoder does not pretend structural validity is signature authenticity',async()=>{
 const f=await fixture(),tampered=f.packet.slice();tampered[256]^=1;
 const parsed=readReceiptWire(encodeWire('R',tampered));await assert.rejects(inspectPacket(parsed,f.context),/BAD_ACCEPT_SIGNATURE/);
});
