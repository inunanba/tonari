import {concat,digest,fromHex} from './swap.mjs';

const enc=new TextEncoder(),DRAW=enc.encode('TONARI/v1/tiered-missing-draw\0'),PIECE=enc.encode('TONARI/v1/tiered-missing-piece\0');
const values=Object.freeze({seat:30_000,crowded:10_000,quiet:180_000});
const exact=(value,fields)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==[...fields].sort().join())throw Error('BAD_TIERED_CHANCE');};
const integer=(value,max=0xffffffff)=>{if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('BAD_TIERED_CHANCE');return value;};
const u32=value=>{const out=new Uint8Array(4);new DataView(out.buffer).setUint32(0,integer(value),true);return out;};

export const tierChancePPM=values;

/** Three honest chance tiers with strict per-spot and total caps. */
export function tieredAvailability({spots,homeSpot,spotGiven,totalGiven,spotCap,totalCap,enabled=true}){
 if(!Array.isArray(spots)||spots.length<2||spots.length>32||typeof homeSpot!=='string'||!Array.isArray(spotGiven)||spotGiven.length!==spots.length)throw Error('BAD_TIERED_CHANCE');
 if(typeof enabled!=='boolean')throw Error('BAD_TIERED_CHANCE');
 integer(totalGiven,0xffff);integer(spotCap,0xffff);integer(totalCap,0xffff);
 if(spotCap<1||totalCap<1)throw Error('BAD_TIERED_CHANCE');
 const seen=new Set(),rows=spots.map((spot,index)=>{exact(spot,['id','crowding']);if(typeof spot.id!=='string'||!/^[A-Z][A-Z0-9]{1,15}$/.test(spot.id)||seen.has(spot.id)||!['crowded','quiet'].includes(spot.crowding))throw Error('BAD_TIERED_CHANCE');seen.add(spot.id);integer(spotGiven[index],0xffff);const tier=spot.id===homeSpot?'seat':spot.crowding,open=enabled&&totalGiven<totalCap&&spotGiven[index]<spotCap,chancePPM=open?values[tier]:0;return Object.freeze({id:spot.id,tier,chancePPM,open});});
 if(!seen.has(homeSpot))throw Error('BAD_TIERED_CHANCE');
 const recommended=rows.filter(row=>row.open&&row.id!==homeSpot).sort((a,b)=>b.chancePPM-a.chancePPM||a.id.localeCompare(b.id))[0]?.id??null;
 return Object.freeze({rows:Object.freeze(rows),recommended,totalOpen:totalGiven<totalCap});
}

async function uniform(material,modulus,domain){
 integer(modulus,0x1000000);if(modulus<1)throw Error('BAD_TIERED_CHANCE');const limit=Math.floor(2**32/modulus)*modulus;
 for(let counter=0;counter<256;counter++){const bytes=await digest(concat(domain,material,u32(counter))),value=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,true);if(value<limit)return value%modulus;}
 throw Error('TIERED_DRAW_EXHAUSTED');
}

/** Deterministic attempt that can award only one of the ticket's missing IDs. */
export async function drawNotOwnedPiece({availability,spotId,seed,ticket,frame,owned}){
 if(!availability||!Array.isArray(availability.rows)||typeof spotId!=='string'||!Array.isArray(owned))throw Error('BAD_TIERED_CHANCE');
 const row=availability.rows.find(value=>value.id===spotId);if(!row)throw Error('BAD_TIERED_CHANCE');const seedBytes=fromHex(seed,32),ticketBytes=fromHex(ticket,32);integer(frame);
 const unique=new Set(owned.map(value=>integer(value,23)));if(unique.size!==owned.length)throw Error('BAD_TIERED_CHANCE');const missing=Array.from({length:24},(_,index)=>index).filter(index=>!unique.has(index));if(!missing.length)throw Error('NO_MISSING_PIECES');
 const spot=enc.encode(spotId),material=concat(seedBytes,ticketBytes,u32(frame),new Uint8Array([spot.length]),spot),rollPPM=await uniform(material,1_000_000,DRAW);
 const awarded=row.open&&rollPPM<row.chancePPM?missing[await uniform(material,missing.length,PIECE)]:null;
 return Object.freeze({spotId,tier:row.tier,chancePPM:row.chancePPM,rollPPM,awarded,missingCount:missing.length});
}
