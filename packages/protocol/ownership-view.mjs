import {fromHex} from './swap.mjs';

/** Build a deterministic 24-piece view from an already verified state attestation. */
export function ownershipView(state, publicKey){
 fromHex(publicKey,32);
 if(!state||!Array.isArray(state.tiles)||state.tiles.length>24)throw Error('BAD_OWNERSHIP_BOARD');
 const issued=state.tiles.map(tile=>{
  if(!tile||Object.keys(tile).sort().join()!==['id','owner','version'].join())throw Error('BAD_OWNERSHIP_TILE');
  const bytes=fromHex(tile.id,32);fromHex(tile.owner,32);
  if(!Number.isSafeInteger(tile.version)||tile.version<0||tile.version>0xffffffff)throw Error('BAD_OWNERSHIP_VERSION');
  const index=bytes[0];if(index>23||bytes.some(value=>value!==index))throw Error('BAD_OWNERSHIP_TILE');
  return {index,number:index+1,id:tile.id,owner:tile.owner,version:tile.version,owned:tile.owner===publicKey};
 }).sort((a,b)=>a.index-b.index);
 if(issued.some((cell,index)=>index&&cell.index===issued[index-1].index))throw Error('BAD_OWNERSHIP_BOARD');
 const byIndex=new Map(issued.map(cell=>[cell.index,cell])),cells=Array.from({length:24},(_,index)=>byIndex.get(index)||{index,number:index+1,id:null,owner:null,version:null,owned:false,issued:false});
 for(const cell of issued)cell.issued=true;
 return {cells,owned:issued.filter(cell=>cell.owned).length,issued:issued.length,total:24};
}
