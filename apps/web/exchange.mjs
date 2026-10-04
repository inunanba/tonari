import {DeviceStore} from '../../packages/protocol/storage.mjs';
import {signOffer,inspectOffer,acceptOffer,hex,fromHex} from '../../packages/protocol/swap.mjs';
import {publicKeyWire,signedOfferWire,encodeWire,decodeWire,readSignedOfferWire,readReceiptWire} from '../../packages/protocol/wire.mjs';
import {qrRaster} from '../../packages/protocol/qr.mjs';
import {CameraReader,readQRFile} from './camera.mjs';
import {prepareOffline} from './offline.mjs';
const $=s=>document.querySelector(s),params=new URL(location.href).searchParams;
const id=params.has('client')?Number(params.get('client')):0;if(![0,1,2].includes(id))throw new Error('BAD_CLIENT');
const show='22'.repeat(32),tile=n=>n.toString(16).padStart(2,'0').repeat(32),number=t=>parseInt(t.slice(0,2),16),now=()=>Math.floor(Date.now()/1000);
const own=n=>[id,id+8,id+16].includes(n);
let store,device,sent=null,pending=null,busy=false,done=false;
const camera=new CameraReader($('#video'));const error=e=>{$('#status').textContent='確認できませんでした：'+e.message;};
function draw(text,label) {const r=qrRaster(text),c=$('#qr');c.hidden=false;c.width=r.width;c.height=r.height;c.getContext('2d').putImageData(new ImageData(r.data,r.width,r.height),0,0);$('#qr-label').textContent=label;}
function showOffer(o){$('#pick').hidden=true;$('#review').hidden=false;$('#terms').textContent='あなたのピース '+(number(o.tileB)+1)+' を渡し、相手のピース '+(number(o.tileA)+1)+' を仮受け取りします。';$('#phase').textContent='② 内容を確かめる';$('#status').textContent='同意したときだけ、交換の約束に署名します。';}
function completed(r){done=true;camera.stop();$('#reader').hidden=true;$('#pick').hidden=true;$('#review').hidden=true;$('#scan').disabled=true;$('#phase').textContent='③ 仮受け取りを保存しました ✓';$('#status').textContent='双方の署名を確認しました。確定処理は、通信が戻ってからつなぐ予定です。';
 if(r.offer.b===device.publicKey)draw(encodeWire('R',fromHex(r.packet,320)),'相手にこのQRを読んでもらい、交換結果を返してください。');
 else{$('#qr').hidden=true;$('#qr-label').textContent='交換の約束を、この端末に保存しました。';}
}
for(let n=0;n<24;n++) {const o=document.createElement('option');o.value=String(n);o.textContent='ピース '+(n+1);$('#want').append(o);if(own(n))$('#give').append(o.cloneNode(true));}
$('#want').value=String((id+1)%3);
async function read(text){if(busy||done)return;busy=true;
 try {
   const data=decodeWire(text);
   if(data.type==='K') {
     if(pending||sent)throw new Error('いまの交換を完了してください。');
     const b=hex(data.bytes);if(b===device.publicKey)throw new Error('自分のQRです。相手のQRを読んでください。');
     const aTile=Number($('#give').value),bTile=Number($('#want').value);if(!own(aTile)||aTile===bTile)throw new Error('異なるピースを選んでください。');
     const issuedAt=now(),o={show,a:device.publicKey,b,tileA:tile(aTile),tileB:tile(bTile),nonce:hex(crypto.getRandomValues(new Uint8Array(16))),issuedAt,expiresAt:issuedAt+120};
     const signed=await signOffer(device,o);await store.saveIntent(show,{direction:'qr-sent',signed});sent=signed;
     draw(signedOfferWire(signed),'相手にこのQRを読んでもらい、内容を確かめてもらいます。');$('#pick').hidden=true;$('#phase').textContent='② 相手の確認を待つ';$('#status').textContent='ピース '+(aTile+1)+' と '+(bTile+1)+' の交換を頼みました。2分以内に相手の結果QRを読んでください。';
   } else if(data.type==='O') {
     if(sent||pending)throw new Error('いまの交換を完了してください。');
     const signed=readSignedOfferWire(text),o=await inspectOffer(signed,{show,now:now()});
     if(o.b!==device.publicKey)throw new Error('この端末宛ての交換ではありません。');
     if(!own(number(o.tileB))||number(o.tileA)>23||number(o.tileB)>23||o.tileA!==tile(number(o.tileA))||o.tileB!==tile(number(o.tileB)))throw new Error('渡せるピースと一致しません。');
     await store.saveIntent(show,{direction:'qr-pending',signed});pending={signed,offer:o};showOffer(o);
   } else {
     if(!sent)throw new Error('交換を頼んだ端末で、このQRを読んでください。');
     const packet=readReceiptWire(text);if(hex(packet.slice(0,192))!==sent.body)throw new Error('頼んだ交換と内容が違います。');
     const r=await store.receive(packet,{show,now:now()});sent=null;completed(r);
   }
 } finally {busy=false;}
}
try {
 store=await DeviceStore.open(`phone-${id}`);device=store.device;$('#key').textContent='この端末の公開鍵 '+device.publicKey.slice(0,20)+'…';draw(publicKeyWire(device.publicKey),'交換を頼むひとに、このQRを見せてください。');
 const rows=await store.receipts(show);if(rows.length)completed(rows[rows.length-1]);
 else {
   const intent=await store.intent(show);
   if(intent)try {const o=await inspectOffer(intent.signed,{show,now:now()});
     if(intent.direction==='qr-sent'&&o.a===device.publicKey){sent=intent.signed;draw(signedOfferWire(sent),'保存した依頼です。相手にこのQRを見せてください。');$('#pick').hidden=true;$('#phase').textContent='② 保存した交換を続ける';}
     else if(intent.direction==='qr-pending'&&o.b===device.publicKey&&own(number(o.tileB))){pending={signed:intent.signed,offer:o};showOffer(o);}
     else throw new Error('保存した交換を確認できません。');
   }catch(e){if(e.message==='EXPIRED_OR_FUTURE')await store.saveIntent(show,null);else throw e;}
   if(!pending&&!sent){$('#phase').textContent='① 相手のQRを読む';$('#status').textContent='話さなくても、一枚から。交換しなくても構いません。';}$('#scan').disabled=false;
 }
}catch(e){device=null;error(e);$('#reader').hidden=true;}
$('#confirm').addEventListener('click',async()=>{if(!pending||busy||!device)return;busy=true;$('#confirm').disabled=true;
 try {const packet=await acceptOffer(device,pending.signed,{show,now:now()}),r=await store.receive(packet,{show,now:now()});pending=null;completed(r);}catch(e){error(e);}finally{busy=false;$('#confirm').disabled=false;}
});
$('#decline').addEventListener('click',async()=>{if(busy)return;busy=true;try{await store.saveIntent(show,null);pending=null;$('#review').hidden=true;$('#pick').hidden=false;$('#phase').textContent='① 相手のQRを読む';$('#status').textContent='交換しない選択も大丈夫です。';}catch(e){error(e);}finally{busy=false;}});
$('#image').addEventListener('change',async()=>{camera.stop();if(!device||done)return;const file=$('#image').files[0];try{await read(await readQRFile(file));}catch(e){error(e);}finally{$('#image').value='';$('#stop').hidden=true;}});
$('#scan').addEventListener('click',async()=>{if(!device||done||busy)return;$('#scan').disabled=true;$('#stop').hidden=false;
 try {await camera.start(async text=>{await read(text);$('#scan').disabled=done;$('#stop').hidden=true;},e=>{error(e);$('#scan').disabled=done;$('#stop').hidden=true;});}catch(e){error(e);$('#scan').disabled=false;$('#stop').hidden=true;}
});
$('#stop').addEventListener('click',()=>{camera.stop();$('#stop').hidden=true;$('#scan').disabled=done;});
window.addEventListener('pagehide',()=>camera.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden){camera.stop();$('#stop').hidden=true;$('#scan').disabled=done;}});
prepareOffline().then(()=>{$('#offline-status').textContent='通信なしで開き直せます。';document.documentElement.dataset.offlineReady='true';}).catch(e=>{$('#offline-status').textContent='通信なしの再起動は準備できませんでした：'+e.message;});
