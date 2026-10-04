/** Serial, failure-before-write reference. SIMULATED state, never blockchain finality. */
import {fromHex} from './swap.mjs';
import {inspectPacket,uint32} from './swap-v2.mjs';
const fail=s=>{throw Error(s);};
export class SettlementModel {
 #show;#policy;#deadline;#cap;#tiles=new Map();#tickets=new Map();#receipts=new Map();#nonces=new Set();#pairs=new Set();#tail=Promise.resolve();#clock=0;
 constructor({show,policy,deadline,maxSwaps,tiles}){
  fromHex(show,32);fromHex(policy,32);uint32(deadline);uint32(maxSwaps);if(maxSwaps<1||maxSwaps>24)fail('BAD_CAP');
  if(!Array.isArray(tiles)||tiles.length<2||tiles.length>10000)fail('BAD_TILES');
  for(const t of tiles){fromHex(t.id,32);fromHex(t.owner,32);uint32(t.version);if(this.#tiles.has(t.id))fail('DUPLICATE_TILE');this.#tiles.set(t.id,{id:t.id,owner:t.owner,version:t.version});}
  this.#show=show;this.#policy=policy;this.#deadline=deadline;this.#cap=maxSwaps;
 }
 snapshot(){return {show:this.#show,policy:this.#policy,tiles:[...this.#tiles.values()].map(t=>({...t})),tickets:[...this.#tickets].map(([key,t])=>({key,...t})),receipts:[...this.#receipts.values()].map(r=>({...r})),nonceCount:this.#nonces.size,pairCount:this.#pairs.size,clock:this.#clock};}
 settle(packet,now){
  if(!(packet instanceof Uint8Array))return Promise.reject(Error('BAD_LENGTH'));
  const immutable=packet.slice(),time=now;
  const job=this.#tail.then(async()=>{
   uint32(time);if(time<this.#clock)fail('CLOCK_REGRESSION');
   const r=await inspectPacket(immutable,{show:this.#show,policy:this.#policy,now:time},{settlement:true}),o=r.offer;
   if(time>this.#deadline||o.settleBy>this.#deadline)fail('SHOW_DEADLINE');
   // Exact duplicate is retry-safe, but only after genuine signature/deadline validation.
   if(this.#receipts.has(r.id))return {...this.#receipts.get(r.id),duplicate:true};
   const nonce=`${o.a}:${o.nonce}`,pair=[o.a,o.b].sort().join(':');
   if(this.#nonces.has(nonce))fail('NONCE_REPLAY');if(this.#pairs.has(pair))fail('PAIR_LIMIT');
   const a=this.#tiles.get(o.tileA),b=this.#tiles.get(o.tileB);
   if(!a||!b)fail('UNKNOWN_TILE');if(a.owner!==o.a||b.owner!==o.b)fail('NOT_OWNER');
   if(a.version!==o.versionA||b.version!==o.versionB)fail('STALE_VERSION');
   if(a.version===0xffffffff||b.version===0xffffffff)fail('VERSION_OVERFLOW');
   const tickets=[o.a,o.b].map(key=>this.#tickets.get(key)||{count:0,last:null});
   for(const t of tickets){if(t.count>=this.#cap)fail('SWAP_CAP');if(t.last!==null&&time-t.last<120)fail('COOLDOWN');}
   const receipt={id:r.id,status:'MODEL_SETTLED',ownershipFinal:false,settledAt:time,versionA:a.version+1,versionB:b.version+1,duplicate:false};
   // No await or fallible validation after this point. Chain analogue: one Solana transaction.
   this.#tiles.set(o.tileA,{...a,owner:o.b,version:a.version+1});this.#tiles.set(o.tileB,{...b,owner:o.a,version:b.version+1});
   [o.a,o.b].forEach((key,i)=>this.#tickets.set(key,{count:tickets[i].count+1,last:time}));
   this.#receipts.set(r.id,receipt);this.#nonces.add(nonce);this.#pairs.add(pair);this.#clock=time;
   return {...receipt};
  });this.#tail=job.catch(()=>{});return job;
 }
}
