/** Durable device claim log. Crypto finishes before the serial IndexedDB transaction. */
import {evaluateDrop} from './drop.mjs';
import {signClaim,verifyClaim,verifyClaimLog} from './claims.mjs';
import {fromHex} from './swap.mjs';
export class ClaimStore {
 constructor(db,device){this.db=db;this.device=device;}
 readAll(){return new Promise((resolve,reject)=>{const tx=this.db.transaction('v2claims','readonly'),r=tx.objectStore('v2claims').getAll();let out;r.onsuccess=()=>out=r.result;tx.oncomplete=()=>resolve(out);tx.onabort=()=>reject(tx.error||Error('STORAGE_READ_FAILED'));});}
 async claims(config){
  const scope={show:config.show,policy:config.policy};trustedKey(config,config.checkpointKeys[0]);
  const rows=(await this.readAll()).filter(r=>r.envelope.value.show===config.show&&r.envelope.value.ticket===this.device.publicKey).sort((a,b)=>a.envelope.value.sequence-b.envelope.value.sequence);
  const checked=await verifyClaimLog(rows.map(r=>r.envelope),scope,this.device.publicKey);
  for(let i=0;i<rows.length;i++){
   if(rows[i].id!==checked[i].id)throw Error('CORRUPT_CLAIM');
   const key=trustedKey(config,rows[i].token.value.checkpointKey),outcome=await evaluateDrop(rows[i].token,{show:config.show,policy:config.policy,checkpointKey:key},this.device.publicKey,rows[i].missing,rows[i].acceptedAt);
   const v=checked[i].value,t=rows[i].token.value;if(!outcome.eligible||outcome.digest!==v.tokenDigest||outcome.boardDigest!==v.boardDigest||outcome.tile!==v.tile||t.checkpoint!==v.checkpoint||t.window!==v.window||t.frame!==v.frame)throw Error('INELIGIBLE_CLAIM');
  }return rows.map((r,i)=>({...r,verified:checked[i]}));
 }
 async issueDrop(token,config,missing,now){
  const stableToken=structuredClone(token),stableMissing=structuredClone(missing),scope={show:config.show,policy:config.policy},key=trustedKey(config,stableToken.value.checkpointKey),rows=await this.claims(config);
  const outcome=await evaluateDrop(stableToken,{...scope,checkpointKey:key},this.device.publicKey,stableMissing,now);if(!outcome.eligible)return outcome;
  const previous=rows.at(-1)?.id??'00'.repeat(32),sequence=rows.length,t=stableToken.value;
  const envelope=await signClaim({show:scope.show,policy:scope.policy,ticket:this.device.publicKey,checkpoint:t.checkpoint,window:t.window,frame:t.frame,tile:outcome.tile,tokenDigest:outcome.digest,boardDigest:outcome.boardDigest,previous,sequence},this.device),verified=await verifyClaim(envelope,scope);
  const row={id:verified.id,envelope,token:stableToken,missing:stableMissing,acceptedAt:now};
  return new Promise((resolve,reject)=>{const tx=this.db.transaction('v2claims','readwrite',{durability:'strict'}),s=tx.objectStore('v2claims'),r=s.getAll();let problem;
   r.onsuccess=()=>{try{const current=r.result.filter(x=>x.envelope.value.show===scope.show&&x.envelope.value.ticket===this.device.publicKey).sort((a,b)=>a.envelope.value.sequence-b.envelope.value.sequence),head=current.at(-1)?.id??'00'.repeat(32);if(current.length!==sequence||head!==previous)throw Error('CLAIM_LOG_CHANGED');for(const x of current){const v=x.envelope.value;if(v.tokenDigest===outcome.digest)throw Error('DROP_REPLAY');if(v.checkpoint===t.checkpoint&&v.window===t.window&&v.frame===t.frame)throw Error('FRAME_LIMIT');if(v.tile===outcome.tile)throw Error('TILE_ALREADY_OWNED');}s.add(row);}catch(e){problem=e;tx.abort();}};
   tx.oncomplete=()=>resolve({...outcome,claim:row});tx.onabort=()=>reject(problem||tx.error||Error('CLAIM_COMMIT_FAILED'));
  });
 }
}
function trustedKey(config,key){
 if(!Array.isArray(config?.checkpointKeys)||config.checkpointKeys.length<1||config.checkpointKeys.length>32||new Set(config.checkpointKeys).size!==config.checkpointKeys.length)throw Error('BAD_CHECKPOINT_KEYS');
 for(const candidate of config.checkpointKeys)fromHex(candidate,32);
 if(!config.checkpointKeys.includes(key))throw Error('UNTRUSTED_CHECKPOINT_KEY');return key;
}
