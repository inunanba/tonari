import {fromHex} from '../../packages/protocol/swap.mjs';

const uint=(value,name)=>{if(!Number.isSafeInteger(value)||value<0||value>0xffffffff)throw Error('BAD_'+name);return value;};

export function participantMissing(state,ticket){
 fromHex(ticket,32);if(!state||!Array.isArray(state.tiles)||state.tiles.length<1||state.tiles.length>24)throw Error('BAD_STATE');
 const seen=new Set(),missing=[];
 for(const tile of state.tiles){if(!tile||typeof tile.id!=='string'||typeof tile.owner!=='string')throw Error('BAD_STATE');fromHex(tile.id,32);fromHex(tile.owner,32);if(seen.has(tile.id))throw Error('BAD_STATE');seen.add(tile.id);if(tile.owner!==ticket)missing.push(tile.id);}
 if(!missing.length)throw Error('NO_MISSING_TILES');return missing;
}

export function claimAvailability(status,now){
 uint(now,'NOW');if(!status||typeof status.status!=='string')throw Error('BAD_CLAIM_STATUS');
 if(status.status==='UNAVAILABLE'||status.status==='IDLE'||status.status==='ROOT_POSTED'||status.status==='REVEALED')return {ready:false,reason:status.status};
 if(status.status!=='OPEN')throw Error('BAD_CLAIM_STATUS');uint(status.validFrom,'VALID_FROM');uint(status.validTo,'VALID_TO');
 if(now<status.validFrom)return {ready:false,reason:'NOT_STARTED'};if(now>status.validTo)return {ready:false,reason:'CLOSED'};return {ready:true,reason:'OPEN'};
}

export function randomClaimFrame(fill=values=>crypto.getRandomValues(values)){const values=new Uint32Array(1);fill(values);return uint(values[0],'FRAME');}

export function latestClaim(rows){if(!Array.isArray(rows)||!rows.length)return null;const sorted=[...rows].sort((a,b)=>a.envelope.value.sequence-b.envelope.value.sequence);return structuredClone(sorted.at(-1));}
