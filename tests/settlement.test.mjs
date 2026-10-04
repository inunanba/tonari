import test from 'node:test';import assert from 'node:assert/strict';
import {createDevice,hex,fromHex} from '../packages/protocol/swap.mjs';
import {BODY_BYTES,encodeOffer,decodeOffer,signOffer,acceptOffer,inspectPacket} from '../packages/protocol/swap-v2.mjs';
import {SettlementModel} from '../packages/protocol/settlement.mjs';
import {swapSignatureInstructions} from '../packages/protocol/precompile-v2.mjs';
const h=n=>n.toString(16).padStart(2,'0').repeat(32),show=h(1),policy=h(9),now=1000;
async function fixture(extra={}){
 const [a,b,c,d]=await Promise.all(Array.from({length:4},()=>createDevice()));
 const o={show,policy,a:a.publicKey,b:b.publicKey,tileA:h(2),tileB:h(3),nonce:'aa'.repeat(16),issuedAt:now,expiresAt:now+120,versionA:0,versionB:4,settleBy:now+86400,reserved:0,...extra};
 const tiles=[{id:h(2),owner:a.publicKey,version:0},{id:h(3),owner:b.publicKey,version:4},{id:h(4),owner:c.publicKey,version:0},{id:h(5),owner:d.publicKey,version:0}];
 const signed=await signOffer(a,o),packet=await acceptOffer(b,signed,{show,policy,now});
 const model=new SettlementModel({show,policy,deadline:now+86400,maxSwaps:24,tiles});return {a,b,c,d,o,signed,packet,tiles,model};
}
async function packetFor(a,b,o){return acceptOffer(b,await signOffer(a,o),{show,policy,now:o.issuedAt});}
test('v2 exact canonical layout authenticates both versions and settlement deadline',async()=>{
 const f=await fixture(),body=encodeOffer(f.o);assert.equal(body.length,240);assert.equal(f.packet.length,368);assert.deepEqual(decodeOffer(body),f.o);
 assert.equal(new DataView(body.buffer).getUint32(228,true),4);assert.equal(hex(body.slice(0,8)),'544f4e4152490002');
 for(const changes of [{versionA:-1},{versionB:0.5},{reserved:1},{settleBy:now+604801},{settleBy:now+119},{extra:1}])assert.throws(()=>encodeOffer({...f.o,...changes}));
});
test('signed fields and both signature domains reject every-byte tampering',async()=>{
 const f=await fixture();for(let i=0;i<f.packet.length;i++){const p=f.packet.slice();p[i]^=1;await assert.rejects(inspectPacket(p,{show,policy,now}));}
 await assert.rejects(inspectPacket(f.packet,{show,policy:h(8),now}),/WRONG_POLICY/);
 const p=f.packet.slice();p.set(p.slice(BODY_BYTES,BODY_BYTES+64),BODY_BYTES+64);await assert.rejects(inspectPacket(p,{show,policy,now}),/BAD_ACCEPT_SIGNATURE/);
});
test('offline expiry strict; delayed settlement uses jointly signed deadline, no acceptedAt trust',async()=>{
 const f=await fixture();await assert.rejects(inspectPacket(f.packet,{show,policy,now:now+121}),/EXPIRED/);
 await assert.rejects(acceptOffer(f.b,f.signed,{show,policy,now:now+121,acceptedAt:now}),/EXPIRED/);
 const r=await f.model.settle(f.packet,now+200);assert.equal(r.status,'MODEL_SETTLED');assert.equal(r.ownershipFinal,false);
 await assert.rejects(f.model.settle(f.packet,now+86401),/SETTLEMENT_EXPIRED/);
});
test('successful settlement swaps owners, increments exact versions and does not mutate third device',async()=>{
 const f=await fixture(),before=f.model.snapshot();const r=await f.model.settle(f.packet,now+121),s=f.model.snapshot();
 assert.deepEqual(s.tiles.slice(0,2),[{id:h(2),owner:f.b.publicKey,version:1},{id:h(3),owner:f.a.publicKey,version:5}]);assert.deepEqual(s.tiles.slice(2),before.tiles.slice(2));assert.equal(s.tickets.length,2);
 r.status='FORGED';s.tiles[0].version=99;assert.equal(f.model.snapshot().tiles[0].version,1);
});
test('same receipt concurrent retry applies once, returns idempotent duplicate',async()=>{
 const f=await fixture(),rs=await Promise.all([f.model.settle(f.packet,now),f.model.settle(f.packet,now)]);assert.equal(rs.filter(r=>r.duplicate).length,1);assert.equal(f.model.snapshot().receipts.length,1);assert.equal(f.model.snapshot().tickets[0].count,1);
});
test('conflicting offline exchange first-settled wins; loser changes nothing',async()=>{
 const f=await fixture(),p=await packetFor(f.a,f.c,{...f.o,b:f.c.publicKey,tileB:h(4),versionB:0,nonce:'bb'.repeat(16)});
 const results=await Promise.allSettled([f.model.settle(f.packet,now),f.model.settle(p,now)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results[1].reason.message,/NOT_OWNER/);assert.equal(f.model.snapshot().pairCount,1);
});
test('forged signatures, signed stale versions and absent ownership leave complete state unchanged',async()=>{
 const f=await fixture(),before=f.model.snapshot(),bad=f.packet.slice();bad[367]^=1;
 const stale=await packetFor(f.a,f.b,{...f.o,versionA:1}),absent=await packetFor(f.a,f.b,{...f.o,tileA:h(6)});
 for(const p of [bad,stale,absent]){await assert.rejects(f.model.settle(p,now));assert.deepEqual(f.model.snapshot(),before);}
 await f.model.settle(f.packet,now);
});
test('same pair cannot trade again even with current owners, versions and fresh nonce',async()=>{
 const f=await fixture();await f.model.settle(f.packet,now);const p=await packetFor(f.b,f.a,{...f.o,a:f.b.publicKey,b:f.a.publicKey,versionA:1,versionB:5,nonce:'bb'.repeat(16),issuedAt:now+120,expiresAt:now+240});
 await assert.rejects(f.model.settle(p,now+120),/PAIR_LIMIT/);
});
test('cooldown uses model settlement time; exact120 boundary succeeds, failed retry consumes nothing',async()=>{
 const f=await fixture();await f.model.settle(f.packet,now+200);
 const p=await packetFor(f.a,f.c,{...f.o,tileA:h(3),tileB:h(4),versionA:5,versionB:0,b:f.c.publicKey,nonce:'bb'.repeat(16),issuedAt:now+210,expiresAt:now+330});
 const before=f.model.snapshot();await assert.rejects(f.model.settle(p,now+319),/COOLDOWN/);assert.deepEqual(f.model.snapshot(),before);await f.model.settle(p,now+320);
});
test('ticket caps and unsigned show-deadline extension cannot bypass trusted policy',async()=>{
 const f=await fixture(),m=new SettlementModel({show,policy,deadline:now+86400,maxSwaps:1,tiles:f.tiles});await m.settle(f.packet,now);
 const p=await packetFor(f.a,f.c,{...f.o,tileA:h(3),tileB:h(4),versionA:5,versionB:0,b:f.c.publicKey,nonce:'bb'.repeat(16),issuedAt:now+120,expiresAt:now+240});const before=m.snapshot();await assert.rejects(m.settle(p,now+120),/SWAP_CAP/);assert.deepEqual(m.snapshot(),before);
 const short=new SettlementModel({show,policy,deadline:now+500,maxSwaps:24,tiles:f.tiles});await assert.rejects(short.settle(f.packet,now),/SHOW_DEADLINE/);
});
test('ownership version overflow, clock regression, malformed config fail closed',async()=>{
 const f=await fixture({versionA:0xffffffff}),tiles=f.tiles.map(t=>({...t,version:t.id===h(2)?0xffffffff:t.version})),m=new SettlementModel({show,policy,deadline:now+86400,maxSwaps:24,tiles});
 await assert.rejects(m.settle(f.packet,now),/OVERFLOW/);assert.equal(m.snapshot().receipts.length,0);
 const g=await fixture();await g.model.settle(g.packet,now+200);await assert.rejects(g.model.settle(g.packet,now+199),/CLOCK_REGRESSION/);
 assert.throws(()=>new SettlementModel({show,policy,deadline:now,maxSwaps:0,tiles}));assert.throws(()=>new SettlementModel({show,policy,deadline:now,maxSwaps:24,tiles:[tiles[0],tiles[0]]}),/DUPLICATE_TILE/);
});
test('snapshot packet at invocation prevents asynchronous caller mutation',async()=>{
 const f=await fixture(),pending=f.model.settle(f.packet,now);f.packet.fill(0);assert.equal((await pending).status,'MODEL_SETTLED');
});
test('v2 precompile bytes verify actual Ed25519 signatures over240/118 bytes',async()=>{
 const f=await fixture(),ix=await swapSignatureInstructions(f.packet);assert.deepEqual(ix.map(i=>i.data.length),[352,230]);
 for(const [i,pub] of [[0,f.a.publicKey],[1,f.b.publicKey]]){const key=await crypto.subtle.importKey('raw',fromHex(pub,32),'Ed25519',false,['verify']);assert.equal(await crypto.subtle.verify('Ed25519',key,ix[i].data.slice(48,112),ix[i].data.slice(112)),true);}
});
test('v2 key/offer/receipt QR images preserve exact signed bytes and reject downgrade',async()=>{
 const {qrRaster,scanRaster}=await import('../packages/protocol/qr.mjs');const wire=await import('../packages/protocol/wire-v2.mjs');const old=await import('../packages/protocol/wire.mjs');
 const f=await fixture(),texts=[wire.publicKeyWire(f.b.publicKey),wire.signedOfferWire(f.signed),wire.encodeWire('R',f.packet)];
 assert.deepEqual(texts.map(t=>t.length),[53,416,501]);
 for(const text of texts){const r=qrRaster(text,3);assert.equal(scanRaster(r.data,r.width,r.height),text);assert.throws(()=>old.decodeWire(text),/WIRE/);assert.throws(()=>wire.decodeWire(text.replace('TONARI2','TONARI1')),/DOMAIN/);}
 assert.deepEqual(wire.readSignedOfferWire(texts[1]),f.signed);assert.deepEqual(wire.readReceiptWire(texts[2]),f.packet);
 assert.throws(()=>wire.decodeWire(texts[2]+'='),/LENGTH/);
});
