/** Local validator sponsor only. No wallet files, remote RPC, or public deployment. */
import {randomBytes,createPrivateKey,sign} from 'node:crypto';
import {Connection,Keypair,PublicKey,sendAndConfirmTransaction} from '@solana/web3.js';
import * as chain from './chain-client.mjs';
import {attestationBytes} from '../packages/protocol/attestation.mjs';
import {inspectPacket,decodeOffer} from '../packages/protocol/swap-v2.mjs';
import {hex,fromHex} from '../packages/protocol/swap.mjs';
export const tileId=n=>Buffer.alloc(32,n);
export const joinMessage=(config,client,key)=>new TextEncoder().encode(`TONARI/v2/local-join\0${config.show}:${client}:${key}`);
export function requireLocalRPC(rpc){const u=new URL(rpc);if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash)throw Error('LOCAL_RPC_REQUIRED');return rpc;}
export async function createLocalRelay(rpc,{onSubmitted=()=>{}}={}){
 const c=new Connection(requireLocalRPC(rpc),'finalized'),payer=Keypair.generate(),seed=randomBytes(32),show=chain.showAddress(seed);
 if(!(await c.getAccountInfo(chain.PROGRAM_ID,'finalized'))?.executable)throw Error('LOCAL_PROGRAM_NOT_LOADED');
 const funding=await c.requestAirdrop(payer.publicKey,5e9);await c.confirmTransaction(funding,'finalized');
 const privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(payer.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
 const attest=value=>({value,signature:sign(null,attestationBytes(value),privateKey).toString('hex')});
 async function clock(){const slot=await c.getSlot('finalized'),now=await c.getBlockTime(slot);if(!Number.isInteger(now))throw Error('CLOCK_UNAVAILABLE');return now;}
 async function send(instructions){const latest=await c.getLatestBlockhash('finalized'),tx=chain.transaction(payer.publicKey,latest.blockhash,instructions);if(chain.serializedSize(tx)>1232)throw Error('TX_TOO_LARGE');return sendAndConfirmTransaction(c,tx,[payer],{commitment:'finalized',skipPreflight:false});}
 const deadline=(await clock())+1800;
 await send([chain.createShow(payer.publicKey,seed,deadline,24)]);
 const config={show:hex(show.toBytes()),policy:hex(chain.policyHash(show,deadline,24)),issuer:hex(payer.publicKey.toBytes()),cluster:'localnet',programId:chain.PROGRAM_ID.toBase58()};
 const clients=new Map(),allIds=[0,1,2,8,9,10,16,17,18],receipts=new Map();let tail=Promise.resolve();
 const serial=job=>{const result=tail.then(job);tail=result.catch(()=>{});return result;};
 const common=(kind,slot,observedAt)=>({kind,...Object.fromEntries(['show','policy','issuer','cluster'].map(k=>[k,config[k]])),slot,observedAt});
 async function state(){
  const result=await c.getMultipleAccountsInfoAndContext([show,...allIds.map(n=>chain.tileAddress(show,tileId(n)))],{commitment:'finalized'});
  const s=chain.readAccount(result.value[0],'Show');if(!s.authority.equals(payer.publicKey)||hex(s.policy)!==config.policy)throw Error('SHOW_CHANGED');
  const tiles=result.value.slice(1).flatMap((info,i)=>{if(!info)return [];const t=chain.readAccount(info,'Tile');if(!t.show.equals(show)||!t.id.equals(tileId(allIds[i])))throw Error('TILE_SUBSTITUTION');return [{id:hex(t.id),owner:hex(t.owner.toBytes()),version:t.version}];});
  return attest({...common('state',result.context.slot,await clock()),deadline:s.deadline,paused:s.paused,tiles});
 }
 async function join({client,publicKey,proof}){
  if(![0,1,2].includes(client))throw Error('BAD_CLIENT');const pub=fromHex(publicKey,32),key=await crypto.subtle.importKey('raw',pub,'Ed25519',false,['verify']);
  if(!await crypto.subtle.verify('Ed25519',key,fromHex(proof,64),joinMessage(config,client,publicKey)))throw Error('BAD_JOIN_SIGNATURE');
  return serial(async()=>{if(clients.has(client)){if(clients.get(client)!==publicKey)throw Error('CLIENT_ALREADY_BOUND');return state();}
   if([...clients.values()].includes(publicKey))throw Error('DUPLICATE_CLIENT');
   const owner=new PublicKey(pub),ids=[client,client+8,client+16],existing=await c.getMultipleAccountsInfo([chain.ticketAddress(show,owner),...ids.map(n=>chain.tileAddress(show,tileId(n)))],'finalized');
   if(existing.slice(1).some(Boolean)){
    if(!existing[0]||existing.slice(1).some(i=>!i||!chain.readAccount(i,'Tile').owner.equals(owner)))throw Error('CLIENT_ALREADY_BOUND');
    const ticket=chain.readAccount(existing[0],'Ticket');if(!ticket.show.equals(show)||!ticket.owner.equals(owner))throw Error('BAD_TICKET');
   }else await send([chain.registerTicket(payer.publicKey,show,owner),...ids.map(n=>chain.issueTile(payer.publicKey,show,owner,tileId(n)))]);
   clients.set(client,publicKey);return state();
  });
 }
 async function settle({packet}){
  const p=fromHex(packet,368),o=decodeOffer(p.slice(0,240));if(o.show!==config.show||o.policy!==config.policy||![o.a,o.b].every(k=>[...clients.values()].includes(k)))throw Error('WRONG_SHOW_OR_CLIENT');
  const id=hex(chain.sha(p));
  return serial(async()=>{
   if(receipts.has(id))return receipts.get(id);
   const keys=[chain.pairAddress(show,new PublicKey(fromHex(o.a,32)),new PublicKey(fromHex(o.b,32))),chain.nonceAddress(show,fromHex(o.nonce,16))];
   const expected=await chain.settlementInstructions(payer.publicKey,p);
   // Recover after a successful send whose HTTP response or confirmation was lost.
   const prior=await c.getMultipleAccountsInfo(keys,'finalized');
   if(prior.every(Boolean)){
    const m=prior.map(i=>chain.readAccount(i,'Marker'));
    if(m.every(x=>hex(x.packetHash)===id)&&m[0].settledAt===m[1].settledAt){
     const history=await c.getSignaturesForAddress(keys[1],{limit:20},'finalized');
     for(const entry of history.filter(e=>!e.err)){
      const tx=await c.getTransaction(entry.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
      if(!tx?.meta||tx.meta.err||tx.transaction.message.version!=='legacy')continue;
      const msg=tx.transaction.message,ix=msg.compiledInstructions;
      if(ix.length!==expected.length||!ix.every((i,n)=>msg.accountKeys[i.programIdIndex].equals(expected[n].programId)&&Buffer.from(i.data).equals(expected[n].data)&&i.accountKeyIndexes.length===expected[n].keys.length&&i.accountKeyIndexes.every((k,j)=>msg.accountKeys[k].equals(expected[n].keys[j].pubkey))))continue;
      const receipt=attest({...common('settled',tx.slot,m[0].settledAt),id,signature:entry.signature,commitment:'finalized'});receipts.set(id,receipt);return receipt;
     }
     throw Error('FINALIZED_TRANSACTION_UNAVAILABLE');
    }
   }
   const chainNow=await clock();
   try{await inspectPacket(p,{...config,now:chainNow},{settlement:true});}catch(e){
    if(e.message==='SETTLEMENT_EXPIRED_OR_FUTURE')console.warn('SETTLEMENT_CLOCK_CHECK',JSON.stringify({chainNow,issuedAt:o.issuedAt,expiresAt:o.expiresAt,settleBy:o.settleBy,deadline,wallNow:Math.floor(Date.now()/1000)}));
    throw e;
   }
   const signature=await send(expected);
   await onSubmitted(signature); // Test hook for a lost response; never exposed over HTTP.
   // A successful finalized transaction alone is insufficient: check both replay markers.
   const status=(await c.getSignatureStatuses([signature],{searchTransactionHistory:true})).value[0];
   if(!status||status.err||status.confirmationStatus!=='finalized')throw Error('NOT_FINALIZED');
   const result=await c.getMultipleAccountsInfoAndContext(keys,{commitment:'finalized',minContextSlot:status.slot});
   const markers=result.value.map(i=>chain.readAccount(i,'Marker'));
   if(markers.some(m=>hex(m.packetHash)!==id)||markers[0].settledAt!==markers[1].settledAt)throw Error('MARKER_MISMATCH');
   const receipt=attest({...common('settled',status.slot,markers[0].settledAt),id,signature,commitment:'finalized'});receipts.set(id,receipt);return receipt;
  });
 }
 return {config,state,join,settle};
}
