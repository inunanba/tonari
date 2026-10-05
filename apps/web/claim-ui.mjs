import {DeviceStore} from '../../packages/protocol/storage.mjs';
import {hex} from '../../packages/protocol/swap.mjs';
import {observedNow} from '../../packages/protocol/observed-clock.mjs';
import {chainAPI,joinMessage,validateConfig} from './chain-api.mjs';
import {claimAvailability,latestClaim,participantMissing,randomClaimFrame} from './claim-flow.mjs';

const $=s=>document.querySelector(s),params=new URL(location.href).searchParams,client=params.has('client')?Number(params.get('client')):0,wallNow=()=>Math.floor(Date.now()/1000);
if(![0,1,2].includes(client))throw Error('BAD_CLIENT');
let root,config,state,anchor,lastRow,busy=false,refreshTimer=null;
const claimConfig=()=>({show:config.show,policy:config.policy,checkpointKeys:[config.issuer]});
function showProof(value){$('#proof').hidden=false;$('#proof').textContent=JSON.stringify(value,null,2);}
function save(value){const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tonari-device-claim.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);}
function fail(e){$('#status').textContent='確認できませんでした：'+e.message;document.documentElement.dataset.claimParticipant='ERROR';}
async function refreshState(){state=await root.exchange.saveState(await chainAPI('state'),config);anchor=await root.exchange.clockAnchor(config);return state;}
function scheduleRefresh(){if(refreshTimer!==null)return;refreshTimer=setTimeout(async()=>{refreshTimer=null;try{await refreshState();await refresh();}catch(e){fail(e);}},2000);}
async function refresh({preserveStatus=false}={}){
 const status=await chainAPI('claim-status');if(status.status==='UNAVAILABLE')throw Error('CLAIM_PROGRAM_NOT_DEPLOYED');
 if(!state)await refreshState();const now=observedNow(anchor,wallNow()),availability=claimAvailability(status,now);let missing=[];try{missing=participantMissing(state,root.device.publicKey);}catch(e){if(e.message!=='NO_MISSING_TILES')throw e;scheduleRefresh();}const rows=await root.claims.claims(claimConfig());lastRow=latestClaim(rows);
 $('#window').textContent=status.status==='OPEN'?`配布期間 ${status.validFrom}–${status.validTo} · 未取得 ${missing.length}枚`:`配布状態 ${status.status}`;
 const ready=availability.ready&&missing.length>0;$('#claim').disabled=busy||!ready;$('#retry').hidden=!lastRow||status.status!=='OPEN';$('#retry').disabled=busy;$('#download').hidden=!lastRow;
 if(!preserveStatus)$('#status').textContent=!missing.length?'現在、未取得のピースはありません。新しい参加・交換後に自動更新します。':ready?'配布中です。端末内で当選判定と署名を行えます。':availability.reason==='NOT_STARTED'?'まもなく配布が始まります。':availability.reason==='CLOSED'?'この配布期間は終了しました。':'配布開始を待っています。';
 document.documentElement.dataset.claimParticipant=!missing.length?'WAITING_PARTICIPANTS':ready?'READY':availability.reason;return {status,now,missing};
}
async function submit(row){try{const accepted=await chainAPI('claim-submit',row);$('#status').textContent='署名付きclaimを会場へ送りました。';showProof({accepted,claim:row.envelope.value});return accepted;}catch(e){if(e.message.includes('CLAIM_REPLAY')){$('#status').textContent='このclaimは会場で受取済みです。';return {accepted:true,replay:true};}throw e;}}
async function claim(){if(busy)return;busy=true;$('#claim').disabled=true;$('#retry').disabled=true;try{
 const current=await refreshState(),status=await chainAPI('claim-status'),now=observedNow(anchor,wallNow());if(!claimAvailability(status,now).ready)throw Error('WINDOW_NOT_LIVE');
 const missing=participantMissing(current,root.device.publicKey),token=await chainAPI('claim-token',{frame:randomClaimFrame()}),out=await root.claims.issueDrop(token,claimConfig(),missing,now);
 if(!out.eligible){$('#status').textContent='今回は対象外でした。記録や鍵は変更していません。';showProof({eligible:false,window:token.value.window,frame:token.value.frame});return;}
 lastRow=out.claim;$('#download').hidden=false;$('#retry').hidden=false;await submit(lastRow);
 }finally{busy=false;await refresh({preserveStatus:true}).catch(()=>{});}
}

try{
 root=await DeviceStore.open('phone-'+client);$('#key').textContent='この端末の公開鍵 '+root.device.publicKey.slice(0,20)+'…';config=validateConfig(await chainAPI('config'));if(config.cluster!=='localnet')throw Error('CLAIM_PROGRAM_NOT_DEPLOYED');await root.exchange.saveConfig(config);
 const proof=hex(new Uint8Array(await crypto.subtle.sign('Ed25519',root.device.privateKey,joinMessage(config,client,root.device.publicKey))));state=await root.exchange.saveState(await chainAPI('join',{client,publicKey:root.device.publicKey,proof}),config);anchor=await root.exchange.clockAnchor(config);await refresh();
}catch(e){$('#phase').textContent='配布は利用できません';$('#claim').disabled=true;$('#retry').hidden=true;fail(e.message==='CHAIN_SERVICE_UNAVAILABLE'?Error('ローカル検証サービスに接続されていません。'):e);document.documentElement.dataset.claimParticipant='UNAVAILABLE';}
$('#claim').addEventListener('click',()=>claim().catch(fail));$('#retry').addEventListener('click',()=>{if(lastRow)submit(lastRow).catch(fail);});$('#download').addEventListener('click',()=>{if(lastRow)save(lastRow);});
