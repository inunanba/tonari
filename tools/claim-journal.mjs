/** Atomic local claim-operator journal. Contains an unrevealed secret; keep outside the repository. */
import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';

export async function openClaimJournal(directory){
 const dir=resolve(directory);await mkdir(dir,{recursive:true,mode:0o700});const lockPath=join(dir,'claim.lock'),file=join(dir,'claim.json'),temp=join(dir,'claim.json.next'),lock=await open(lockPath,'wx',0o600);let closed=false,state=null;
 const close=async()=>{if(!closed){closed=true;await lock.close();await unlink(lockPath);}};
 async function write(value){if(closed)throw Error('JOURNAL_CLOSED');const out=await open(temp,'w',0o600);try{await out.writeFile(JSON.stringify(value,null,2)+'\n');await out.sync();}finally{await out.close();}await rename(temp,file);const parent=await open(dir,'r');try{await parent.sync();}finally{await parent.close();}}
 try{try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('BAD_CLAIM_JOURNAL');}
  return {state:structuredClone(state),persistState:async value=>{if(value===null)throw Error('CLAIM_JOURNAL_DELETE_FORBIDDEN');await write(value);state=structuredClone(value);},close};
 }catch(e){await close();throw e;}
}
