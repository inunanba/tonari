/** Bounded three-device sponsor: local validator or explicit operator Devnet demo. */
import {randomBytes,createPrivateKey,sign} from 'node:crypto';
import {Connection,Keypair,PublicKey,SYSVAR_CLOCK_PUBKEY,sendAndConfirmTransaction} from '@solana/web3.js';
import * as chain from './chain-client.mjs';
import {attestationBytes} from '../packages/protocol/attestation.mjs';
import {inspectPacket,decodeOffer} from '../packages/protocol/swap-v2.mjs';
import {hex,fromHex} from '../packages/protocol/swap.mjs';
import {dropBytes} from '../packages/protocol/drop.mjs';
import {ClaimOperator} from './claim-operator.mjs';
import {completionValueFromOwnership} from '../packages/protocol/completion-state.mjs';
import {attestCompletion} from '../packages/protocol/completion.mjs';
import {verifyCompletionAnchorRequest} from '../packages/protocol/completion-anchor.mjs';
export const tileId=n=>Buffer.alloc(32,n);
export const joinMessage=(config,client,key)=>new TextEncoder().encode(`TONARI/v2/local-join\0${config.show}:${client}:${key}`);
export function requireLocalRPC(rpc){const u=new URL(rpc);if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash)throw Error('LOCAL_RPC_REQUIRED');return rpc;}
export const DEVNET_RPC='https://api.devnet.solana.com';
export const DEVNET_GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DEVNET_OPERATOR='8k7ygJWhiRu5BrPuvHPesR7CH1QTBmNEMJvFDpRjLFWf';
export function requireDevnetGenesis(value){if(value!==DEVNET_GENESIS)throw Error('WRONG_GENESIS');}
export function requireDevnetRPC(rpc){if(rpc!==DEVNET_RPC)throw Error('DEVNET_RPC_REQUIRED');return rpc;}
export function readClockUnixTimestamp(info){
 if(!info||!Buffer.isBuffer(info.data)||info.data.length<40)throw Error('CLOCK_UNAVAILABLE');
 const value=Number(info.data.readBigInt64LE(32));if(!Number.isSafeInteger(value)||value<0||value>0xffffffff)throw Error('CLOCK_UNAVAILABLE');return value;
}
export async function programClock(connection,commitment='processed'){return readClockUnixTimestamp(await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY,commitment));}
export function relayClocks(connection){return {exchange:()=>programClock(connection,'finalized'),claim:()=>programClock(connection,'processed')};}
export async function createLocalRelay(rpc,options={}){return createRelay(requireLocalRPC(rpc),'localnet',options);}
export async function createDevnetRelay({rpc=DEVNET_RPC,payer,seed,bindings=[],persistBindings}){
 requireDevnetRPC(rpc);
 if(!(payer instanceof Keypair)||payer.publicKey.toBase58()!==DEVNET_OPERATOR)throw Error('DEVNET_OPERATOR_REQUIRED');
 if(!(seed instanceof Uint8Array)||seed.length!==32)throw Error('PERSISTENT_SHOW_SEED_REQUIRED');
 if(!Array.isArray(bindings)||typeof persistBindings!=='function')throw Error('PERSISTENT_BINDINGS_REQUIRED');
 return createRelay(rpc,'devnet',{payer,seed:Buffer.from(seed),bindings,persistBindings});
}
async function createRelay(rpc,cluster,{onSubmitted=()=>{},payer=Keypair.generate(),seed=randomBytes(32),bindings=[],persistBindings=async()=>{},claimState=null,persistClaimState=async()=>{}}={}){
 const c=new Connection(rpc,'finalized'),show=chain.showAddress(seed);
 if(cluster==='devnet')requireDevnetGenesis(await c.getGenesisHash());
 if(!(await c.getAccountInfo(chain.PROGRAM_ID,'finalized'))?.executable)throw Error('PROGRAM_NOT_LOADED');
 if(cluster==='localnet'){const funding=await c.requestAirdrop(payer.publicKey,5e9);await c.confirmTransaction(funding,'finalized');}
 // Public devnet uses only the explicitly configured test operator. No faucet.
 if(cluster==='devnet'&&await c.getBalance(payer.publicKey,'finalized')<30000000)throw Error('DEVNET_TEST_BALANCE_LOW');
 const privateBytes=Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(payer.secretKey.subarray(0,32))]),privateKey=createPrivateKey({key:privateBytes,format:'der',type:'pkcs8'});
 const attest=value=>({value,signature:sign(null,attestationBytes(value),privateKey).toString('hex')});
 // Exchange timestamps must match the finalized bank used by preflight. Claim
 // windows need the current processed bank so a short lead is not already stale.
 const {exchange:exchangeClock,claim:claimClock}=relayClocks(c);
 async function send(instructions){const latest=await c.getLatestBlockhash('finalized'),tx=chain.transaction(payer.publicKey,latest.blockhash,instructions);if(chain.serializedSize(tx)>1232)throw Error('TX_TOO_LARGE');return sendAndConfirmTransaction(c,tx,[payer],{commitment:'finalized',skipPreflight:false});}
 const existingShow=await c.getAccountInfo(show,'finalized');
 const savedShow=existingShow&&chain.readAccount(existingShow,'Show');
 if(savedShow&&(!savedShow.authority.equals(payer.publicKey)||savedShow.cap!==24))throw Error('SHOW_CHANGED');
 const deadline=savedShow?savedShow.deadline:(await exchangeClock())+1800;
 if(savedShow&&hex(savedShow.policy)!==hex(chain.policyHash(show,deadline,24)))throw Error('SHOW_CHANGED');
 if(!savedShow)await send([chain.createShow(payer.publicKey,seed,deadline,24)]);
 const config={show:hex(show.toBytes()),policy:hex(chain.policyHash(show,deadline,24)),issuer:hex(payer.publicKey.toBytes()),cluster,programId:chain.PROGRAM_ID.toBase58()};
 const completionAuthority={publicKey:config.issuer,privateKey:await crypto.subtle.importKey('pkcs8',privateBytes,'Ed25519',false,['sign'])};
 const claimUnavailable=async()=>{throw Error('CLAIM_PROGRAM_NOT_DEPLOYED');};
 const loadClaimWindow=async window=>{const info=await c.getAccountInfo(chain.claimWindowAddress(show,window),'finalized');if(!info)return null;const x=chain.readAccount(info,'ClaimWindow');return {window:x.window,checkpointKey:hex(x.checkpointKey.toBytes()),entropyCommitment:hex(x.entropyCommitment),validFrom:x.validFrom,validTo:x.validTo,revealAfter:x.revealAfter,probabilityPPM:x.probabilityPPM,cap:x.cap,root:hex(x.claimsRoot),count:x.claimCount,rootPosted:x.rootPosted,revealed:x.revealed};};
 const claimOperator=cluster==='localnet'?new ClaimOperator({config,checkpointKey:hex(payer.publicKey.toBytes()),clock:claimClock,finalityClock:exchangeClock,minimumStartDelay:5,persistState:persistClaimState,loadWindow:loadClaimWindow,
  signToken:async value=>({value:structuredClone(value),signature:sign(null,Buffer.from(dropBytes(value)),privateKey).toString('hex')}),
  commitWindow:value=>send([chain.commitClaimWindow(payer.publicKey,show,{...value,checkpointKey:new PublicKey(fromHex(value.checkpointKey,32)),entropyCommitment:fromHex(value.entropyCommitment,32)})]),
  postRoot:value=>send([chain.postClaimsRoot(payer.publicKey,show,value.window,fromHex(value.root,32),value.count)]),
  revealWindow:value=>send([chain.revealClaimWindow(payer.publicKey,show,value.window,value.secret)])
 }):null;if(claimOperator)await claimOperator.restore(claimState);
 const clients=new Map();
 for(const [client,key] of bindings){if(![0,1,2].includes(client)||clients.has(client)||[...clients.values()].includes(key))throw Error('BAD_BINDINGS');fromHex(key,32);clients.set(client,key);}
 for(const ownerKey of clients.values()){const owner=new PublicKey(fromHex(ownerKey,32)),info=await c.getAccountInfo(chain.ticketAddress(show,owner),'finalized');
  const ticket=chain.readAccount(info,'Ticket');if(!ticket.owner.equals(owner)||!ticket.show.equals(show))throw Error('BAD_BINDINGS');}
 // Always read the complete board. Missing accounts remain unissued, while any
 // later allocation/claim path can make a real 24/24 completion reachable.
 const allIds=Array.from({length:24},(_,index)=>index),receipts=new Map();let tail=Promise.resolve();
 const serial=job=>{const result=tail.then(job);tail=result.catch(()=>{});return result;};
 const common=(kind,slot,observedAt)=>({kind,...Object.fromEntries(['show','policy','issuer','cluster'].map(k=>[k,config[k]])),slot,observedAt});
 async function state(){
  const result=await c.getMultipleAccountsInfoAndContext([show,...allIds.map(n=>chain.tileAddress(show,tileId(n)))],{commitment:'finalized'});
  const s=chain.readAccount(result.value[0],'Show');if(!s.authority.equals(payer.publicKey)||hex(s.policy)!==config.policy)throw Error('SHOW_CHANGED');
  const tiles=result.value.slice(1).flatMap((info,i)=>{if(!info)return [];const t=chain.readAccount(info,'Tile');if(!t.show.equals(show)||!t.id.equals(tileId(allIds[i])))throw Error('TILE_SUBSTITUTION');return [{id:hex(t.id),owner:hex(t.owner.toBytes()),version:t.version}];});
  return attest({...common('state',result.context.slot,await exchangeClock()),deadline:s.deadline,paused:s.paused,tiles});
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
   await persistBindings([...clients.entries(),[client,publicKey]]);clients.set(client,publicKey);return state();
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
   const chainNow=await exchangeClock();
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
 async function completionTiles(publicKey){
  if(![...clients.values()].includes(publicKey))throw Error('UNKNOWN_COMPLETION_DEVICE');fromHex(publicKey,32);
  const ids=Array.from({length:24},(_,i)=>i),result=await c.getMultipleAccountsInfoAndContext(ids.map(n=>chain.tileAddress(show,tileId(n))),{commitment:'finalized'}),tiles=result.value.map((info,index)=>{if(!info)throw Error('COMPLETION_REQUIRES_24');const tile=chain.readAccount(info,'Tile');if(!tile.show.equals(show)||!tile.id.equals(tileId(index))||hex(tile.owner.toBytes())!==publicKey)throw Error('COMPLETION_REQUIRES_24');return {id:hex(tile.id),owner:publicKey,version:tile.version};});
  return {tiles,slot:result.context.slot};
 }
 async function completionDraft({publicKey}){const completedAt=await exchangeClock(),snapshot=await completionTiles(publicKey);return {value:await completionValueFromOwnership({...config,ticket:publicKey,tiles:snapshot.tiles,completedAt}),slot:snapshot.slot,authority:config.issuer};}
 async function completionRecord({request}){return serial(async()=>{const now=await exchangeClock();if(!request?.value||request.value.completedAt>now||now-request.value.completedAt>300)throw Error('COMPLETION_DRAFT_EXPIRED');const snapshot=await completionTiles(request.value.ticket),value=await completionValueFromOwnership({...config,ticket:request.value.ticket,tiles:snapshot.tiles,completedAt:request.value.completedAt});if(JSON.stringify(value)!==JSON.stringify(request.value))throw Error('COMPLETION_STATE_CHANGED');return {record:await attestCompletion(request,completionAuthority,{show:config.show,policy:config.policy}),slot:snapshot.slot};});}
 async function completionAnchor({record,request}){return serial(async()=>{
  const expected={show:config.show,policy:config.policy,authority:config.issuer},checked=await verifyCompletionAnchorRequest(request,record,expected),device=new PublicKey(fromHex(checked.value.device,32)),address=chain.completionAddress(show,device);
  const matches=info=>{const value=chain.readAccount(info,'Completion');if(!value.show.equals(show)||hex(value.policy)!==config.policy||!value.device.equals(device)||hex(value.recordDigest)!==checked.value.recordDigest)throw Error('COMPLETION_ANCHOR_MISMATCH');return value;};
  let info=await c.getAccountInfo(address,'finalized'),signature;
  if(info){matches(info);const history=await c.getSignaturesForAddress(address,{limit:20},'finalized'),entry=history.find(value=>!value.err&&value.confirmationStatus==='finalized');if(!entry)throw Error('FINALIZED_TRANSACTION_UNAVAILABLE');signature=entry.signature;}
  else {signature=await send(chain.completionAnchorInstructions(payer.publicKey,show,fromHex(config.policy,32),device,fromHex(checked.value.recordDigest,32),fromHex(checked.deviceSignature,64)));info=await c.getAccountInfo(address,'finalized');if(!info)throw Error('COMPLETION_ANCHOR_MISSING');matches(info);}
  return {integrity:'VERIFIED',portableRecord:'VERIFIED',onChainAnchor:'VERIFIED',cNFT:'NOT_VERIFIED',nonTransferability:'NOT_VERIFIED',signature,address:address.toBase58(),recordDigest:checked.value.recordDigest};
 });}
 return {config,state,join,settle,completionDraft,completionRecord,completionAnchor,claimStatus:()=>claimOperator?claimOperator.status():{status:'UNAVAILABLE',reason:'CLAIM_PROGRAM_NOT_DEPLOYED'},claimOpen:claimOperator?value=>claimOperator.open(value):claimUnavailable,claimToken:claimOperator?value=>claimOperator.token(value):claimUnavailable,claimSubmit:claimOperator?value=>claimOperator.submit(value):claimUnavailable,claimRoot:claimOperator?()=>claimOperator.publish():claimUnavailable,claimReveal:claimOperator?()=>claimOperator.reveal():claimUnavailable};
}
