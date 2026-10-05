import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createWebServer} from '../tools/serve.mjs';
import {readClockUnixTimestamp,relayClocks,requireLocalRPC,joinMessage as serverMessage} from '../tools/local-relay.mjs';
import {joinMessage as browserMessage,validateConfig} from '../apps/web/chain-api.mjs';
test('local sponsor forbids every remote RPC, credential and mainnet frontend cluster',()=>{
 for(const u of ['https://api.devnet.solana.com','http://example.com','http://user:secret@localhost:8899','http://localhost:8899/?x=1','file:///etc/passwd'])assert.throws(()=>requireLocalRPC(u),/LOCAL_RPC_REQUIRED/);
 assert.equal(requireLocalRPC('http://127.0.0.1:18999'),'http://127.0.0.1:18999');
 assert.deepEqual(serverMessage({show:'a'},1,'b'),browserMessage({show:'a'},1,'b'));
 assert.throws(()=>validateConfig({show:'01'.repeat(32),policy:'02'.repeat(32),issuer:'03'.repeat(32),cluster:'mainnet-beta',programId:'2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA'}),/UNSUPPORTED_CHAIN/);
});
test('Clock sysvar decoder reads bank unix time and rejects malformed values',()=>{const data=Buffer.alloc(40);data.writeBigInt64LE(1791166724n,32);assert.equal(readClockUnixTimestamp({data}),1791166724);assert.throws(()=>readClockUnixTimestamp({data:Buffer.alloc(39)}),/CLOCK_UNAVAILABLE/);data.writeBigInt64LE(-1n,32);assert.throws(()=>readClockUnixTimestamp({data}),/CLOCK_UNAVAILABLE/);});
test('relay isolates finalized exchange time from processed claim-window time',async()=>{const seen=[],connection={getAccountInfo:async(_key,commitment)=>{seen.push(commitment);const data=Buffer.alloc(40);data.writeBigInt64LE(BigInt(commitment==='finalized'?100:112),32);return {data};}},clock=relayClocks(connection);assert.equal(await clock.exchange(),100);assert.equal(await clock.claim(),112);assert.deepEqual(seen,['finalized','processed']);});
test('HTTP adapter enforces origin, content type, size and unavailable status',async()=>{
 let calls=0;const relay={config:{demo:true},state:async()=>({state:true}),settle:async()=>{calls++;return {};},claimStatus:async()=>({status:'IDLE'}),claimOpen:async value=>({opened:value.window}),claimSubmit:async value=>({accepted:value.pad.length})};const server=createWebServer(relay);server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const url='http://127.0.0.1:'+server.address().port+'/api/tonari/',headers={};
 assert.equal((await fetch(url+'config',{headers})).status,200);
 assert.equal((await fetch(url+'config',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(url+'settle',{method:'POST',headers,body:'{}'})).status,415);
 assert.equal((await fetch(url+'settle',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'a'.repeat(2049)})).status,413);
 assert.equal((await fetch(url+'settle',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,200);assert.equal(calls,1);
 assert.deepEqual(await (await fetch(url+'claim-status')).json(),{status:'IDLE'});assert.deepEqual(await (await fetch(url+'claim-open',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({window:7})})).json(),{opened:7});
 assert.deepEqual(await (await fetch(url+'claim-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pad:'x'.repeat(3000)})})).json(),{accepted:3000});assert.equal((await fetch(url+'claim-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pad:'x'.repeat(17000)})})).status,413);
 }finally{await new Promise(resolve=>server.close(resolve));}
 const unavailable=createWebServer();unavailable.listen(0,'127.0.0.1');await once(unavailable,'listening');try{assert.equal((await fetch('http://127.0.0.1:'+unavailable.address().port+'/api/tonari/config')).status,503);}finally{await new Promise(resolve=>unavailable.close(resolve));}
});
