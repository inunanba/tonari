import {createLocalRelay} from './local-relay.mjs';
import {createWebServer} from './serve.mjs';
const relay=await createLocalRelay(process.env.TONARI_LOCAL_RPC||'http://127.0.0.1:18999');
createWebServer(relay).listen(4173,'127.0.0.1',()=>console.log('TONARI local chain UI http://127.0.0.1:4173/apps/web/swap.html'));
