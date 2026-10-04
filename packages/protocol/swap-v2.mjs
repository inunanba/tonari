/** Signed ownership versions and delayed-settlement authorization. No chain finality. */
import {fromHex,hex,concat,digest} from './swap.mjs';
export const BODY_BYTES=240, PACKET_BYTES=368, MAX_SETTLEMENT_DELAY=7*86400;
const MAGIC=Uint8Array.of(84,79,78,65,82,73,0,2);
const ACCEPT=new TextEncoder().encode('TONARI/v2/swap-accept\0');
const fields=['show','a','b','tileA','tileB','nonce','issuedAt','expiresAt','policy','versionA','versionB','settleBy','reserved'];
export function uint32(n){if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)throw Error('BAD_UINT32');return n;}
export function encodeOffer(o){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Object.keys(o).sort().join()!==[...fields].sort().join())throw Error('BAD_FIELDS');
 const out=new Uint8Array(BODY_BYTES);out.set(MAGIC);let p=8;
 for(const f of fields.slice(0,5)){out.set(fromHex(o[f],32),p);p+=32;}
 out.set(fromHex(o.nonce,16),p);p+=16;
 const d=new DataView(out.buffer);d.setUint32(184,uint32(o.issuedAt),true);d.setUint32(188,uint32(o.expiresAt),true);
 out.set(fromHex(o.policy,32),192);
 for(const [i,f] of ['versionA','versionB','settleBy','reserved'].entries())d.setUint32(224+4*i,uint32(o[f]),true);
 if(o.a===o.b)throw Error('SELF_SWAP');if(o.tileA===o.tileB)throw Error('SAME_TILE');
 if(o.expiresAt<=o.issuedAt||o.expiresAt-o.issuedAt>120)throw Error('BAD_TTL');
 if(o.settleBy<o.expiresAt||o.settleBy-o.issuedAt>MAX_SETTLEMENT_DELAY)throw Error('BAD_SETTLEMENT_DEADLINE');
 if(o.reserved!==0)throw Error('BAD_RESERVED');return out;
}
export function decodeOffer(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length!==BODY_BYTES)throw Error('BAD_LENGTH');
 if(!MAGIC.every((n,i)=>bytes[i]===n))throw Error('BAD_DOMAIN');
 const o={};let p=8;for(const f of fields.slice(0,5)){o[f]=hex(bytes.slice(p,p+32));p+=32;}
 o.nonce=hex(bytes.slice(168,184));const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 o.issuedAt=d.getUint32(184,true);o.expiresAt=d.getUint32(188,true);o.policy=hex(bytes.slice(192,224));
 for(const [i,f] of ['versionA','versionB','settleBy','reserved'].entries())o[f]=d.getUint32(224+4*i,true);
 encodeOffer(o);return o;
}
function contextCheck(o,c,settlement){
 if(!c||c.show!==o.show)throw Error('WRONG_SHOW');if(c.policy!==o.policy)throw Error('WRONG_POLICY');uint32(c.now);
 if(c.now<o.issuedAt||c.now>(settlement?o.settleBy:o.expiresAt))throw Error(settlement?'SETTLEMENT_EXPIRED_OR_FUTURE':'EXPIRED_OR_FUTURE');
}
async function verify(pub,sig,msg){const key=await crypto.subtle.importKey('raw',fromHex(pub,32),'Ed25519',false,['verify']);return crypto.subtle.verify('Ed25519',key,sig,msg);}
export async function acceptanceMessage(body,sigA){
 if(!(body instanceof Uint8Array)||body.length!==BODY_BYTES||!(sigA instanceof Uint8Array)||sigA.length!==64)throw Error('BAD_LENGTH');
 const b=body.slice(),s=sigA.slice();decodeOffer(b);return concat(ACCEPT,await digest(b),s);
}
export async function signOffer(device,o){const body=encodeOffer(o);if(device.publicKey!==o.a)throw Error('WRONG_OFFERER');return {body:hex(body),signature:hex(new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,body)))};}
export async function inspectOffer(signed,context){
 const b=fromHex(signed.body,BODY_BYTES),s=fromHex(signed.signature,64),o=decodeOffer(b),c={...context};contextCheck(o,c,false);
 if(!await verify(o.a,s,b))throw Error('BAD_OFFER_SIGNATURE');return o;
}
export async function acceptOffer(device,signed,context){
 const stable={...signed},c={...context},o=await inspectOffer(stable,c);if(device.publicKey!==o.b)throw Error('WRONG_RECIPIENT');
 const b=fromHex(stable.body,BODY_BYTES),s=fromHex(stable.signature,64),msg=await acceptanceMessage(b,s);
 return concat(b,s,new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,msg)));
}
/** Settlement must use chain/show policy time, never unsigned client acceptedAt. */
export async function inspectPacket(packet,context,{settlement=false}={}){
 if(!(packet instanceof Uint8Array)||packet.length!==PACKET_BYTES)throw Error('BAD_LENGTH');
 const p=packet.slice(),c={...context},b=p.slice(0,BODY_BYTES),sA=p.slice(BODY_BYTES,BODY_BYTES+64),sB=p.slice(BODY_BYTES+64),o=decodeOffer(b);
 contextCheck(o,c,settlement);
 if(!await verify(o.a,sA,b))throw Error('BAD_OFFER_SIGNATURE');
 if(!await verify(o.b,sB,await acceptanceMessage(b,sA)))throw Error('BAD_ACCEPT_SIGNATURE');
 return {offer:o,id:hex(await digest(p)),status:'PROVISIONAL',ownershipFinal:false};
}
