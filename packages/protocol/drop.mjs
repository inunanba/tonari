/** Signed checkpoint DropToken and deterministic device outcome. No global cap claim. */
import {fromHex,hex,concat,digest} from './swap.mjs';
import {uint32} from './swap-v2.mjs';
const enc=new TextEncoder(),DOMAIN=enc.encode('TONARI/v2/drop\0');
const REVEAL_DOMAIN=enc.encode('TONARI/v2/drop-reveal\0'),FRAME_DOMAIN=enc.encode('TONARI/v2/drop-frame\0');
const fields=['show','policy','checkpointKey','checkpoint','window','frame','validFrom','validTo','probabilityPPM','cap','nonce'];
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==keys.slice().sort().join())throw Error('BAD_DROP_FIELDS');}
function u32(n){uint32(n);const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;}
export function dropBytes(value){
 exact(value,fields);for(const k of ['show','policy','checkpointKey','nonce'])fromHex(value[k],32);
 for(const k of fields.slice(3,10))uint32(value[k]);
 if(value.validTo<=value.validFrom||value.validTo-value.validFrom>60)throw Error('BAD_DROP_TTL');
 if(value.probabilityPPM>1_000_000||value.cap<1||value.cap>65535)throw Error('BAD_DROP_POLICY');
 return concat(DOMAIN,fromHex(value.show,32),fromHex(value.policy,32),fromHex(value.checkpointKey,32),...fields.slice(3,10).map(k=>u32(value[k])),fromHex(value.nonce,32));
}
export async function signDrop(value,checkpoint){
 const snapshot=structuredClone(value),bytes=dropBytes(snapshot);if(snapshot.checkpointKey!==checkpoint.publicKey)throw Error('WRONG_CHECKPOINT_KEY');
 return {value:snapshot,signature:hex(new Uint8Array(await crypto.subtle.sign('Ed25519',checkpoint.privateKey,bytes)))};
}
export async function verifyDrop(envelope,expected,now){
 exact(envelope,['value','signature']);const e=structuredClone(envelope),bytes=dropBytes(e.value);
 exact(expected,['show','policy','checkpointKey']);for(const k of Object.keys(expected))if(e.value[k]!==expected[k])throw Error('WRONG_DROP_SCOPE');
 uint32(now);if(now<e.value.validFrom||now>e.value.validTo)throw Error('DROP_EXPIRED_OR_FUTURE');
 const key=await crypto.subtle.importKey('raw',fromHex(e.value.checkpointKey,32),'Ed25519',false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,fromHex(e.signature,64),bytes))throw Error('BAD_DROP_SIGNATURE');
 return {envelope:e,digest:hex(await digest(concat(enc.encode('TONARI/v2/drop-id\0'),bytes,fromHex(e.signature,64))))};
}
function missingTiles(values){if(!Array.isArray(values)||values.length<1||values.length>24)throw Error('BAD_MISSING_TILES');const out=[...values];for(const x of out)fromHex(x,32);out.sort();if(new Set(out).size!==out.length)throw Error('BAD_MISSING_TILES');return out;}
export async function missingTilesDigest(values){const tiles=missingTiles(structuredClone(values));return hex(await digest(concat(enc.encode('TONARI/v2/missing-tiles\0'),...tiles.map(x=>fromHex(x,32)))));}
export async function dropRevealCommitment(show,policy,window,secret){
 uint32(window);return hex(await digest(concat(REVEAL_DOMAIN,fromHex(show,32),fromHex(policy,32),u32(window),fromHex(secret,32))));
}
export async function dropFrameNonce(show,policy,window,frame,secret){
 uint32(window);uint32(frame);return hex(await digest(concat(FRAME_DOMAIN,fromHex(show,32),fromHex(policy,32),u32(window),u32(frame),fromHex(secret,32))));
}
export async function verifyDropReveal(envelope,secret,commitment){
 const value=structuredClone(envelope?.value);dropBytes(value);fromHex(commitment,32);
 if(await dropRevealCommitment(value.show,value.policy,value.window,secret)!==commitment)throw Error('DROP_REVEAL_COMMITMENT_MISMATCH');
 if(await dropFrameNonce(value.show,value.policy,value.window,value.frame,secret)!==value.nonce)throw Error('DROP_REVEAL_NONCE_MISMATCH');
 return {window:value.window,frame:value.frame,nonce:value.nonce};
}
export async function evaluateDrop(envelope,expected,ticket,missing,now){
 fromHex(ticket,32);const token=await verifyDrop(envelope,expected,now),tiles=missingTiles(structuredClone(missing));
 const scoreBytes=await digest(concat(enc.encode('TONARI/v2/drop-outcome\0'),fromHex(envelope.signature,64),fromHex(ticket,32)));
 const score=new DataView(scoreBytes.buffer,scoreBytes.byteOffset,8).getBigUint64(0,false),limit=(1n<<64n)*BigInt(token.envelope.value.probabilityPPM)/1_000_000n;
 const boardDigest=await missingTilesDigest(tiles);
 if(score>=limit)return {...token,eligible:false,tile:null,boardDigest,score:score.toString()};
 const pick=await digest(concat(enc.encode('TONARI/v2/drop-tile\0'),fromHex(token.digest,32),fromHex(ticket,32)));
 const index=Number(new DataView(pick.buffer,pick.byteOffset,4).getUint32(0,false)%tiles.length);
 return {...token,eligible:true,tile:tiles[index],boardDigest,score:score.toString()};
}
