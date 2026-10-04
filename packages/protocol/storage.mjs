import {createDevice,inspectPacket,inspectOffer,fromHex,hex,signOffer,encodeOffer} from './swap.mjs';
import {checkReceipt} from './ledger.mjs';

/** Browser-local store. Crypto completes BEFORE opening the write transaction. */
export class DeviceStore {
  #db; #device;
  constructor(db,device) {this.#db=db;this.#device=device;}
  static async open(namespace) {
    if(!/^(client|phone)-[012]$/.test(namespace)) throw new Error('BAD_NAMESPACE');
    if(!globalThis.indexedDB) throw new Error('STORAGE_UNAVAILABLE');
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open(`tonari-v1-${namespace}`,1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('identity');r.result.createObjectStore('receipts',{keyPath:'id'});r.result.createObjectStore('intents');};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      r.onblocked=()=>reject(new Error('STORAGE_BLOCKED'));
    });
    db.onversionchange=()=>db.close();
    const candidate=await createDevice();
    const device=await new Promise((resolve,reject)=>{
      const tx=db.transaction('identity','readwrite',{durability:'strict'}),s=tx.objectStore('identity');let value;
      const r=s.get('device');r.onsuccess=()=>{value=r.result||candidate;if(!r.result)s.add(candidate,'device');};
      tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||new Error('IDENTITY_COMMIT_FAILED'));
    }).catch(e=>{db.close();throw e;});
    if(device?.privateKey?.extractable!==false || device.privateKey.algorithm?.name!=='Ed25519' || !device.privateKey.usages.includes('sign')) {db.close();throw new Error('INVALID_IDENTITY');}
    // Verify stored public/private pairing, without exporting the private key.
    const challenge={show:'00'.repeat(32),a:device.publicKey,b:'ff'.repeat(32),tileA:'01'.repeat(32),tileB:'02'.repeat(32),nonce:'00'.repeat(16),issuedAt:0,expiresAt:1};
    const signed=await signOffer(device,challenge);
    await inspectOffer(signed,{show:challenge.show,now:0}).catch(e=>{db.close();throw e;});
    return new DeviceStore(db,device);
  }
  get device() {return this.#device;}
  close() {this.#db.close();}
  #read(store,method,key) {
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction(store,'readonly'),r=tx.objectStore(store)[method](key);let value;
      r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||new Error('STORAGE_READ_FAILED'));
    });
  }
  async receipts(show) {
    const rows=(await this.#read('receipts','getAll')).filter(r=>r.offer.show===show);
    // Restore immutable signed bytes at the original acceptance time, not today's clock.
    // Historical verification never makes an expired offer acceptable as a new swap.
    const verified=[];
    for(const row of rows.sort((a,b)=>a.acceptedAt-b.acceptedAt)) {
      const r=await inspectPacket(fromHex(row.packet,320),{show,now:row.acceptedAt});
      if(r.id!==row.id || hex(encodeOffer(r.offer))!==hex(encodeOffer(row.offer))) throw new Error('CORRUPT_RECEIPT');
      checkReceipt(verified,{...r,acceptedAt:row.acceptedAt},this.device.publicKey);verified.push({...row,...r});
    }
    return verified;
  }
  async receive(packet,context) {
    const snapshot=packet.slice(),ctx={...context};
    const r=await inspectPacket(snapshot,ctx);
    const receipt={...r,acceptedAt:ctx.now,packet:hex(snapshot)};
    // All browser tabs for this namespace serialize through one IDB readwrite transaction.
    // The packet, replay policy, and clearing the pending intent commit atomically.
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction(['receipts','intents'],'readwrite',{durability:'strict'}),s=tx.objectStore('receipts');let problem;
      const req=s.getAll();req.onsuccess=()=>{
        try {checkReceipt(req.result,receipt,this.device.publicKey);s.add(receipt);tx.objectStore('intents').delete(ctx.show);}
        catch(e){problem=e;tx.abort();}
      };
      tx.oncomplete=()=>resolve(receipt);tx.onabort=()=>reject(problem||tx.error||new Error('RECEIPT_COMMIT_FAILED'));
    });
  }
  intent(show) {return this.#read('intents','get',show);}
  saveIntent(show,value) {
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction('intents','readwrite',{durability:'strict'});
      if(value===null)tx.objectStore('intents').delete(show);else tx.objectStore('intents').put(value,show);
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('INTENT_COMMIT_FAILED'));
    });
  }
}
