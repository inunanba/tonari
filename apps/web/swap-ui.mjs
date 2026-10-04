import {DeviceStore} from '../../packages/protocol/storage.mjs';
import {hex,fromHex} from '../../packages/protocol/swap.mjs';
import {signOffer,inspectOffer,acceptOffer,decodeOffer,BODY_BYTES} from '../../packages/protocol/swap-v2.mjs';
import {publicKeyWire,signedOfferWire,encodeWire,decodeWire,readSignedOfferWire,readReceiptWire} from '../../packages/protocol/wire-v2.mjs';
import {checkOwned} from '../../packages/protocol/attestation.mjs';
import {chainAPI,validateConfig,joinMessage,settlementPresentation} from './chain-api.mjs';
import {qrRaster} from '../../packages/protocol/qr.mjs';
import {CameraReader,readQRFile} from './camera.mjs';
import {prepareOffline} from './offline.mjs';
import {observedNow,offerTime} from '../../packages/protocol/observed-clock.mjs';
import {SettlementRetry} from './settlement-retry.mjs';
const $=s=>document.querySelector(s),params=new URL(location.href).searchParams,client=params.has('client')?Number(params.get('client')):0;
if(![0,1,2].includes(client))throw Error('BAD_CLIENT');
const wallNow=()=>Math.floor(Date.now()/1000),now=()=>observedNow(anchor,wallNow()),number=id=>parseInt(id.slice(0,2),16)+1;
let root,store,device,config,state,anchor,sent,pending,receipt,busy=false,settling=false;
const camera=new CameraReader($('#video'));
const fail=e=>{const text={OWNERSHIP_OBSERVATION_EXPIRED:'通信を戻し、所有権を更新してから交換を頼んでください。',CLOCK_ANCHOR_UNAVAILABLE:'通信を戻し、所有権を更新してください。',LOCAL_CLOCK_ROLLBACK:'端末の時計を確かめ、通信を戻して所有権を更新してください。'};$('#status').textContent='確認できませんでした：'+(text[e.message]||e.message);};
const retryable=e=>e instanceof TypeError||['AbortError','TimeoutError'].includes(e.name)||e.message==='CHAIN_SERVICE_UNAVAILABLE';
const sync=new SettlementRetry({attempt:settle,isPending:()=>!!config&&!!receipt&&!receipt.ownershipFinal,isOnline:()=>navigator.onLine,isVisible:()=>!document.hidden});
function draw(text,label){const r=qrRaster(text),c=$('#qr');c.hidden=false;c.width=r.width;c.height=r.height;c.getContext('2d').putImageData(new ImageData(r.data,r.width,r.height),0,0);$('#qr-label').textContent=label;}
function picks(){
 for(const name of ['give','want']){$('#'+name).replaceChildren();for(const tile of state.tiles.filter(t=>name==='give'?t.owner===device.publicKey:t.owner!==device.publicKey)){
  const o=document.createElement('option');o.value=tile.id;o.textContent='ピース '+number(tile.id)+' · 所有権 '+tile.version;$('#'+name).append(o);
 }}
 $('#pick').hidden=false;$('#reader').hidden=false;$('#scan').disabled=false;draw(publicKeyWire(device.publicKey),'交換を頼むひとに、このQRを見せてください。');$('#phase').textContent='① 相手のQRを読む';$('#status').textContent='所有権を確認してから、一枚ずつ交換します。';
}
async function refresh(){state=await store.saveState(await chainAPI('state'),config);anchor=await store.clockAnchor(config);return state;}
async function refreshWhenAvailable(){
 if(!navigator.onLine)return;
 try{await refresh();}catch(e){
  // navigator.onLine can stay true on a captive portal or a lost radio link.
  // Only transport/unavailable errors permit use of the verified cached snapshot.
  if(!state||!retryable(e))throw e;
 }
}
function showOffer(o){$('#pick').hidden=true;$('#review').hidden=false;$('#reader').hidden=false;$('#terms').textContent='あなたのピース '+number(o.tileB)+'（所有権 '+o.versionB+'）を渡し、相手のピース '+number(o.tileA)+'（所有権 '+o.versionA+'）を仮受け取りします。';$('#phase').textContent='② 内容を確かめる';$('#status').textContent='同意したときだけ、交換の約束に署名します。';}
function complete(r){
 receipt=r;sent=null;pending=null;camera.stop();document.querySelector('tonari-guide').setAttribute('state','swap');$('#pick').hidden=true;$('#review').hidden=true;$('#reader').hidden=true;$('#settlement').hidden=false;
 if(r.offer.b===device.publicKey)draw(encodeWire('R',fromHex(r.packet,368)),'相手にこの結果QRを返してください。');else{$('#qr').hidden=true;$('#qr-label').textContent='双方の署名を、この端末に保存しました。';}
 const final=r.ownershipFinal===true;$('#phase').textContent=final?'④ 交換が確定しました ✓':'③ 仮受け取りを保存しました ✓';$('#status').textContent=final?(config.cluster==='devnet'?'Solana Devnetの確定記録を確認しました。':'ローカルチェーンの確定記録を確認しました。'):'双方の署名を確認しました。通信が戻ったら確定できます。';
 $('#settle').disabled=final;$('#chain-status').textContent='確定前のピースは、別の交換に使いません。';$('#transaction').replaceChildren();
 if(final){const view=settlementPresentation(config,r.settlement.value.signature);$('#chain-status').textContent=view.status;
  if(view.url){const link=document.createElement('a');link.href=view.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=view.label;$('#transaction').append(link);}else $('#transaction').textContent=view.label;
 }
 document.documentElement.dataset.swapState=final?'confirmed':'provisional';
 if(final)sync.stop();else sync.start();
}
async function settle(){if(!receipt||receipt.ownershipFinal||settling)return;settling=true;$('#settle').disabled=true;$('#chain-status').textContent='確定記録を確認しています…';
 try{const envelope=await chainAPI('settle',{packet:receipt.packet});const next=await store.confirm(receipt.id,envelope,config);complete(next);try{await refresh();}catch{$('#chain-status').textContent='交換は確定済みです。所有するピースの更新は再接続時に続けます。';}return {done:true};}
 catch(e){$('#chain-status').textContent='仮受け取りは保存されています。確定を再試行できます：'+e.message;return {done:false,retryable:retryable(e)};}finally{settling=false;$('#settle').disabled=receipt.ownershipFinal===true;}
}
async function read(text){if(busy||receipt)return;busy=true;try{
 const data=decodeWire(text);
 if(data.type==='K'){
  if(sent||pending)throw Error('いまの交換を完了してください。');const b=hex(data.bytes);if(b===device.publicKey)throw Error('自分のQRです。');
  await refreshWhenAvailable();const aTile=state.tiles.find(t=>t.id===$('#give').value),bTile=state.tiles.find(t=>t.id===$('#want').value);if(!aTile||!bTile||aTile.owner!==device.publicKey||bTile.owner!==b)throw Error('STALE_OWNERSHIP');
  const times=offerTime(state,anchor,wallNow()),at=now(),o={show:config.show,a:device.publicKey,b,tileA:aTile.id,tileB:bTile.id,nonce:hex(crypto.getRandomValues(new Uint8Array(16))),issuedAt:times.issuedAt,expiresAt:times.expiresAt,policy:config.policy,versionA:aTile.version,versionB:bTile.version,settleBy:times.settleBy,reserved:0};checkOwned(state,o);
  const signed=await signOffer(device,o);await store.saveIntent(config,{direction:'sent',signed},at);sent=signed;$('#pick').hidden=true;$('#cancel').hidden=false;draw(signedOfferWire(signed),'相手にこのQRを見せ、内容を確かめてもらいます。');$('#phase').textContent='② 相手の確認を待つ';$('#status').textContent='残り '+(o.expiresAt-at)+' 秒以内に相手に確認してもらい、結果QRを読んでください。';
 }else if(data.type==='O'){
  if(sent||pending)throw Error('いまの交換を完了してください。');const signed=readSignedOfferWire(text),o=await inspectOffer(signed,{...config,now:now()});if(o.b!==device.publicKey)throw Error('この端末宛ての交換ではありません。');
  await refreshWhenAvailable();checkOwned(state,o);await store.saveIntent(config,{direction:'pending',signed},now());pending={signed,offer:o};showOffer(o);
 }else{
  if(!sent)throw Error('交換を頼んだ端末で、このQRを読んでください。');const packet=readReceiptWire(text);if(hex(packet.slice(0,BODY_BYTES))!==sent.body)throw Error('INTENT_MISMATCH');
  try{complete(await store.receive(packet,config,now()));}catch(e){
   // The other device may already have finalized while this sender was offline.
   // Import historical ownership only with a verified finalized proof for this packet.
   if(!['STALE_OWNERSHIP','SETTLEMENT_EXPIRED_OR_FUTURE'].includes(e.message))throw e;
   const proof=await chainAPI('settle',{packet:hex(packet)});complete(await store.receive(packet,config,now(),proof));
  }
 }
}finally{busy=false;}}
async function cancel(){if(busy)return;busy=true;try{await store.saveIntent(config,null);sent=null;pending=null;$('#cancel').hidden=true;$('#review').hidden=true;picks();$('#status').textContent='交換しない選択も大丈夫です。';}catch(e){fail(e);}finally{busy=false;}}
try{
 root=await DeviceStore.open('phone-'+client);store=root.exchange;device=root.device;$('#key').textContent='この端末の公開鍵 '+device.publicKey.slice(0,20)+'…';
 const cached=await store.config();try{config=validateConfig(await chainAPI('config'));}catch(e){if(!cached)throw e;config=validateConfig(cached);}
 await store.saveConfig(config);state=await store.state(config);
 if(navigator.onLine)try{const proof=hex(new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,joinMessage(config,client,device.publicKey))));state=await store.saveState(await chainAPI('join',{client,publicKey:device.publicKey,proof}),config);}catch(e){if(!state)throw e;}
 if(!state)throw Error('STATE_UNAVAILABLE');
 const rows=await store.receipts(config);if(rows.length)complete(rows.at(-1));else{
  anchor=await store.clockAnchor(config);
  const intent=await store.intent(config.show);if(intent){try{
   const saved=decodeOffer(fromHex(intent.signed.body,BODY_BYTES));
   const o=await inspectOffer(intent.signed,{...config,now:intent.direction==='sent'?saved.issuedAt:now()});
   if(intent.direction!=='sent'){if(now()>o.settleBy)throw Error('EXPIRED_OR_FUTURE');checkOwned(state,o);}
   if(intent.direction==='sent'&&o.a===device.publicKey){sent=intent.signed;draw(signedOfferWire(sent),'保存した依頼です。相手にこのQRを見せてください。');$('#reader').hidden=false;$('#scan').disabled=false;$('#cancel').hidden=false;$('#phase').textContent='② 保存した交換を続ける';}
   else if(intent.direction==='pending'&&o.b===device.publicKey){pending={signed:intent.signed,offer:o};showOffer(o);$('#scan').disabled=false;}else throw Error('CORRUPT_INTENT');
  }catch(e){if(e.message!=='EXPIRED_OR_FUTURE')throw e;await store.saveIntent(config,null);picks();$('#status').textContent='依頼の確認期限が切れました。新しく交換を頼めます。';}}
  else picks();
 }
 document.documentElement.dataset.chainReady='true';
}catch(e){$('#phase').textContent='確定接続の準備待ち';fail(e);$('#reader').hidden=true;$('#pick').hidden=true;}
$('#confirm').addEventListener('click',async()=>{if(!pending||busy)return;busy=true;$('#confirm').disabled=true;try{const p=await acceptOffer(device,pending.signed,{...config,now:now()});complete(await store.receive(p,config,now()));}catch(e){fail(e);}finally{busy=false;$('#confirm').disabled=false;}});
$('#decline').addEventListener('click',cancel);$('#cancel').addEventListener('click',cancel);
$('#refresh').addEventListener('click',async()=>{if(busy||receipt)return;busy=true;try{await refresh();picks();}catch(e){fail(e);}finally{busy=false;}});
$('#settle').addEventListener('click',()=>sync.request(true));window.addEventListener('online',()=>sync.request(false));
window.addEventListener('focus',()=>sync.request(false));window.addEventListener('pageshow',()=>sync.start());
$('#image').addEventListener('change',async()=>{camera.stop();if(!device||receipt)return;try{await read(await readQRFile($('#image').files[0]));}catch(e){fail(e);}finally{$('#image').value='';$('#stop').hidden=true;}});
$('#scan').addEventListener('click',async()=>{if(!device||receipt||busy)return;$('#scan').disabled=true;$('#stop').hidden=false;try{await camera.start(async text=>{await read(text);$('#scan').disabled=!!receipt;$('#stop').hidden=true;},e=>{fail(e);$('#scan').disabled=!!receipt;$('#stop').hidden=true;});}catch(e){fail(e);$('#scan').disabled=false;$('#stop').hidden=true;}});
$('#stop').addEventListener('click',()=>{camera.stop();$('#stop').hidden=true;$('#scan').disabled=!!receipt;});
window.addEventListener('pagehide',()=>{camera.stop();sync.stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden)camera.stop();else sync.request(false);});
prepareOffline().then(()=>{$('#offline-status').textContent='通信なしで開き直せます。';document.documentElement.dataset.offlineReady='true';}).catch(e=>{$('#offline-status').textContent='通信なしの再起動は準備できませんでした：'+e.message;});
