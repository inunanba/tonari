/** The configured show authority attests RPC observations. This is not an SPV proof. */
import {hex,fromHex} from './swap.mjs';
import {uint32} from './swap-v2.mjs';
const encoder=new TextEncoder();
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==keys.slice().sort().join())throw Error('BAD_ATTESTATION_FIELDS');}
export function attestationBytes(value){
 const common=['kind','show','policy','issuer','cluster','slot','observedAt'];
 const keys=value?.kind==='state'?[...common,'deadline','paused','tiles']:value?.kind==='settled'?[...common,'id','signature','commitment']:[];
 exact(value,keys);
 for(const k of ['show','policy','issuer'])fromHex(value[k],32);
 if(!['localnet','devnet'].includes(value.cluster)||!Number.isSafeInteger(value.slot)||value.slot<0)throw Error('BAD_ATTESTATION_SCOPE');
 uint32(value.observedAt);
 let canonical={};for(const k of common)canonical[k]=value[k];
 if(value.kind==='state'){
  uint32(value.deadline);if(typeof value.paused!=='boolean'||!Array.isArray(value.tiles)||value.tiles.length>24)throw Error('BAD_STATE');
  const ids=new Set();canonical={...canonical,deadline:value.deadline,paused:value.paused,tiles:value.tiles.map(t=>{
   exact(t,['id','owner','version']);fromHex(t.id,32);fromHex(t.owner,32);uint32(t.version);if(ids.has(t.id))throw Error('DUPLICATE_TILE');ids.add(t.id);return {id:t.id,owner:t.owner,version:t.version};
  }).sort((a,b)=>a.id.localeCompare(b.id))};
 }else{
  fromHex(value.id,32);if(!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value.signature)||value.commitment!=='finalized')throw Error('NOT_FINALIZED');
  canonical={...canonical,id:value.id,signature:value.signature,commitment:value.commitment};
 }
 return encoder.encode('TONARI/v2/authority-observation\0'+JSON.stringify(canonical));
}
export async function verifyAttestation(envelope,config){
 exact(envelope,['value','signature']);const value=structuredClone(envelope.value),bytes=attestationBytes(value);
 for(const key of ['show','policy','issuer','cluster'])if(value[key]!==config[key])throw Error('WRONG_ATTESTATION_SCOPE');
 const key=await crypto.subtle.importKey('raw',fromHex(config.issuer,32),'Ed25519',false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,fromHex(envelope.signature,64),bytes))throw Error('BAD_AUTHORITY_SIGNATURE');
 return value;
}
export async function signAttestation(value,device){return {value:structuredClone(value),signature:hex(new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,attestationBytes(value))))};}
export function checkStateAdvance(old,next){
 if(!old)return;
 if(next.slot<old.slot)throw Error('STALE_STATE');
 const byId=new Map(next.tiles.map(t=>[t.id,t]));
 for(const t of old.tiles){const n=byId.get(t.id);if(!n||n.version<t.version||n.version===t.version&&n.owner!==t.owner)throw Error('OWNERSHIP_ROLLBACK');}
}
export function checkOwned(state,offer){
 if(state.paused)throw Error('SHOW_PAUSED');if(offer.settleBy>state.deadline)throw Error('SHOW_DEADLINE');
 for(const side of ['A','B']){const t=state.tiles.find(t=>t.id===offer['tile'+side]);if(!t||t.owner!==offer[side.toLowerCase()]||t.version!==offer['version'+side])throw Error('STALE_OWNERSHIP');}
}
