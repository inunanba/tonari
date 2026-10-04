import {fromHex,hex} from './swap.mjs';
import {inspectPacket,inspectOffer,BODY_BYTES} from './swap-v2.mjs';
import {verifyAttestation,checkStateAdvance,checkOwned} from './attestation.mjs';
/** Shares the v1 device identity; v2 records live in separate, upgraded IDB stores. */
export class ExchangeStore {
 constructor(db,device){this.db=db;this.device=device;}
 config(){return this.read('v2settings','config');}
 saveConfig(config){return this.write(['v2settings'],(tx,done,abort)=>{const s=tx.objectStore('v2settings'),r=s.get('config');r.onsuccess=()=>{try{if(r.result?.show===config.show&&['issuer','policy','cluster'].some(k=>r.result[k]!==config[k]))throw Error('CONFIG_CHANGED');s.put(structuredClone(config),'config');done();}catch(e){abort(e);}};});}
 read(name,key){return new Promise((resolve,reject)=>{const tx=this.db.transaction(name,'readonly'),r=tx.objectStore(name)[key===undefined?'getAll':'get'](key);let out;r.onsuccess=()=>out=r.result;tx.oncomplete=()=>resolve(out);tx.onabort=()=>reject(tx.error||Error('STORAGE_READ_FAILED'));});}
 write(names,job){return new Promise((resolve,reject)=>{const tx=this.db.transaction(names,'readwrite',{durability:'strict'});let value,error;try{job(tx,v=>value=v,e=>{error=e;tx.abort();});}catch(e){error=e;tx.abort();}tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(error||tx.error||Error('STORAGE_COMMIT_FAILED'));});}
 async state(config){const e=await this.read('v2states',config.show);return e?verifyAttestation(e,config):null;}
 async saveState(envelope,config){
  const e=structuredClone(envelope),next=await verifyAttestation(e,config);if(next.kind!=='state')throw Error('EXPECTED_STATE');
  return this.write(['v2states'],(tx,done,abort)=>{const s=tx.objectStore('v2states'),r=s.get(config.show);r.onsuccess=()=>{try{checkStateAdvance(r.result?.value,next);s.put(e,config.show);done(next);}catch(e){abort(e);}};});
 }
 intent(show){return this.read('v2intents',show);}
 async saveIntent(config,intent,now){
  const stable=intent&&structuredClone(intent);let o;
  if(stable){o=await inspectOffer(stable.signed,{...config,now});if(!['sent','pending'].includes(stable.direction)||o[stable.direction==='sent'?'a':'b']!==this.device.publicKey)throw Error('NOT_PARTICIPANT');}
  return this.write(['v2intents','v2receipts','v2states'],(tx,done,abort)=>{const r=tx.objectStore('v2receipts').getAll();r.onsuccess=()=>{try{
   if(stable){checkReservations(r.result,o);const s=tx.objectStore('v2states').get(config.show);s.onsuccess=()=>{try{if(!s.result)throw Error('STATE_UNAVAILABLE');checkOwned(s.result.value,o);const previous=tx.objectStore('v2intents').get(config.show);previous.onsuccess=()=>{try{if(previous.result&&previous.result.signed.body!==stable.signed.body)throw Error('INTENT_BUSY');tx.objectStore('v2intents').put(stable,config.show);done();}catch(e){abort(e);}};}catch(e){abort(e);}};}
   else{tx.objectStore('v2intents').delete(config.show);done();}
  }catch(e){abort(e);}};});
 }
 async receive(packet,config,now,settlement=null){
  const bytes=packet.slice(),proof=settlement&&structuredClone(settlement),v=proof&&await verifyAttestation(proof,config);
  if(v&&v.kind!=='settled')throw Error('WRONG_SETTLEMENT');
  const r=await inspectPacket(bytes,{...config,now:v?v.observedAt:now},{settlement:true});if(![r.offer.a,r.offer.b].includes(this.device.publicKey))throw Error('NOT_PARTICIPANT');
  if(v&&v.id!==r.id)throw Error('WRONG_SETTLEMENT');
  const row={...r,acceptedAt:v?v.observedAt:now,importedAt:now,packet:hex(bytes),...(proof?{settlement:proof}:{})};
  return this.write(['v2receipts','v2intents','v2states'],(tx,done,abort)=>{const s=tx.objectStore('v2receipts'),q=s.getAll();q.onsuccess=()=>{try{
   checkReservations(q.result,r.offer,r.id);const state=tx.objectStore('v2states').get(config.show);state.onsuccess=()=>{try{
    if(!state.result)throw Error('STATE_UNAVAILABLE');if(!proof)checkOwned(state.result.value,r.offer);
    const intent=tx.objectStore('v2intents').get(config.show);intent.onsuccess=()=>{try{if(!intent.result||intent.result.signed.body!==hex(bytes.slice(0,BODY_BYTES)))throw Error('INTENT_MISMATCH');s.add(row);tx.objectStore('v2intents').delete(config.show);done(proof?{...row,status:'CONFIRMED',ownershipFinal:true}:row);}catch(e){abort(e);}};
   }catch(e){abort(e);}};
  }catch(e){abort(e);}};});
 }
 async receipts(config){
  const rows=(await this.read('v2receipts')).filter(r=>r.offer.show===config.show),out=[];
  for(const row of rows.sort((a,b)=>a.acceptedAt-b.acceptedAt)){
   const r=await inspectPacket(fromHex(row.packet,368),{...config,now:row.acceptedAt},{settlement:true});
   if(r.id!==row.id||![r.offer.a,r.offer.b].includes(this.device.publicKey)||JSON.stringify(r.offer)!==JSON.stringify(row.offer))throw Error('CORRUPT_RECEIPT');
   if(row.settlement){const v=await verifyAttestation(row.settlement,config);if(v.kind!=='settled'||v.id!==r.id)throw Error('WRONG_SETTLEMENT');out.push({...row,...r,status:'CONFIRMED',ownershipFinal:true});}
   else out.push({...row,...r});
  }return out;
 }
 async confirm(id,envelope,config){
  const stable=structuredClone(envelope),v=await verifyAttestation(stable,config);if(v.kind!=='settled'||v.id!==id)throw Error('WRONG_SETTLEMENT');
  // Reverify the immutable signed packet before the atomic update.
  const row=(await this.receipts(config)).find(r=>r.id===id);if(!row)throw Error('RECEIPT_NOT_FOUND');
  return this.write(['v2receipts'],(tx,done,abort)=>{const s=tx.objectStore('v2receipts'),r=s.get(id);r.onsuccess=()=>{try{if(!r.result||r.result.packet!==row.packet)throw Error('RECEIPT_CHANGED');if(r.result.settlement&&r.result.settlement.value.signature!==v.signature)throw Error('SETTLEMENT_CONFLICT');const next={...r.result,settlement:stable};s.put(next);done({...next,status:'CONFIRMED',ownershipFinal:true});}catch(e){abort(e);}};});
 }
}
function checkReservations(rows,o,id){
 for(const r of rows){if(r.offer.show!==o.show)continue;
  if(id===r.id||o.nonce===r.offer.nonce)throw Error('REPLAY');
  if([o.a,o.b].sort().join() === [r.offer.a,r.offer.b].sort().join())throw Error('PAIR_LIMIT');
  // Pending swaps reserve their signed tile versions even while offline.
  if(!r.settlement&&[o.tileA,o.tileB].some(t=>[r.offer.tileA,r.offer.tileB].includes(t)))throw Error('TILE_RESERVED');
 }
}
