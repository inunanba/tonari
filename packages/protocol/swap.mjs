/** TONARI offline swap v1. Authenticated intent, NOT settled ownership. */
const enc = new TextEncoder();
const MAGIC = new Uint8Array([84,79,78,65,82,73,0,1]);
const ACCEPT = enc.encode('TONARI/v1/swap-accept\0');
export const BODY_BYTES = 192;
export const PACKET_BYTES = 320;
const fields = ['show','a','b','tileA','tileB','nonce','issuedAt','expiresAt'];
function fail(reason) { throw new Error(reason); }
export function fromHex(s, length) {
  if (typeof s !== 'string' || s.length !== length * 2 || !/^[0-9a-f]+$/.test(s)) fail('BAD_HEX');
  return Uint8Array.from(s.match(/../g), x => parseInt(x,16));
}
export function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join(''); }
export function concat(...arrays) {
  const out = new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));
  let offset=0; for(const a of arrays) { out.set(a,offset); offset+=a.length; } return out;
}
export async function digest(bytes) { return new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)); }
function u32(n) { if(!Number.isSafeInteger(n)||n<0||n>0xffffffff) fail('BAD_TIME'); return n; }
export function encodeOffer(o) {
  if(!o || Object.getPrototypeOf(o)!==Object.prototype || Object.keys(o).sort().join()!==[...fields].sort().join()) fail('BAD_FIELDS');
  const out=new Uint8Array(BODY_BYTES); out.set(MAGIC);
  let pos=8;
  for(const f of fields.slice(0,5)) { out.set(fromHex(o[f],32),pos); pos+=32; }
  out.set(fromHex(o.nonce,16),pos); pos+=16;
  new DataView(out.buffer).setUint32(pos,u32(o.issuedAt),true);
  new DataView(out.buffer).setUint32(pos+4,u32(o.expiresAt),true);
  if(o.a===o.b) fail('SELF_SWAP');
  if(o.tileA===o.tileB) fail('SAME_TILE');
  if(o.expiresAt<=o.issuedAt || o.expiresAt-o.issuedAt>120) fail('BAD_TTL');
  return out;
}
export function decodeOffer(bytes) {
  if(!(bytes instanceof Uint8Array)||bytes.length!==BODY_BYTES) fail('BAD_LENGTH');
  if(!MAGIC.every((v,i)=>bytes[i]===v)) fail('BAD_DOMAIN');
  let pos=8; const o={};
  for(const f of fields.slice(0,5)) { o[f]=hex(bytes.slice(pos,pos+32)); pos+=32; }
  o.nonce=hex(bytes.slice(pos,pos+16)); pos+=16;
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  o.issuedAt=d.getUint32(pos,true); o.expiresAt=d.getUint32(pos+4,true);
  encodeOffer(o); return o;
}
export async function createDevice() {
  const keys=await crypto.subtle.generateKey('Ed25519',false,['sign','verify']);
  return {privateKey:keys.privateKey, publicKey:hex(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)))};
}
async function verify(pub,signature,message) {
  const key=await crypto.subtle.importKey('raw',fromHex(pub,32),'Ed25519',false,['verify']);
  return crypto.subtle.verify('Ed25519',key,signature,message);
}
function timeAndShow(o, context) {
  if(!context || context.show!==o.show) fail('WRONG_SHOW');
  u32(context.now);
  // Reference flow uses strict time. Clock disagreement requires resync, never silent extra validity.
  if(context.now<o.issuedAt || context.now>o.expiresAt) fail('EXPIRED_OR_FUTURE');
}
export async function signOffer(device,offer) {
  const body=encodeOffer(offer);
  if(device.publicKey!==offer.a) fail('WRONG_OFFERER');
  const signature=new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,body));
  return {body:hex(body),signature:hex(signature)};
}
export async function inspectOffer(signed,context) {
  const body=fromHex(signed.body,BODY_BYTES), signature=fromHex(signed.signature,64);
  const offer=decodeOffer(body); timeAndShow(offer,context);
  if(!await verify(offer.a,signature,body)) fail('BAD_OFFER_SIGNATURE');
  return offer;
}
export async function acceptOffer(device,signed,context) {
  const offer=await inspectOffer(signed,context);
  if(device.publicKey!==offer.b) fail('WRONG_RECIPIENT');
  const body=fromHex(signed.body,BODY_BYTES), sigA=fromHex(signed.signature,64);
  const message=concat(ACCEPT,await digest(body),sigA);
  const sigB=new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,message));
  return concat(body,sigA,sigB);
}
export async function inspectPacket(packet,context) {
  if(!(packet instanceof Uint8Array)||packet.length!==PACKET_BYTES) fail('BAD_LENGTH');
  // Snapshot before awaiting: caller mutation cannot change the bytes under validation.
  const snapshot=packet.slice();
  const body=snapshot.slice(0,BODY_BYTES), sigA=snapshot.slice(BODY_BYTES,BODY_BYTES+64), sigB=snapshot.slice(BODY_BYTES+64);
  const offer=decodeOffer(body); timeAndShow(offer,context);
  if(!await verify(offer.a,sigA,body)) fail('BAD_OFFER_SIGNATURE');
  if(!await verify(offer.b,sigB,concat(ACCEPT,await digest(body),sigA))) fail('BAD_ACCEPT_SIGNATURE');
  return {offer,id:hex(await digest(snapshot)),status:'PROVISIONAL',ownershipFinal:false};
}

/** In-memory reference only. IndexedDB transaction + chain settlement are subsequent slices. */
export class Inbox {
  #packets=new Set(); #nonces=new Set(); #pairs=new Set(); #last=new Map();
  #queue=Promise.resolve();
  receive(packet,context) {
    const immutable=packet.slice(), ctx={...context};
    const job=this.#queue.then(async()=>{
      const r=await inspectPacket(immutable,ctx), o=r.offer;
      const nonce=`${o.show}:${o.a}:${o.nonce}`;
      const pair=`${o.show}:${[o.a,o.b].sort().join(':')}`;
      if(this.#packets.has(r.id)||this.#nonces.has(nonce)) fail('REPLAY');
      if(this.#pairs.has(pair)) fail('PAIR_LIMIT');
      for(const pub of [o.a,o.b]) {
        const last=this.#last.get(`${o.show}:${pub}`);
        if(last!==undefined && ctx.now-last<120) fail('COOLDOWN');
      }
      this.#packets.add(r.id); this.#nonces.add(nonce); this.#pairs.add(pair);
      for(const pub of [o.a,o.b]) this.#last.set(`${o.show}:${pub}`,ctx.now);
      return r;
    });
    this.#queue=job.catch(()=>{}); return job;
  }
}
