import {fromHex,hex,concat,digest} from './swap.mjs';

const enc=new TextEncoder(),BOARD=enc.encode('TONARI/v1/completion-board\0'),SETTLEMENT=enc.encode('TONARI/v1/completion-final-state\0'),ZERO='00'.repeat(32);
const exact=(value,fields)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==[...fields].sort().join())throw Error('BAD_COMPLETION_OWNERSHIP');};
const u32=value=>{if(!Number.isSafeInteger(value)||value<0||value>0xffffffff)throw Error('BAD_COMPLETION_OWNERSHIP');const out=new Uint8Array(4);new DataView(out.buffer).setUint32(0,value,true);return out;};

/** Derive record digests only from a strict finalized 24/24 ownership snapshot. */
export async function completionValueFromOwnership({show,policy,ticket,tiles,completedAt,claimsRoot=ZERO}){
 fromHex(show,32);fromHex(policy,32);fromHex(ticket,32);fromHex(claimsRoot,32);u32(completedAt);
 if(!Array.isArray(tiles)||tiles.length!==24)throw Error('COMPLETION_REQUIRES_24');
 const rows=tiles.map(tile=>{exact(tile,['id','owner','version']);const id=fromHex(tile.id,32);fromHex(tile.owner,32);if(tile.owner!==ticket||!Number.isSafeInteger(tile.version)||tile.version<0||tile.version>0xffffffff)throw Error('COMPLETION_REQUIRES_24');const index=id[0];if(index>23||id.some(value=>value!==index))throw Error('BAD_COMPLETION_OWNERSHIP');return {index,id,version:tile.version};}).sort((a,b)=>a.index-b.index);
 if(rows.some((row,index)=>row.index!==index))throw Error('COMPLETION_REQUIRES_24');
 const body=concat(fromHex(show,32),fromHex(policy,32),fromHex(ticket,32),...rows.flatMap(row=>[row.id,u32(row.version)]));
 const boardDigest=hex(await digest(concat(BOARD,body))),settlementDigest=hex(await digest(concat(SETTLEMENT,body)));
 return Object.freeze({version:1,kind:'portable-signed-record',show,policy,ticket,boardDigest,claimsRoot,settlementDigest,pieces:24,completedAt});
}

export const emptyClaimsRoot=ZERO;
