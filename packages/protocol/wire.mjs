import {fromHex,hex,concat,decodeOffer} from './swap.mjs';
const lengths={K:32,O:256,R:320};
const prefix=type=>`TONARI1:${type}:`;
function encode(bytes) {return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
/** No URL, wallet request, executable payload, optional fields or private keys. */
export function encodeWire(type,bytes) {
  if(!Object.hasOwn(lengths,type)||!(bytes instanceof Uint8Array)||bytes.length!==lengths[type])throw new Error('BAD_WIRE_LENGTH');
  if(type!=='K')decodeOffer(bytes.slice(0,192));
  return prefix(type)+encode(bytes);
}
export function decodeWire(text) {
  if(typeof text!=='string'||text.length>438)throw new Error('BAD_WIRE_LENGTH');
  const match=/^TONARI1:([KOR]):([A-Za-z0-9_-]+)$/.exec(text);
  if(!match)throw new Error('BAD_WIRE_DOMAIN');
  const [,type,encoded]=match,n=lengths[type];
  if(encoded.length!==Math.ceil(n*8/6))throw new Error('BAD_WIRE_LENGTH');
  let bytes;try{bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-encoded.length%4)%4)),c=>c.charCodeAt(0));}catch{throw new Error('BAD_WIRE_BASE64');}
  if(bytes.length!==n||encode(bytes)!==encoded)throw new Error('NONCANONICAL_WIRE');
  if(type!=='K')decodeOffer(bytes.slice(0,192));
  return {type,bytes};
}
export function publicKeyWire(publicKey) {return encodeWire('K',fromHex(publicKey,32));}
export function signedOfferWire(signed) {return encodeWire('O',concat(fromHex(signed.body,192),fromHex(signed.signature,64)));}
export function readPublicKeyWire(text) {const r=decodeWire(text);if(r.type!=='K')throw new Error('EXPECTED_KEY');return hex(r.bytes);}
export function readSignedOfferWire(text) {const r=decodeWire(text);if(r.type!=='O')throw new Error('EXPECTED_OFFER');return {body:hex(r.bytes.slice(0,192)),signature:hex(r.bytes.slice(192))};}
export function readReceiptWire(text) {const r=decodeWire(text);if(r.type!=='R')throw new Error('EXPECTED_RECEIPT');return r.bytes;}
