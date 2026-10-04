/** Loopback-only operator demo. Bot supplies its existing devnet test key locally. */
import {readFile} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {Keypair} from '@solana/web3.js';
import {createDevnetRelay} from './local-relay.mjs';
import {openRelaySession} from './relay-session.mjs';
import {createWebServer} from './serve.mjs';
const root=resolve(import.meta.dirname,'..');
function operatorPath(value){if(!value||!isAbsolute(value)||resolve(value)===root||resolve(value).startsWith(root+'/'))throw Error('EXTERNAL_OPERATOR_PATH_REQUIRED');return value;}
let session;
try{
 const keyFile=operatorPath(process.env.TONARI_DEVNET_OPERATOR_FILE),stateDir=operatorPath(process.env.TONARI_DEVNET_STATE_DIR);
 let payer;try{const bytes=JSON.parse(await readFile(keyFile,'utf8'));if(!Array.isArray(bytes)||bytes.length!==64||bytes.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error();payer=Keypair.fromSecretKey(Uint8Array.from(bytes));}catch{throw Error('INVALID_DEVNET_OPERATOR_FILE');}
 session=await openRelaySession(stateDir);
 const relay=await createDevnetRelay({payer,...session});
 const server=createWebServer(relay);server.listen(4173,'127.0.0.1',()=>console.log('TONARI Devnet operator demo http://127.0.0.1:4173/apps/web/swap.html'));
 server.on('error',async()=>{await session.close();console.error('DEVNET_SERVER_FAILED');process.exitCode=1;});
 let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(stopping)return;stopping=true;server.close(async()=>{await session.close();process.exit(0);});});
}catch(e){if(session)await session.close();console.error(e.message);process.exitCode=1;}
