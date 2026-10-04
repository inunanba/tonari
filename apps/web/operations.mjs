import {allocate,initialAllocation,govern,initialGovernor} from '../../packages/protocol/allocator.mjs';
import {prepareOffline} from './offline.mjs';
const $=s=>document.querySelector(s),ids=['G01','G02','G11','G12','G21','G22','G31','G32'];
let state=initialAllocation(),waits=Array(8).fill(0),time=0,last,governor=initialGovernor(),lastGovernor;const records=[];
function step(boundary=false,render=true){
 const before=structuredClone(state),governorBefore=structuredClone(governor),governorInput={time,target:Number($('#nudge').value),waits:[...waits],induced10:$('#induced').checked?[0,0,0,0,8,0,0,0]:Array(8).fill(0),boundary,windowMinutes:6,early:$('#early').checked};
 lastGovernor=govern(governor,governorInput);governor=lastGovernor.state;
 const input={waits:[...waits],boundary,nudge:lastGovernor.effectiveForFrame,budget:governor.windowBudget,given:0,spotGiven:Array(8).fill(0)};
 last=allocate(state,input);state=last.state;time+=.5;
 records.push({time,before,input,output:last,governorBefore,governorInput,governorOutput:lastGovernor});if(render)paint();
}
function paint(){
 $('#elapsed').textContent='模擬経過 '+time+'分 · 6分間の配布上限 '+governor.windowBudget.toFixed(1)+'枚 · 実際の配布は行いません。';
 $('#governor').textContent='次の計算で使う配布の強さ：'+governor.effective.toFixed(2)+(lastGovernor.warning?' · 誘導による集中の警告あり':' · 誘導による集中の警告なし');
 $('#checkpoints').replaceChildren();
 ids.forEach((id,k)=>{const card=document.createElement('article'),eligible=!!last.suggestions&&last.suggestions[k]>0;card.className='checkpoint'+(eligible?'':' blocked');card.dataset.checkpoint=id;
  const name=document.createElement('strong');name.textContent=id;
  const wait=document.createElement('span');wait.className='wait';wait.textContent='模擬待ち時間 '+waits[k]+'分';
  const chance=document.createElement('div');chance.className='chance';chance.textContent=(last.chances[k]*100).toFixed(1)+'%';
  const label=document.createElement('div');label.className='fine';label.textContent='一回の読み取りでレアを受け取る計算上の確率';
  const eligibility=document.createElement('div');eligibility.className='eligibility';eligibility.textContent=eligible?'配布候補に入っています':'配布候補から外しています';card.dataset.eligible=String(eligible);card.dataset.chance=String(last.chances[k]);card.append(name,wait,chance,label,eligibility);$('#checkpoints').append(card);
 });
}
// Warmup is logged explicitly, rather than pretending a quiet frame instantly reaches full probability.
for(let n=0;n<30;n++)step(n%12===0,false);paint();$('#status').textContent='最初の15分を模擬計算しました。G21の混雑を変えて確かめられます。';
$('#busy').addEventListener('click',()=>{waits[4]=9;step(false);$('#status').textContent='G21の模擬待ち時間を9分にしました。配布候補とレア確率が下がります。';});
$('#quiet').addEventListener('click',()=>{waits[4]=0;step(false);$('#status').textContent='G21を空いている状態に戻しました。次の配布期間までは候補に戻しません。';});
$('#step').addEventListener('click',()=>{step(false);$('#status').textContent='同じ配布期間のまま、模擬時間を30秒進めました。';});
$('#window').addEventListener('click',()=>{step(true);$('#status').textContent='次の配布期間を開始し、候補を見直しました。';});
$('#nudge').addEventListener('input',()=>{$('#nudge-value').textContent=$('#nudge').value;step(false);});
for(const id of ['induced','early'])$('#'+id).addEventListener('change',()=>step(false));
$('#download').addEventListener('click',()=>{const record={version:1,kind:'TONARI_ALLOCATION_MODEL_TRACE',sensor:'SIMULATED',model:'stylised, not calibrated',scope:'deterministic allocation/governor/early-budget kernels; operator-cap and monotone-window-gate variants; not full simulator',records};const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tonari-allocation-model.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
prepareOffline().then(()=>{$('#offline-status').textContent='通信なしで計算を続けられます。';document.documentElement.dataset.offlineReady='true';}).catch(e=>{$('#offline-status').textContent='通信なしでの再起動は準備できませんでした：'+e.message;});
