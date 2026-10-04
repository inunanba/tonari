/** Operator-side public show metadata, never a wallet or device secret. */
import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fromHex} from '../packages/protocol/swap.mjs';
function validate(data){
 if(!data||Object.keys(data).sort().join()!=='bindings,seed,version'||data.version!==1)throw Error('BAD_RELAY_SESSION');
 fromHex(data.seed,32);if(!Array.isArray(data.bindings)||data.bindings.length>3)throw Error('BAD_RELAY_SESSION');
 const slots=new Set(),keys=new Set();for(const row of data.bindings){if(!Array.isArray(row)||row.length!==2||![0,1,2].includes(row[0])||slots.has(row[0])||keys.has(row[1]))throw Error('BAD_RELAY_SESSION');fromHex(row[1],32);slots.add(row[0]);keys.add(row[1]);}
 return data;
}
export async function openRelaySession(directory){
 const dir=resolve(directory);await mkdir(dir,{recursive:true,mode:0o700});
 const lockPath=join(dir,'relay.lock'),file=join(dir,'show.json'),temp=join(dir,'show.json.next');
 const lock=await open(lockPath,'wx',0o600);let closed=false;
 const close=async()=>{if(!closed){closed=true;await lock.close();await unlink(lockPath);}};
 async function write(data){validate(data);const out=await open(temp,'w',0o600);try{await out.writeFile(JSON.stringify(data,null,2)+'\n');await out.sync();}finally{await out.close();}await rename(temp,file);const parent=await open(dir,'r');try{await parent.sync();}finally{await parent.close();}}
 try{
  let data;try{data=validate(JSON.parse(await readFile(file,'utf8')));}catch(e){if(e.code!=='ENOENT')throw Error('BAD_RELAY_SESSION');data={version:1,seed:randomBytes(32).toString('hex'),bindings:[]};await write(data);}
  return {seed:fromHex(data.seed,32),bindings:structuredClone(data.bindings),persistBindings:async bindings=>{
   if(closed)throw Error('SESSION_CLOSED');const next={...data,bindings:structuredClone(bindings)};validate(next);
   for(const [slot,key] of data.bindings)if(!next.bindings.some(row=>row[0]===slot&&row[1]===key))throw Error('BINDING_CHANGED');
   await write(next);data=next;
  },close};
 }catch(e){await close();throw e;}
}
