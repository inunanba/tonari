import {allocate,initialAllocation,govern,initialGovernor} from '../../packages/protocol/allocator.mjs';
import {tieredAvailability} from '../../packages/protocol/tiered-chance.mjs';
import {prepareOffline} from './offline.mjs';
const $=s=>document.querySelector(s),ids=['G01','G02','G11','G12','G21','G22','G31','G32'];
let state=initialAllocation(),waits=Array(8).fill(0),time=0,last,governor=initialGovernor(),lastGovernor,tierCrowding=ids.map((_,index)=>index===4?'quiet':'crowded');const records=[];
let claimFrame=0;
async function claimAPI(endpoint,body){const response=await fetch('/api/tonari/'+endpoint,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});if(!response.ok)throw Error(await response.text());return response.json();}
function saveJSON(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showClaim(value){document.documentElement.dataset.claimStatus=value.status;$('#claim-proof').hidden=false;$('#claim-proof').textContent=JSON.stringify(value,null,2);$('#claim-status').textContent=value.status==='UNAVAILABLE'?'配布PDAは公開Devnetへ未配置です。ローカル検証環境でのみ操作できます。':'状態: '+value.status+' · 配布 '+(value.issued??0)+'件 · claim '+(value.claims??0)+'件';const connected=value.status!=='UNAVAILABLE';$('#claim-open').disabled=!connected||!['IDLE','REVEALED'].includes(value.status);$('#claim-token').disabled=value.status!=='OPEN';$('#claim-submit').disabled=value.status!=='OPEN';$('#claim-root').disabled=value.status!=='OPEN';$('#claim-reveal').disabled=value.status!=='ROOT_POSTED';}
async function claimAction(job){try{showClaim(await job());}catch(e){$('#claim-status').textContent='操作を確定できませんでした: '+e.message;}}
claimAPI('claim-status').then(showClaim).catch(()=>{showClaim({status:'UNAVAILABLE'});});
$('#claim-open').addEventListener('click',()=>claimAction(()=>claimAPI('claim-open',{window:Math.floor(Date.now()/1000),startsIn:2,duration:20,revealDelay:2,probabilityPPM:Number($('#claim-probability').value),cap:Number($('#claim-cap').value)})));
$('#claim-token').addEventListener('click',async()=>{try{const token=await claimAPI('claim-token',{frame:claimFrame++});saveJSON('tonari-drop-token.json',token);showClaim(await claimAPI('claim-status'));}catch(e){$('#claim-status').textContent='配布票を作れませんでした: '+e.message;}});
$('#claim-submit').addEventListener('click',async()=>{const file=$('#claim-file').files[0];if(!file){$('#claim-status').textContent='端末が保存したclaim記録JSONを選んでください。';return;}if(file.size>16384){$('#claim-status').textContent='claim記録が大きすぎます。';return;}await claimAction(async()=>{await claimAPI('claim-submit',JSON.parse(await file.text()));return claimAPI('claim-status');});});
$('#claim-root').addEventListener('click',()=>claimAction(()=>claimAPI('claim-root',{})));$('#claim-reveal').addEventListener('click',()=>claimAction(()=>claimAPI('claim-reveal',{})));
function step(boundary=false,render=true){
 const before=structuredClone(state),governorBefore=structuredClone(governor),governorInput={time,target:Number($('#nudge').value),waits:[...waits],induced10:$('#induced').checked?[0,0,0,0,8,0,0,0]:Array(8).fill(0),boundary,windowMinutes:6,early:$('#early').checked};
 lastGovernor=govern(governor,governorInput);governor=lastGovernor.state;
 const input={waits:[...waits],boundary,nudge:lastGovernor.effectiveForFrame,budget:governor.windowBudget,given:0,spotGiven:Array(8).fill(0)};
 last=allocate(state,input);state=last.state;time+=.5;
 records.push({time,before,input,output:last,governorBefore,governorInput,governorOutput:lastGovernor});if(render)paint();
}
function paint(){
 const tiered=tieredAvailability({spots:ids.map((id,index)=>({id,crowding:tierCrowding[index]})),homeSpot:'G01',spotGiven:Array(8).fill(0),totalGiven:7,spotCap:6,totalCap:24,enabled:governor.effective>0});
 $('#elapsed').textContent='模擬経過 '+time+'分 · 6分間の配布上限 '+governor.windowBudget.toFixed(1)+'枚 · 実際の配布は行いません。';
 $('#governor').textContent='次の計算で使う配布の強さ：'+governor.effective.toFixed(2)+(lastGovernor.warning?' · 誘導による集中の警告あり':' · 誘導による集中の警告なし')+' · お知らせ: '+(tiered.recommended??'新しいスポットなし');
 $('#checkpoints').replaceChildren();
 ids.forEach((id,k)=>{const card=document.createElement('article'),row=tiered.rows[k],eligible=row.open;card.className='checkpoint'+(eligible?'':' blocked');card.dataset.checkpoint=id;
  const name=document.createElement('strong');name.textContent=id;
  const wait=document.createElement('span');wait.className='wait';wait.textContent='模擬待ち時間 '+waits[k]+'分';
  const chance=document.createElement('div');chance.className='chance';chance.textContent=(row.chancePPM/10_000).toFixed(1)+'%';
  const label=document.createElement('div');label.className='fine';label.textContent={seat:'席・列でも少しずつ',crowded:'混雑中は控えめ',quiet:'空いているため最も出やすい'}[row.tier]+'（未所持ピースのみ）';
  const eligibility=document.createElement('div');eligibility.className='eligibility';eligibility.textContent=!eligible?'上限または停止指定で閉じています':id===tiered.recommended?'いま出やすいスポットとしてお知らせ':'交換とあわせて自分のペースで集められます';card.dataset.eligible=String(eligible);card.dataset.chance=String(row.chancePPM);card.dataset.tier=row.tier;card.dataset.recommended=String(id===tiered.recommended);card.append(name,wait,chance,label,eligibility);$('#checkpoints').append(card);
 });
}
// Warmup is logged explicitly, rather than pretending a quiet frame instantly reaches full probability.
for(let n=0;n<30;n++)step(n%12===0,false);paint();$('#status').textContent='最初の15分を模擬計算しました。G21の混雑を変えて確かめられます。';
$('#busy').addEventListener('click',()=>{waits[4]=9;tierCrowding[4]='crowded';tierCrowding[5]='quiet';step(false);$('#status').textContent='G21を混雑中にし、いま出やすいスポットをG22へ切り替えました。';});
$('#quiet').addEventListener('click',()=>{waits[4]=0;tierCrowding[4]='quiet';tierCrowding[5]='crowded';step(false);$('#status').textContent='G21を空いている状態に戻し、いま出やすいスポットをG21へ切り替えました。';});
$('#step').addEventListener('click',()=>{step(false);$('#status').textContent='同じ配布期間のまま、模擬時間を30秒進めました。';});
$('#window').addEventListener('click',()=>{step(true);$('#status').textContent='次の配布期間を開始し、候補を見直しました。';});
$('#nudge').addEventListener('input',()=>{$('#nudge-value').textContent=$('#nudge').value;step(false);});
for(const id of ['induced','early'])$('#'+id).addEventListener('change',()=>step(false));
$('#download').addEventListener('click',()=>saveJSON('tonari-allocation-model.json',{version:2,kind:'TONARI_ALLOCATION_MODEL_TRACE',sensor:'SIMULATED',model:'stylised, not calibrated',tiersPPM:{seat:30000,crowded:10000,quiet:180000},scope:'three-tier missing-piece chance plus deterministic allocation/governor/caps; not full simulator',records}));
prepareOffline().then(()=>{$('#offline-status').textContent='通信なしで計算を続けられます。';document.documentElement.dataset.offlineReady='true';}).catch(e=>{$('#offline-status').textContent='通信なしでの再起動は準備できませんでした：'+e.message;});
