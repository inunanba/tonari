import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevice,encodeOffer,decodeOffer,signOffer,acceptOffer,inspectPacket,Inbox,hex,fromHex,BODY_BYTES,PACKET_BYTES} from '../packages/protocol/swap.mjs';
const show='11'.repeat(32), now=2000000000;
async function fixture(extra={}) {
  const a=await createDevice(),b=await createDevice();
  const offer={show,a:a.publicKey,b:b.publicKey,tileA:'aa'.repeat(32),tileB:'bb'.repeat(32),nonce:'cc'.repeat(16),issuedAt:now,expiresAt:now+120,...extra};
  const signed=await signOffer(a,offer),packet=await acceptOffer(b,signed,{show,now});
  return {a,b,offer,signed,packet};
}
test('two independent ephemeral keys sign a 320-byte provisional swap',async()=>{
  const f=await fixture(),r=await inspectPacket(f.packet,{show,now});
  assert.notEqual(f.a.publicKey,f.b.publicKey); assert.equal(f.a.privateKey.extractable,false);
  assert.equal(f.packet.length,PACKET_BYTES); assert.equal(r.status,'PROVISIONAL'); assert.equal(r.ownershipFinal,false);
  assert.deepEqual(r.offer,f.offer);
});
test('codec fixed layout and exact round trip',async()=>{
  const {offer}=await fixture(),bytes=encodeOffer(offer);
  assert.equal(bytes.length,BODY_BYTES); assert.equal(hex(bytes.slice(0,8)),'544f4e4152490001');
  assert.deepEqual(decodeOffer(bytes),offer); assert.equal(new DataView(bytes.buffer).getUint32(184,true),now);
});
test('reject unknown fields and ambiguous hex',async()=>{
  const {offer}=await fixture(); assert.throws(()=>encodeOffer({...offer,extra:0}),/BAD_FIELDS/);
  assert.throws(()=>encodeOffer({...offer,tileA:'AA'.repeat(32)}),/BAD_HEX/);
  assert.throws(()=>fromHex('gg',1),/BAD_HEX/);
});
test('reject self exchange, identical tiles, invalid times',async()=>{
  const {offer}=await fixture();
  for(const update of [{b:offer.a},{tileB:offer.tileA},{expiresAt:now+121},{expiresAt:now},{issuedAt:NaN},{issuedAt:-1},{issuedAt:1.5}]) assert.throws(()=>encodeOffer({...offer,...update}));
});
test('wrong show, expired and future contexts fail closed',async()=>{
  const {packet}=await fixture();
  for(const context of [{show:'22'.repeat(32),now},{show,now:now-1},{show,now:now+121}]) await assert.rejects(inspectPacket(packet,context));
  await inspectPacket(packet,{show,now:now+120});
});
test('all signed regions reject tampering',async()=>{
  const {packet}=await fixture();
  for(const offset of [0,8,40,72,104,136,168,184,188,192,255,256,319]) {
    const bad=packet.slice(); bad[offset]^=1; await assert.rejects(inspectPacket(bad,{show,now}));
  }
});
test('reject truncated and extended packets',async()=>{
  const {packet}=await fixture();
  await assert.rejects(inspectPacket(packet.slice(0,-1),{show,now}),/BAD_LENGTH/);
  await assert.rejects(inspectPacket(new Uint8Array(321),{show,now}),/BAD_LENGTH/);
});
test('third device cannot accept or impersonate offerer',async()=>{
  const f=await fixture(),third=await createDevice();
  await assert.rejects(acceptOffer(third,f.signed,{show,now}),/WRONG_RECIPIENT/);
  await assert.rejects(signOffer(third,f.offer),/WRONG_OFFERER/);
});
test('offer signature cannot substitute for accept domain',async()=>{
  const {packet}=await fixture();packet.set(packet.slice(192,256),256);
  await assert.rejects(inspectPacket(packet,{show,now}),/BAD_ACCEPT_SIGNATURE/);
});
test('concurrent replay: exactly one accepted and queue remains usable',async()=>{
  const f=await fixture(),inbox=new Inbox();
  const r=await Promise.allSettled([inbox.receive(f.packet,{show,now}),inbox.receive(f.packet,{show,now})]);
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
  assert.match(r.find(x=>x.status==='rejected').reason.message,/REPLAY/);
  const second=await fixture();await inbox.receive(second.packet,{show,now});
});
test('same pair with new nonce is rejected even after cooldown',async()=>{
  const f=await fixture(),inbox=new Inbox();await inbox.receive(f.packet,{show,now});
  const o={...f.offer,nonce:'dd'.repeat(16),issuedAt:now+120,expiresAt:now+240};
  const p=await acceptOffer(f.b,await signOffer(f.a,o),{show,now:now+120});
  await assert.rejects(inbox.receive(p,{show,now:now+120}),/PAIR_LIMIT/);
});
test('participant cooldown applies across different counterparties',async()=>{
  const f=await fixture(),c=await createDevice(),inbox=new Inbox();await inbox.receive(f.packet,{show,now});
  const o={...f.offer,b:c.publicKey,nonce:'de'.repeat(16)};
  const p=await acceptOffer(c,await signOffer(f.a,o),{show,now});
  await assert.rejects(inbox.receive(p,{show,now}),/COOLDOWN/);
  await inbox.receive(p,{show,now:now+120});
});
test('invalid signature does not consume local replay state',async()=>{
  const f=await fixture(),inbox=new Inbox(),bad=f.packet.slice();bad[319]^=1;
  await assert.rejects(inbox.receive(bad,{show,now}));await inbox.receive(f.packet,{show,now});
});
test('snapshot prevents caller mutation during signature verification',async()=>{
  const f=await fixture(),pending=inspectPacket(f.packet,{show,now});f.packet.fill(0);
  assert.equal((await pending).offer.show,show);
});
test('local replay state is explicitly not global finality',async()=>{
  const f=await fixture();
  assert.equal((await new Inbox().receive(f.packet,{show,now})).ownershipFinal,false);
  assert.equal((await new Inbox().receive(f.packet,{show,now})).ownershipFinal,false);
});
