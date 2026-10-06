import {signOffer,acceptOffer,inspectOffer,hex,fromHex} from '../../packages/protocol/swap.mjs';
import {DeviceStore} from '../../packages/protocol/storage.mjs';
import {seededStartingPieces} from '../../packages/protocol/picture-board.mjs';
import {renderPictureBoard} from './picture-board.mjs';
const id=Number(new URL(location.href).searchParams.get('client'));
if(![0,1,2].includes(id)) throw new Error('BAD_CLIENT');
const names=['あお','そら','はる'];
const show='11'.repeat(32);
const $=s=>document.querySelector(s),send=m=>parent.postMessage(m,location.origin);
let device,store,contacts=[],pending=null,sent=null,busy=false,records=[],pieces=[];
$('#identity').textContent=names[id]+' の端末';
function error(e) { $('#status').textContent='確認できませんでした：'+e.message; }
try {
  store=await DeviceStore.open(`client-${id}`);device=store.device;pieces=[...await seededStartingPieces({show,device:device.publicKey})];renderPictureBoard($('#board'),pieces,Array.from({length:24},(_,i)=>i));$('#count').textContent=`${pieces.length} / 24`;records=await store.receipts(show);
  for(const r of records)markPending(r.offer.a===device.publicKey?r.offer.tileB:r.offer.tileA);
  const intent=await store.intent(show);
  if(intent) {
    try {
      const offer=await inspectOffer(intent.signed,{show,now:Math.floor(Date.now()/1000)});
      if(intent.direction==='sent'&&offer.a===device.publicKey)sent={to:intent.peer,signed:intent.signed};
      else if(intent.direction==='pending'&&offer.b===device.publicKey)pending={from:intent.peer,signed:intent.signed,offer};
      else throw new Error('INVALID_INTENT');
    } catch(e) {if(e.message==='EXPIRED_OR_FUTURE')await store.saveIntent(show,null);else throw e;}
  }
  $('#key').textContent='端末の公開鍵 '+device.publicKey.slice(0,20)+'…';
  $('#status').textContent='となりの端末を待っています。';send({type:'ready',publicKey:device.publicKey,pieces});
} catch(e) {device=null;$('#status').textContent='鍵と記録を安全に開けませんでした：'+e.message;}
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==parent||!device) return;
  const m=event.data;
  try {
    if(m?.type==='contacts') {
      contacts=m.contacts;$('#offer').disabled=!!sent||!!pending||records.length>0;
      if(pending){
        if(contacts.find(c=>c.id===pending.from)?.publicKey!==pending.offer.a)throw new Error('復元した相手が一致しません');
        $('#offer').hidden=true;$('#accept').hidden=false;$('#status').textContent=names[pending.from]+' さんから、ピース '+(parseInt(pending.offer.tileA.slice(0,2),16)+1)+' とあなたのピース '+(parseInt(pending.offer.tileB.slice(0,2),16)+1)+' の交換依頼を復元しました。';
      }
      else if(sent){send({type:'offer',...sent});$('#status').textContent='保存した依頼を再送しました。相手の確認を待っています。';}
      else $('#status').textContent=records.length?'保存した仮受け取りを復元しました ✓':'ピースを一枚ずつ、確かめて交換。';
      // A committed recipient receipt doubles as an outbox. Reload can finish delivery.
      for(const r of records)if(r.offer.b===device.publicKey) {
        const peer=contacts.find(c=>c.publicKey===r.offer.a);
        if(peer)send({type:'accepted',to:peer.id,packet:r.packet});
      }
    } else if(m?.type==='offer' && !pending && !sent && !busy) {
      const offer=await inspectOffer(m.signed,{show,now:Math.floor(Date.now()/1000)});
      if(offer.b!==device.publicKey || contacts.find(c=>c.id===m.from)?.publicKey!==offer.a) throw new Error('相手が一致しません');
      if(records.some(r=>r.offer.a===offer.a&&r.offer.nonce===offer.nonce))return;
      await store.saveIntent(show,{direction:'pending',peer:m.from,signed:m.signed});
      pending={...m,offer};$('#offer').hidden=true;$('#accept').hidden=false;
      $('#status').textContent=names[m.from]+' さんから、ピース '+(parseInt(offer.tileA.slice(0,2),16)+1)+' とあなたのピース '+(parseInt(offer.tileB.slice(0,2),16)+1)+' の交換です。';
    } else if(m?.type==='accepted' && sent && m.from===sent.to) {
      const packet=fromHex(m.packet,320);
      if(hex(packet.slice(0,192))!==sent.signed.body) throw new Error('依頼内容が違います');
      const r=await store.receive(packet,{show,now:Math.floor(Date.now()/1000)});records.push(r);
      markPending(r.offer.tileB);$('#status').textContent='署名を確認しました。仮受け取り ✓';send({type:'verified'});sent=null;
    }
  } catch(e) {error(e);}
});
function markPending(tile) {
  document.querySelector("tonari-guide").setAttribute("state","swap");
  const n=parseInt(tile.slice(0,2),16),cell=$(`[data-tile="${n}"]`);
  if(cell){cell.classList.add('pending');cell.textContent='◇';}
  $('#count').textContent='3枚 ＋ 仮1枚';$('#offer').disabled=true;$('#accept').hidden=true;
}
$('#offer').addEventListener('click',async()=>{
  if(busy||sent||pending)return;busy=true;$('#offer').disabled=true;
  try {
    const target=contacts.find(c=>c.id===(id+1)%3),now=Math.floor(Date.now()/1000),give=pieces.find(piece=>!target.pieces.includes(piece))??pieces[0],want=target.pieces.find(piece=>!pieces.includes(piece)&&piece!==give)??target.pieces.find(piece=>piece!==give);
    if(!Number.isInteger(want))throw Error('交換できる組み合わせがありません');
    const tile=n=>n.toString(16).padStart(2,'0').repeat(32),offer={show,a:device.publicKey,b:target.publicKey,tileA:tile(give),tileB:tile(want),nonce:hex(crypto.getRandomValues(new Uint8Array(16))),issuedAt:now,expiresAt:now+120};
    const signed=await signOffer(device,offer);
    await store.saveIntent(show,{direction:'sent',peer:target.id,signed});
    sent={to:target.id,signed};send({type:'offer',to:target.id,signed});
    $('#status').textContent=names[target.id]+' さんの確認を待っています。';
  } catch(e){error(e);$('#offer').disabled=false;} finally{busy=false;}
});
$('#accept').addEventListener('click',async()=>{
  if(!pending||busy)return;busy=true;$('#accept').disabled=true;
  try {
    const packet=await acceptOffer(device,pending.signed,{show,now:Math.floor(Date.now()/1000)});
    const r=await store.receive(packet,{show,now:Math.floor(Date.now()/1000)});records.push(r);
    send({type:'accepted',to:pending.from,packet:hex(packet)});markPending(r.offer.tileA);
    $('#status').textContent='双方の署名を確認。仮受け取り ✓';send({type:'verified'});pending=null;
  } catch(e){error(e);}finally{busy=false;$('#accept').disabled=false;}
});
