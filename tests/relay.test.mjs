import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createWebServer} from '../tools/serve.mjs';
import {requireLocalRPC,joinMessage as serverMessage} from '../tools/local-relay.mjs';
import {joinMessage as browserMessage,validateConfig} from '../apps/web/chain-api.mjs';
test('local sponsor forbids every remote RPC, credential and unsupported frontend cluster',()=>{
 for(const u of ['https://api.devnet.solana.com','http://example.com','http://user:secret@localhost:8899','http://localhost:8899/?x=1','file:///etc/passwd'])assert.throws(()=>requireLocalRPC(u),/LOCAL_RPC_REQUIRED/);
 assert.equal(requireLocalRPC('http://127.0.0.1:18999'),'http://127.0.0.1:18999');
 assert.deepEqual(serverMessage({show:'a'},1,'b'),browserMessage({show:'a'},1,'b'));
 assert.throws(()=>validateConfig({show:'01'.repeat(32),policy:'02'.repeat(32),issuer:'03'.repeat(32),cluster:'devnet',programId:'2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA'}),/UNSUPPORTED_CHAIN/);
});
test('HTTP adapter enforces origin, content type, size and unavailable status',async()=>{
 let calls=0;const server=createWebServer({config:{demo:true},state:async()=>({state:true}),settle:async()=>{calls++;return {};}});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const url='http://127.0.0.1:'+server.address().port+'/api/tonari/',headers={};
 assert.equal((await fetch(url+'config',{headers})).status,200);
 assert.equal((await fetch(url+'config',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(url+'settle',{method:'POST',headers,body:'{}'})).status,415);
 assert.equal((await fetch(url+'settle',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'a'.repeat(2049)})).status,413);
 assert.equal((await fetch(url+'settle',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,200);assert.equal(calls,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
 const unavailable=createWebServer();unavailable.listen(0,'127.0.0.1');await once(unavailable,'listening');try{assert.equal((await fetch('http://127.0.0.1:'+unavailable.address().port+'/api/tonari/config')).status,503);}finally{await new Promise(resolve=>unavailable.close(resolve));}
});
