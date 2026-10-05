import {hex} from './swap.mjs';
import {RALLY_BODY_BYTES,RALLY_SIGNED_BYTES,readRallyWire,inspectRallyCall,inspectRallyPacket} from './rally.mjs';
const fail=()=>{throw Error('BAD_RALLY_SESSION');};
const exact=(value,keys)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==keys.slice().sort().join())fail();};

export async function inspectRallySession(text,publicKey){
 let value;try{value=JSON.parse(text);}catch{fail();}exact(value,['version','wire']);if(value.version!==1||typeof value.wire!=='string')fail();
 const decoded=readRallyWire(value.wire);let proof;
 if(decoded.type==='C')proof={call:await inspectRallyCall({body:hex(decoded.bytes.slice(0,RALLY_BODY_BYTES)),signature:hex(decoded.bytes.slice(RALLY_BODY_BYTES,RALLY_SIGNED_BYTES))})};
 else proof=await inspectRallyPacket(decoded.bytes);
 if(proof.call.from!==publicKey&&proof.call.to!==publicKey)fail();
 return Object.freeze({version:1,wire:value.wire,type:decoded.type,bytes:decoded.bytes.slice(),proof});
}

export async function encodeRallySession(wire,publicKey){await inspectRallySession(JSON.stringify({version:1,wire}),publicKey);return JSON.stringify({version:1,wire});}
