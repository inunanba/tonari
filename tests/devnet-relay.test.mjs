import test from 'node:test';
import assert from 'node:assert/strict';
import {chmod,mkdtemp,readFile,stat,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Keypair} from '@solana/web3.js';
import {requireDevnetRPC,requireDevnetGenesis,DEVNET_RPC,DEVNET_GENESIS,createDevnetRelay} from '../tools/local-relay.mjs';
import {openLocalRelaySession,openRelaySession} from '../tools/relay-session.mjs';
import {validateConfig,settlementPresentation} from '../apps/web/chain-api.mjs';
const id=n=>n.toString(16).padStart(2,'0').repeat(32);
const config={show:id(1),policy:id(2),issuer:id(3),cluster:'devnet',programId:'2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA'};
test('Devnet sponsor rejects remote alternatives, mainnet genesis and unrelated signer before RPC',async()=>{
 assert.equal(requireDevnetRPC(DEVNET_RPC),DEVNET_RPC);requireDevnetGenesis(DEVNET_GENESIS);
 for(const rpc of ['https://api.mainnet-beta.solana.com','https://api.devnet.solana.com.evil.example','https://user:secret@api.devnet.solana.com','https://api.devnet.solana.com/?redirect=1','http://127.0.0.1:8899'])assert.throws(()=>requireDevnetRPC(rpc),/DEVNET_RPC_REQUIRED/);
 assert.throws(()=>requireDevnetGenesis('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'),/WRONG_GENESIS/);
 await assert.rejects(()=>createDevnetRelay({payer:Keypair.generate(),seed:new Uint8Array(32)}),/DEVNET_OPERATOR_REQUIRED/);
});
test('verified Devnet finality presentation links exact signed transaction and preserves local distinction',()=>{
 assert.deepEqual(validateConfig(config),config);assert.throws(()=>validateConfig({...config,cluster:'mainnet-beta'}),/UNSUPPORTED_CHAIN/);
 assert.throws(()=>validateConfig({...config,programId:id(4)}),/UNSUPPORTED_CHAIN/);
 const signature='1'.repeat(88),view=settlementPresentation(config,signature);assert.equal(view.url,'https://explorer.solana.com/tx/'+signature+'?cluster=devnet');assert.match(view.status,/Devnet/);
 assert.equal(settlementPresentation({...config,cluster:'localnet'},signature).url,null);
 assert.throws(()=>settlementPresentation(config,'https://evil.example'),/BAD_TRANSACTION_SIGNATURE/);
});
test('operator session locks duplicate processes; seed and immutable public slot bindings survive restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tonari-session-'));let first,second;
 try{first=await openRelaySession(dir);const seed=Array.from(first.seed);await assert.rejects(()=>openRelaySession(dir),e=>e.code==='EEXIST');
 await first.persistBindings([[0,id(1)]]);await assert.rejects(()=>first.persistBindings([[0,id(2)]]),/BINDING_CHANGED/);
 await assert.rejects(()=>first.persistBindings([[0,id(1)],[1,id(1)]]),/BAD_RELAY_SESSION/);
 await first.close();second=await openRelaySession(dir);assert.deepEqual(Array.from(second.seed),seed);assert.deepEqual(second.bindings,[[0,id(1)]]);
 await second.persistBindings([[0,id(1)],[1,id(2)]]);const saved=JSON.parse(await readFile(join(dir,'show.json'),'utf8'));assert.deepEqual(Object.keys(saved).sort(),['bindings','seed','version']);assert.deepEqual(saved.bindings,[[0,id(1)],[1,id(2)]]);
 }finally{await first?.close();await second?.close();await rm(dir,{recursive:true,force:true});}
});
test('corrupt metadata fails closed without overwriting show or trapping lock',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tonari-corrupt-'));try{
 const file=join(dir,'show.json'),bad=JSON.stringify({version:1,seed:id(1),bindings:[],privateKey:'MUST_NOT_ACCEPT'});await writeFile(file,bad);
 await assert.rejects(()=>openRelaySession(dir),/BAD_RELAY_SESSION/);assert.equal(await readFile(file,'utf8'),bad);
 await writeFile(file,JSON.stringify({version:1,seed:id(1),bindings:[]}));const session=await openRelaySession(dir);await session.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('local validator identity and immutable bindings survive close and reopen',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tonari-local-session-'));let first,second;
 try{first=await openLocalRelaySession(dir);const payer=first.payer.publicKey.toBase58(),seed=Array.from(first.seed);await assert.rejects(()=>openLocalRelaySession(dir),e=>e.code==='EEXIST');
 await first.persistBindings([[0,id(1)]]);await first.close();second=await openLocalRelaySession(dir);
 assert.equal(second.payer.publicKey.toBase58(),payer);assert.deepEqual(Array.from(second.seed),seed);assert.deepEqual(second.bindings,[[0,id(1)]]);assert.equal((await stat(join(dir,'local.json'))).mode&0o777,0o600);
 await assert.rejects(()=>second.persistBindings([[0,id(2)]]),/BINDING_CHANGED/);
 }finally{await first?.close();await second?.close();await rm(dir,{recursive:true,force:true});}
});
test('local validator identity rejects corrupt data and unsafe secret permissions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tonari-local-corrupt-'));let session;
 try{const file=join(dir,'local.json'),bad=JSON.stringify({version:1,payer:id(1),seed:id(2),bindings:[]});await writeFile(file,bad,{mode:0o600});
 await assert.rejects(()=>openLocalRelaySession(dir),/BAD_LOCAL_RELAY_SESSION/);assert.equal(await readFile(file,'utf8'),bad);
 await rm(file);session=await openLocalRelaySession(dir);await session.close();session=null;await chmod(file,0o644);
 await assert.rejects(()=>openLocalRelaySession(dir),/BAD_LOCAL_RELAY_SESSION_PERMISSIONS/);
 }finally{await session?.close();await rm(dir,{recursive:true,force:true});}
});
