const frames=[...document.querySelectorAll('iframe')], registry=new Map();
const status=document.querySelector('#proof-status');
window.addEventListener('message',event=>{
  if(event.origin!==location.origin) return;
  const index=frames.findIndex(f=>f.contentWindow===event.source); if(index<0) return;
  const m=event.data;
  if(m?.type==='ready' && typeof m.publicKey==='string' && /^[0-9a-f]{64}$/.test(m.publicKey)) {
    registry.set(index,m.publicKey);
    if(registry.size===3) {
      const contacts=[...registry].map(([id,publicKey])=>({id,publicKey}));
      frames.forEach(f=>f.contentWindow.postMessage({type:'contacts',contacts},location.origin));
      status.textContent='3つの独立した鍵で準備完了。秘密鍵は各端末の中にあります。';
    }
  } else if(['offer','accepted'].includes(m?.type) && Number.isInteger(m.to) && frames[m.to] && m.to!==index) {
    frames[m.to].contentWindow.postMessage({...m,from:index},location.origin);
  } else if(m?.type==='verified') {
    status.textContent='双方の署名を検証しました。仮受け取りとして保存。全体の確定処理は未接続です。';
  }
});
