import {fromHex,hex,concat} from './swap.mjs';
import {BODY_BYTES,decodeOffer} from './swap-v2.mjs';
const lengths={K:32,O:304,R:368};
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function encodeWire(type,bytes){
 if(!Object.hasOwn(lengths,type)||!(bytes instanceof Uint8Array)||bytes.length!==lengths[type])throw Error('BAD_WIRE_LENGTH');
 if(type!=='K')decodeOffer(bytes.slice(0,BODY_BYTES));return `TONARI2:${type}:`+b64(bytes);
}
export function decodeWire(text){
 if(typeof text!=='string'||text.length>501)throw Error('BAD_WIRE_LENGTH');const match=/^TONARI2:([KOR]):([A-Za-z0-9_-]+)$/.exec(text);if(!match)throw Error('BAD_WIRE_DOMAIN');
 const [,type,encoded]=match,n=lengths[type];if(encoded.length!==Math.ceil(n*8/6))throw Error('BAD_WIRE_LENGTH');
 let bytes;try{bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-encoded.length%4)%4)),c=>c.charCodeAt(0));}catch{throw Error('BAD_WIRE_BASE64');}
 if(bytes.length!==n||b64(bytes)!==encoded)throw Error('NONCANONICAL_WIRE');if(type!=='K')decodeOffer(bytes.slice(0,BODY_BYTES));return {type,bytes};
}
export const publicKeyWire=key=>encodeWire('K',fromHex(key,32));
export const signedOfferWire=s=>encodeWire('O',concat(fromHex(s.body,BODY_BYTES),fromHex(s.signature,64)));
export function readSignedOfferWire(text){const r=decodeWire(text);if(r.type!=='O')throw Error('EXPECTED_OFFER');return {body:hex(r.bytes.slice(0,BODY_BYTES)),signature:hex(r.bytes.slice(BODY_BYTES))};}
export function readReceiptWire(text){const r=decodeWire(text);if(r.type!=='R')throw Error('EXPECTED_RECEIPT');return r.bytes;}
