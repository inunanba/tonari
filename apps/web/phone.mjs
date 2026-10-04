import {createDevice,signOffer,acceptOffer,inspectOffer,Inbox,hex,fromHex} from '../../packages/protocol/swap.mjs';
const id=Number(new URL(location.href).searchParams.get('client'));
if(![0,1,2].includes(id)) throw new Error('BAD_CLIENT');
const names=['あお','そら','はる'],symbols=['✦','◒','◇','◓','✧','○'];
const show='11'.repeat(32),inbox=new Inbox();
const $=s=>document.querySelector(s),send=m=>parent.postMessage(m,location.origin);
let device,contacts=[],pending=null,sent=null,busy=false;
$('#identity').textContent=names[id]+' の端末';
for(let i=0;i<24;i++) {
  const cell=document.createElement('div');cell.className='tile'+(i%8===id?' owned':'');cell.dataset.tile=String(i);
  cell.textContent=i%8===id?symbols[(i+id)%symbols.length]:'·';$('#board').append(cell);
}
function error(e) { $('#status').textContent='確認できませんでした：'+e.message; }
try {
  device=await createDevice();$('#key').textContent='端末の公開鍵 '+device.publicKey.slice(0,20)+'…';
  $('#status').textContent='となりの端末を待っています。';send({type:'ready',publicKey:device.publicKey});
} catch {$('#status').textContent='このブラウザーでは署名機能を使えません。対応ブラウザーで開いてください。';}
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==parent||!device) return;
  const m=event.data;
  try {
    if(m?.type==='contacts') {
      contacts=m.contacts;$('#offer').disabled=false;$('#status').textContent='ピースを一枚ずつ、確かめて交換。';
    } else if(m?.type==='offer' && !pending && !sent && !busy) {
      const offer=await inspectOffer(m.signed,{show,now:Math.floor(Date.now()/1000)});
      if(offer.b!==device.publicKey || contacts.find(c=>c.id===m.from)?.publicKey!==offer.a) throw new Error('相手が一致しません');
      pending={...m,offer};$('#offer').hidden=true;$('#accept').hidden=false;
      $('#status').textContent=names[m.from]+' さんから、ピース '+(parseInt(offer.tileA.slice(0,2),16)+1)+' とあなたのピース '+(parseInt(offer.tileB.slice(0,2),16)+1)+' の交換です。';
    } else if(m?.type==='accepted' && sent && m.from===sent.to) {
      const packet=fromHex(m.packet,320);
      if(hex(packet.slice(0,192))!==sent.signed.body) throw new Error('依頼内容が違います');
      const r=await inbox.receive(packet,{show,now:Math.floor(Date.now()/1000)});
      markPending(r.offer.tileB);$('#status').textContent='署名を確認しました。仮受け取り ✓';send({type:'verified'});sent=null;
    }
  } catch(e) {error(e);}
});
function markPending(tile) {
  const n=parseInt(tile.slice(0,2),16),cell=$(`[data-tile="${n}"]`);
  if(cell){cell.classList.add('pending');cell.textContent='◇';}
  $('#count').textContent='3枚 ＋ 仮1枚';$('#offer').disabled=true;$('#accept').hidden=true;
}
$('#offer').addEventListener('click',async()=>{
  if(busy||sent||pending)return;busy=true;$('#offer').disabled=true;
  try {
    const target=contacts.find(c=>c.id===(id+1)%3),now=Math.floor(Date.now()/1000);
    const offer={show,a:device.publicKey,b:target.publicKey,tileA:id.toString(16).padStart(2,'0').repeat(32),tileB:target.id.toString(16).padStart(2,'0').repeat(32),nonce:hex(crypto.getRandomValues(new Uint8Array(16))),issuedAt:now,expiresAt:now+120};
    const signed=await signOffer(device,offer);sent={to:target.id,signed};send({type:'offer',to:target.id,signed});
    $('#status').textContent=names[target.id]+' さんの確認を待っています。';
  } catch(e){error(e);$('#offer').disabled=false;} finally{busy=false;}
});
$('#accept').addEventListener('click',async()=>{
  if(!pending||busy)return;busy=true;$('#accept').disabled=true;
  try {
    const packet=await acceptOffer(device,pending.signed,{show,now:Math.floor(Date.now()/1000)});
    const r=await inbox.receive(packet,{show,now:Math.floor(Date.now()/1000)});
    send({type:'accepted',to:pending.from,packet:hex(packet)});markPending(r.offer.tileA);
    $('#status').textContent='双方の署名を確認。仮受け取り ✓';send({type:'verified'});pending=null;
  } catch(e){error(e);}finally{busy=false;$('#accept').disabled=false;}
});
