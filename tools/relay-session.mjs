/** Operator-side public show metadata, never a wallet or device secret. */
import {chmod,mkdir,open,readFile,rename,stat,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Keypair} from '@solana/web3.js';
import {fromHex} from '../packages/protocol/swap.mjs';
function validateBindings(bindings,error){
 if(!Array.isArray(bindings)||bindings.length>3)throw Error(error);
 const slots=new Set(),keys=new Set();for(const row of bindings){if(!Array.isArray(row)||row.length!==2||![0,1,2].includes(row[0])||slots.has(row[0])||keys.has(row[1]))throw Error(error);fromHex(row[1],32);slots.add(row[0]);keys.add(row[1]);}
}
function validate(data){
 if(!data||Object.keys(data).sort().join()!=='bindings,seed,version'||data.version!==1)throw Error('BAD_RELAY_SESSION');
 fromHex(data.seed,32);validateBindings(data.bindings,'BAD_RELAY_SESSION');
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

/** Private identity for the disposable local validator only. Never use this for an owner wallet. */
function validateLocal(data){
 if(!data||Object.keys(data).sort().join()!=='bindings,payer,seed,version'||data.version!==1)throw Error('BAD_LOCAL_RELAY_SESSION');
 fromHex(data.seed,32);const secret=fromHex(data.payer,64);validateBindings(data.bindings,'BAD_LOCAL_RELAY_SESSION');
 try{Keypair.fromSecretKey(secret);}catch{throw Error('BAD_LOCAL_RELAY_SESSION');}
 return data;
}
export async function openLocalRelaySession(directory){
 const dir=resolve(directory);await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
 const lockPath=join(dir,'local.lock'),file=join(dir,'local.json'),temp=join(dir,'local.json.next');
 const lock=await open(lockPath,'wx',0o600);let closed=false;
 const close=async()=>{if(!closed){closed=true;await lock.close();await unlink(lockPath);}};
 async function write(data){validateLocal(data);const out=await open(temp,'w',0o600);try{await out.writeFile(JSON.stringify(data,null,2)+'\n');await out.sync();}finally{await out.close();}await rename(temp,file);const parent=await open(dir,'r');try{await parent.sync();}finally{await parent.close();}}
 try{
  let data;try{data=validateLocal(JSON.parse(await readFile(file,'utf8')));if((await stat(file)).mode&0o077)throw Error('BAD_LOCAL_RELAY_SESSION_PERMISSIONS');}catch(e){if(e.code!=='ENOENT')throw e.message==='BAD_LOCAL_RELAY_SESSION_PERMISSIONS'?e:Error('BAD_LOCAL_RELAY_SESSION');const payer=Keypair.generate();data={version:1,payer:Buffer.from(payer.secretKey).toString('hex'),seed:randomBytes(32).toString('hex'),bindings:[]};await write(data);}
  return {payer:Keypair.fromSecretKey(fromHex(data.payer,64)),seed:fromHex(data.seed,32),bindings:structuredClone(data.bindings),persistBindings:async bindings=>{
   if(closed)throw Error('SESSION_CLOSED');const next={...data,bindings:structuredClone(bindings)};validateLocal(next);
   for(const [slot,key] of data.bindings)if(!next.bindings.some(row=>row[0]===slot&&row[1]===key))throw Error('BINDING_CHANGED');
   await write(next);data=next;
  },close};
 }catch(e){await close();throw e;}
}
