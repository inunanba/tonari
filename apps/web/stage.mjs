import {prepareOffline} from './offline.mjs';
const frames=[...document.querySelectorAll('iframe')], registry=new Map();
const status=document.querySelector('#proof-status');
prepareOffline().then(()=>{document.querySelector('#offline-status').textContent='通信なしで開き直す準備ができました。';document.documentElement.dataset.offlineReady='true';}).catch(e=>{document.querySelector('#offline-status').textContent='通信なしでの再起動は準備できませんでした：'+e.message;});
window.addEventListener('message',event=>{
  if(event.origin!==location.origin) return;
  const index=frames.findIndex(f=>f.contentWindow===event.source); if(index<0) return;
  const m=event.data;
  if(m?.type==='ready' && typeof m.publicKey==='string' && /^[0-9a-f]{64}$/.test(m.publicKey) && Array.isArray(m.pieces) && m.pieces.length===3 && new Set(m.pieces).size===3 && m.pieces.every(piece=>Number.isSafeInteger(piece)&&piece>=0&&piece<24)) {
    registry.set(index,{publicKey:m.publicKey,pieces:[...m.pieces]});
    if(registry.size===3) {
      const contacts=[...registry].map(([id,value])=>({id,...value}));
      frames.forEach(f=>f.contentWindow.postMessage({type:'contacts',contacts},location.origin));
      const duplicate=contacts[0].pieces[0];status.textContent=`3つの独立した鍵で準備完了。通常ピース ${duplicate+1} は意図的な重なりです。秘密鍵は各端末の中にあります。`;
    }
  } else if(['offer','accepted'].includes(m?.type) && Number.isInteger(m.to) && frames[m.to] && m.to!==index) {
    frames[m.to].contentWindow.postMessage({...m,from:index},location.origin);
  } else if(m?.type==='verified') {
    status.textContent='双方の署名を検証しました。仮受け取りとして保存。全体の確定処理は未接続です。';
  }
});
