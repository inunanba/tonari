/** Real localhost validator completion flow; the host suite only syntax-checks it. */
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join as pathJoin} from 'node:path';
import {Connection,PublicKey,sendAndConfirmTransaction} from '@solana/web3.js';
import {createLocalRelay,joinMessage,tileId} from '../tools/local-relay.mjs';
import {openLocalRelaySession} from '../tools/relay-session.mjs';
import {createDevice,fromHex,hex} from '../packages/protocol/swap.mjs';
import {signFinalizedCompletion,verifyCompletion} from '../packages/protocol/completion.mjs';
import {prepareCompletionAnchor} from '../packages/protocol/completion-anchor.mjs';
import * as chain from '../tools/chain-client.mjs';

const rpc=process.env.TONARI_LOCAL_RPC||'http://127.0.0.1:18999';
const stateDir=await mkdtemp(pathJoin(tmpdir(),'tonari-completion-relay-'));
let session;
try{
 session=await openLocalRelaySession(stateDir);
 const relay=await createLocalRelay(rpc,{payer:session.payer,seed:session.seed,bindings:session.bindings,persistBindings:session.persistBindings});
 const device=await createDevice(),proof=hex(new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,joinMessage(relay.config,0,device.publicKey))));
 await relay.join({client:0,publicKey:device.publicKey,proof});
 await assert.rejects(()=>relay.completionDraft({publicKey:device.publicKey}),/COMPLETION_REQUIRES_24/);

 // The normal demo intentionally starts with only three pieces. This isolated
 // fixture acts as the eventual allocator and issues the remaining accounts to
 // the same bound device so the live relay path can be exercised end to end.
 const connection=new Connection(rpc,'finalized'),show=new PublicKey(fromHex(relay.config.show,32)),owner=new PublicKey(fromHex(device.publicKey,32));
 const remaining=Array.from({length:24},(_,i)=>i).filter(i=>![0,8,16].includes(i));
 for(let start=0;start<remaining.length;start+=5){
  const latest=await connection.getLatestBlockhash('finalized'),instructions=remaining.slice(start,start+5).map(i=>chain.issueTile(session.payer.publicKey,show,owner,tileId(i))),tx=chain.transaction(session.payer.publicKey,latest.blockhash,instructions);
  await sendAndConfirmTransaction(connection,tx,[session.payer],{commitment:'finalized',skipPreflight:false});
 }
 const state=(await relay.state()).value;assert.equal(state.tiles.length,24);assert(state.tiles.every(tile=>tile.owner===device.publicKey));

 const draft=await relay.completionDraft({publicKey:device.publicKey});
 const stale=await signFinalizedCompletion({...draft.value,completedAt:draft.value.completedAt-301},device);
 await assert.rejects(()=>relay.completionRecord({request:stale}),/COMPLETION_DRAFT_EXPIRED/);
 const changed=await signFinalizedCompletion({...draft.value,boardDigest:'11'.repeat(32)},device);
 await assert.rejects(()=>relay.completionRecord({request:changed}),/COMPLETION_STATE_CHANGED/);

 const request=await signFinalizedCompletion(draft.value,device),issued=await relay.completionRecord({request}),expected={show:relay.config.show,policy:relay.config.policy,authority:relay.config.issuer};
 const portable=await verifyCompletion(issued.record,expected);assert.equal(portable.recipient,device.publicKey);assert.equal(portable.pieces,24);
 const anchorRequest=await prepareCompletionAnchor(issued.record,expected,device),anchored=await relay.completionAnchor({record:issued.record,request:anchorRequest});
 assert.equal(anchored.onChainAnchor,'VERIFIED');assert.equal(anchored.cNFT,'NOT_VERIFIED');assert.equal(anchored.nonTransferability,'NOT_VERIFIED');
 const repeated=await relay.completionAnchor({record:issued.record,request:anchorRequest});assert.equal(repeated.signature,anchored.signature);assert.equal(repeated.recordDigest,portable.id);
 const account=chain.readAccount(await connection.getAccountInfo(new PublicKey(anchored.address),'finalized'),'Completion');
 assert(account.show.equals(show));assert(account.device.equals(owner));assert.equal(hex(account.recordDigest),portable.id);
 console.log(JSON.stringify({status:'LOCAL_COMPLETION_RELAY_PASS',tiles:24,portableRecord:'VERIFIED',onChainAnchor:'VERIFIED',cNFT:'NOT_VERIFIED',nonTransferability:'NOT_VERIFIED',signature:anchored.signature,address:anchored.address},null,2));
}finally{
 if(session)await session.close();
 await rm(stateDir,{recursive:true,force:true});
}
