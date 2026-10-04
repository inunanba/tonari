/* Local validator only. Ephemeral test keys, local faucet, never owner keys/devnet/mainnet. */
const assert=require('node:assert/strict');
const {randomBytes,createPrivateKey,sign}=require('node:crypto');
const {Connection,Keypair,PublicKey,sendAndConfirmTransaction,TransactionInstruction}=require('@solana/web3.js');
(async()=>{
 const client=await import('../tools/chain-client.mjs');
 const {encodeOffer,acceptanceMessage}=await import('../packages/protocol/swap-v2.mjs');
 const {concat,hex}=await import('../packages/protocol/swap.mjs');
 const rpc=process.env.TONARI_LOCAL_RPC||'http://127.0.0.1:8899';
 const url=new URL(rpc);assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'LOCAL_RPC_REQUIRED');
 const c=new Connection(rpc,'confirmed'),payer=Keypair.generate(),results=[];
 assert((await c.getAccountInfo(client.PROGRAM_ID))?.executable,'LOCAL_PROGRAM_NOT_LOADED');
 const airdrop=await c.requestAirdrop(payer.publicKey,5e9);await c.confirmTransaction(airdrop,'confirmed');
 async function send(ix,signers=[payer]){const bh=(await c.getLatestBlockhash()).blockhash;const tx=client.transaction(payer.publicKey,bh,ix);assert(client.serializedSize(tx)<=1232,'TX_TOO_LARGE');return sendAndConfirmTransaction(c,tx,signers,{commitment:'confirmed',skipPreflight:false});}
 async function clock(){const slot=await c.getSlot();const now=await c.getBlockTime(slot);assert(Number.isInteger(now),'CLOCK_UNAVAILABLE');return now;}
 async function show(cap=24){const seed=randomBytes(32),key=client.showAddress(seed),deadline=(await clock())+1800;await send([client.createShow(payer.publicKey,seed,deadline,cap)]);const s=client.readAccount(await c.getAccountInfo(key),'Show');assert.equal(hex(s.policy),hex(client.policyHash(key,deadline,cap)));return {key,deadline,policy:hex(s.policy)};}
 async function player(s){const k=Keypair.generate(),id=randomBytes(32);await send([client.registerTicket(payer.publicKey,s.key,k.publicKey)]);await send([client.issueTile(payer.publicKey,s.key,k.publicKey,id)]);return {k,id};}
 const signature=(k,msg)=>sign(null,Buffer.from(msg),createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(k.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'}));
 async function packet(s,a,b,changes={}){const now=await clock();const ai=client.readAccount(await c.getAccountInfo(client.tileAddress(s.key,a.id)),'Tile'),bi=client.readAccount(await c.getAccountInfo(client.tileAddress(s.key,b.id)),'Tile');
  const o={show:hex(s.key.toBytes()),a:hex(a.k.publicKey.toBytes()),b:hex(b.k.publicKey.toBytes()),tileA:hex(a.id),tileB:hex(b.id),nonce:hex(randomBytes(16)),issuedAt:now,expiresAt:now+120,policy:s.policy,versionA:ai.version,versionB:bi.version,settleBy:s.deadline,reserved:0,...changes};
  const body=encodeOffer(o),sa=signature(a.k,body),sb=signature(b.k,await acceptanceMessage(body,sa));return concat(body,sa,sb);
 }
 async function ix(p){return client.settlementInstructions(payer.publicKey,p);}
 async function snapshot(instructions){const keys=instructions.at(-1).keys.slice(1,8).map(x=>x.pubkey);return (await c.getMultipleAccountsInfo(keys)).map(x=>x?Buffer.from(x.data).toString('hex'):null);}
 async function rejected(name,instructions,pattern,{precompileInvalid=false,signers=[payer]}={}){
  const before=await snapshot(instructions);let error,signature=null,landed=false,logs=[];
  if(precompileInvalid){try{await send(instructions,signers);}catch(e){error=e;logs=e.logs||[];}}
  else{
   const latest=await c.getLatestBlockhash(),tx=client.transaction(payer.publicKey,latest.blockhash,instructions);
   assert(client.serializedSize(tx)<=1232,'TX_TOO_LARGE');tx.sign(...signers);
   signature=await c.sendRawTransaction(tx.serialize(),{skipPreflight:true});
   const confirmation=await c.confirmTransaction({signature,...latest},'confirmed');
   assert(confirmation.value.err,`${name}: unexpectedly accepted`);
   const committed=await c.getTransaction(signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});
   assert(committed?.meta?.err,`${name}: committed failure evidence missing`);
   landed=true;logs=committed.meta.logMessages||[];error=new Error(JSON.stringify(committed.meta.err));
  }
  assert(error,`${name}: unexpectedly accepted`);if(pattern)assert.match(String(error)+JSON.stringify(logs),pattern);
  assert.deepEqual(await snapshot(instructions),before,`${name}: failed tx mutated state`);
  results.push({name,status:'PASS',rejection:String(error).slice(0,180),stateUnchanged:true,failureSignature:signature,committedFailure:landed,precompilePreflightOnly:precompileInvalid});
 }
 async function accepted(name,instructions){const tx=await send(instructions);results.push({name,status:'PASS',tx});return tx;}
 const s=await show(),a=await player(s),b=await player(s),d=await player(s),e=await player(s);
 const p=await packet(s,a,b),good=await ix(p);
 const badsig=await ix(p);badsig[0].data[48]^=1;await rejected('invalid real Ed25519 signature',badsig,undefined,{precompileInvalid:true});
 const trailing=await ix(p);trailing[0].data=Buffer.concat([trailing[0].data,Buffer.from([0])]);await rejected('valid native signature with noncanonical trailing data',trailing,/Binding|0x1771/);
 const offsets=await ix(p),original=offsets[0].data;offsets[0].data=Buffer.concat([original.subarray(0,16),Buffer.alloc(2),original.subarray(16)]);offsets[0].data.writeUInt16LE(50,2);offsets[0].data.writeUInt16LE(18,6);offsets[0].data.writeUInt16LE(114,10);await rejected('valid native signature with alternate offsets',offsets,/Binding|0x1771/);
 await rejected('reversed signature instructions',[good[1],good[0],good[2]],/Binding|0x1771/);
 await rejected('omitted signature instruction',[good[0],good[2]],/Binding|0x1771/);
 const badnonce=await ix(p);badnonce[2].data[8]^=1;await rejected('unsigned nonce substitution',badnonce);
 const substituted=await ix(p);substituted[2].keys[2].pubkey=client.tileAddress(s.key,d.id);await rejected('tile account substitution',substituted,/Owner|0x1775/);
 const wrongpolicy=await packet(s,a,b,{policy:hex(Buffer.alloc(32,4))});await rejected('signed wrong policy',await ix(wrongpolicy),/Transition|0x1778/);
 const now=await clock(),expired=await packet(s,a,b,{issuedAt:now-200,expiresAt:now-80,settleBy:now-1});await rejected('signed settlement deadline expired',await ix(expired),/Deadline|0x1773/);
 const rogue=Keypair.generate();const unauthorized=client.pauseShow(rogue.publicKey,s.key,true);await rejected('unauthorized show authority',[unauthorized],undefined,{signers:[payer,rogue]});assert.equal(client.readAccount(await c.getAccountInfo(s.key),'Show').paused,false);
 await send([client.pauseShow(payer.publicKey,s.key,true)]);await rejected('paused show',good,/Paused|0x1779/);await send([client.pauseShow(payer.publicKey,s.key,false)]);
 // A signed short offer may settle late only within its jointly signed settleBy.
 const delayed=await packet(s,a,b,{issuedAt:now-200,expiresAt:now-80});const delayedIx=await ix(delayed);
 await accepted('atomic delayed offline settlement',delayedIx);
 const tileA=client.readAccount(await c.getAccountInfo(client.tileAddress(s.key,a.id)),'Tile'),tileB=client.readAccount(await c.getAccountInfo(client.tileAddress(s.key,b.id)),'Tile');
 assert(tileA.owner.equals(b.k.publicKey));assert(tileB.owner.equals(a.k.publicKey));assert.equal(tileA.version,1);assert.equal(tileB.version,1);
 for(const k of [a.k.publicKey,b.k.publicKey]){const t=client.readAccount(await c.getAccountInfo(client.ticketAddress(s.key,k)),'Ticket');assert.equal(t.count,1);assert.equal(t.hasLast,true);}
 for(const k of delayedIx.at(-1).keys.slice(6,8)){const m=client.readAccount(await c.getAccountInfo(k.pubkey),'Marker');assert.equal(hex(m.packetHash),hex(client.sha(delayed)));}
 await rejected('exact packet replay',delayedIx);
 const ba={k:b.k,id:a.id},ab={k:a.k,id:b.id};await rejected('reverse pair reuse',await ix(await packet(s,ba,ab)));
 const reusedNonce=Buffer.from(delayed.subarray(168,184)).toString('hex');await rejected('nonce reuse by another pair',await ix(await packet(s,d,e,{nonce:reusedNonce})));
 await rejected('stale signed ownership version',await ix(await packet(s,ba,d,{versionA:0})),/Version|0x1776/);
 await rejected('settlement time cooldown',await ix(await packet(s,ba,d)),/Cooldown|0x1777/);
 await rejected('wrong current owner',await ix(await packet(s,a,d)),/Owner|0x1775/);
 const capped=await show(1),ca=await player(capped),cb=await player(capped),cc=await player(capped);await accepted('cap first swap',await ix(await packet(capped,ca,cb)));await rejected('cap rejects second swap before cooldown',await ix(await packet(capped,{k:cb.k,id:ca.id},cc)),/Cap|0x1774/);
 const probe=new PublicKey(Buffer.alloc(32,9));assert((await c.getAccountInfo(probe))?.executable,'LOCAL_CPI_PROBE_NOT_LOADED');
 const fresh=await packet(s,d,e),freshIx=await ix(fresh),inner=freshIx[2];const wrapper=new TransactionInstruction({programId:probe,data:inner.data,keys:[...inner.keys,client.meta(client.PROGRAM_ID)]});await rejected('CPI settlement rejected',[freshIx[0],freshIx[1],wrapper],/Cpi|0x1770/);
 const other=await show(),otherA=await player(other);const cross=await ix(fresh);cross[2].keys[2].pubkey=client.tileAddress(other.key,otherA.id);await rejected('cross-show account substitution',cross);
 console.log(JSON.stringify({status:'LOCAL_VALIDATOR_PASS',cases:results.length,results,rpc,programId:client.PROGRAM_ID.toBase58(),ownershipFinality:'LOCAL_ONLY',devnet:false,spend:0},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
