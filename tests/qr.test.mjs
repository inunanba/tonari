import {test} from 'node:test';import assert from 'node:assert/strict';
import {qrRaster,scanRaster} from '../packages/protocol/qr.mjs';
import {publicKeyWire,signedOfferWire,encodeWire,readReceiptWire} from '../packages/protocol/wire.mjs';
import {createDevice,signOffer,acceptOffer,inspectPacket} from '../packages/protocol/swap.mjs';
async function fixture(){const a=await createDevice(),b=await createDevice();const offer={show:'11'.repeat(32),a:a.publicKey,b:b.publicKey,tileA:'01'.repeat(32),tileB:'02'.repeat(32),nonce:'00'.repeat(16),issuedAt:100,expiresAt:220};const context={show:offer.show,now:100};const signed=await signOffer(a,offer),packet=await acceptOffer(b,signed,context);return {a,b,signed,packet,context};}
test('independent QR encoder and decoder preserve all three signed wire stages as images',async()=>{
 const f=await fixture();for(const wire of [publicKeyWire(f.b.publicKey),signedOfferWire(f.signed),encodeWire('R',f.packet)])for(const scale of [2,4,6]) {
   const r=qrRaster(wire,scale);assert.equal(r.quietZone,4);assert.equal(scanRaster(r.data,r.width,r.height),wire);
 }
 const r=qrRaster(encodeWire('R',f.packet));assert.equal((await inspectPacket(readReceiptWire(scanRaster(r.data,r.width,r.height)),f.context)).ownershipFinal,false);
});
test('QR remains decodable after a 90-degree rotation and inverted colors',()=>{
 const text=publicKeyWire('ab'.repeat(32)),r=qrRaster(text,4),rotated=new Uint8ClampedArray(r.data.length);
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)for(let c=0;c<4;c++)rotated[(x*r.width+(r.width-1-y))*4+c]=r.data[(y*r.width+x)*4+c];
 assert.equal(scanRaster(rotated,r.width,r.height),text);
 for(let i=0;i<rotated.length;i++)if(i%4!==3)rotated[i]=255-rotated[i];assert.equal(scanRaster(rotated,r.width,r.height),text);
});
test('blank and malformed images do not become exchange data',()=>{
 const blank=new Uint8ClampedArray(64*64*4);blank.fill(255);assert.equal(scanRaster(blank,64,64),null);
 assert.throws(()=>scanRaster(blank,1281,64),/IMAGE_SIZE/);assert.throws(()=>scanRaster(blank,64,65),/IMAGE_SIZE/);assert.throws(()=>qrRaster('https://example.test'),/WIRE/);
});
