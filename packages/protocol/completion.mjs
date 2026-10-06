/** Portable dual-signed completion evidence. This is not a mint or chain anchor. */
import {fromHex,hex,concat,digest} from './swap.mjs';
import {validateJourney,journeyComplete} from '../games/judge-journey.mjs';

const enc=new TextEncoder();
const DEVICE=enc.encode('TONARI/v2/completion-device\0');
const AUTHORITY=enc.encode('TONARI/v2/completion-authority\0');
const ID=enc.encode('TONARI/v2/completion-id\0');
const valueFields=['version','kind','show','policy','ticket','boardDigest','claimsRoot','settlementDigest','pieces','completedAt'];
const exact=(value,fields,error)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==[...fields].sort().join())throw Error(error);};
const u32=n=>{if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)throw Error('BAD_COMPLETION_TIME');const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;};
const verify=async(pub,sig,message)=>crypto.subtle.verify('Ed25519',await crypto.subtle.importKey('raw',fromHex(pub,32),'Ed25519',false,['verify']),fromHex(sig,64),message);

export function completionBytes(value){
 exact(value,valueFields,'BAD_COMPLETION_FIELDS');
 if(value.version!==1||value.kind!=='portable-signed-record'||value.pieces!==24)throw Error('BAD_COMPLETION_VALUE');
 return concat(
  enc.encode('TONARI/v2/completion\0'),
  new Uint8Array([value.version]),
  enc.encode('portable-signed-record\0'),
  fromHex(value.show,32),fromHex(value.policy,32),fromHex(value.ticket,32),
  fromHex(value.boardDigest,32),fromHex(value.claimsRoot,32),fromHex(value.settlementDigest,32),
  new Uint8Array([value.pieces]),u32(value.completedAt)
 );
}

export async function signCompletion(value,device,journey){
 const state=validateJourney(structuredClone(journey));
 if(!journeyComplete(state)||state.tiles!==24)throw Error('JOURNEY_INCOMPLETE');
 return signFinalizedCompletion(value,device);
}

/** Sign a server-recomputed finalized 24/24 ownership value. */
export async function signFinalizedCompletion(value,device){
 const snapshot=structuredClone(value),bytes=completionBytes(snapshot);
 if(snapshot.ticket!==device.publicKey)throw Error('WRONG_COMPLETION_DEVICE');
 return {value:snapshot,deviceSignature:hex(new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,concat(DEVICE,bytes))))};
}

export async function verifyCompletionRequest(request,expected){
 exact(request,['value','deviceSignature'],'BAD_COMPLETION_REQUEST');
 exact(expected,['show','policy'],'BAD_COMPLETION_SCOPE');
 const snapshot=structuredClone(request),bytes=completionBytes(snapshot.value);
 if(snapshot.value.show!==expected.show||snapshot.value.policy!==expected.policy)throw Error('WRONG_COMPLETION_SCOPE');
 if(!await verify(snapshot.value.ticket,snapshot.deviceSignature,concat(DEVICE,bytes)))throw Error('BAD_COMPLETION_DEVICE_SIGNATURE');
 return snapshot;
}

export async function attestCompletion(request,authority,expected){
 const checked=await verifyCompletionRequest(request,expected),bytes=completionBytes(checked.value);
 return {
  value:checked.value,
  deviceSignature:checked.deviceSignature,
  authority:authority.publicKey,
  authoritySignature:hex(new Uint8Array(await crypto.subtle.sign('Ed25519',authority.privateKey,concat(AUTHORITY,bytes,fromHex(checked.deviceSignature,64)))))
 };
}

export async function verifyCompletion(record,expected){
 exact(record,['value','deviceSignature','authority','authoritySignature'],'BAD_COMPLETION_RECORD');
 exact(expected,['show','policy','authority'],'BAD_COMPLETION_SCOPE');
 const snapshot=structuredClone(record);
 await verifyCompletionRequest({value:snapshot.value,deviceSignature:snapshot.deviceSignature},{show:expected.show,policy:expected.policy});
 if(snapshot.authority!==expected.authority)throw Error('WRONG_COMPLETION_AUTHORITY');
 const bytes=completionBytes(snapshot.value);
 if(!await verify(snapshot.authority,snapshot.authoritySignature,concat(AUTHORITY,bytes,fromHex(snapshot.deviceSignature,64))))throw Error('BAD_COMPLETION_AUTHORITY_SIGNATURE');
 const id=hex(await digest(concat(ID,bytes,fromHex(snapshot.deviceSignature,64),fromHex(snapshot.authoritySignature,64))));
 return Object.freeze({
  integrity:'VERIFIED',
  id,
  recipient:snapshot.value.ticket,
  pieces:24,
  completedAt:snapshot.value.completedAt,
  portableRecord:'VERIFIED',
  cNFT:'NOT_VERIFIED',
  onChainAnchor:'NOT_VERIFIED',
  nonTransferability:'NOT_VERIFIED'
 });
}
