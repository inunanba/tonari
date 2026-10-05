import {createLocalRelay} from './local-relay.mjs';
import {createWebServer} from './serve.mjs';
import {openClaimJournal} from './claim-journal.mjs';
import {openLocalRelaySession} from './relay-session.mjs';
let journal,session;try{
 const options={};if(process.env.TONARI_LOCAL_STATE_DIR){session=await openLocalRelaySession(process.env.TONARI_LOCAL_STATE_DIR);journal=await openClaimJournal(process.env.TONARI_LOCAL_STATE_DIR);Object.assign(options,{payer:session.payer,seed:session.seed,bindings:session.bindings,persistBindings:session.persistBindings,claimState:journal.state,persistClaimState:journal.persistState});}
 const relay=await createLocalRelay(process.env.TONARI_LOCAL_RPC||'http://127.0.0.1:18999',options),server=createWebServer(relay);server.listen(4173,'127.0.0.1',()=>console.log('TONARI local chain UI http://127.0.0.1:4173/apps/web/swap.html'));
 let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(stopping)return;stopping=true;server.close(async()=>{await journal?.close();await session?.close();process.exit(0);});});
}catch(e){await journal?.close();await session?.close();throw e;}
