import {makeSoloCall,gradeResponse,calibrationOffset} from '../../packages/games/call-response.mjs';
import {prepareOffline} from './offline.mjs';
const $=selector=>document.querySelector(selector),pads=[...document.querySelectorAll('[data-pad]')];
let round=1,call=null,phase='idle',responseStart=0,taps=[],misses=0,timers=[],calibration=[],calibrationExpected=[];
let latency=Number(localStorage.getItem('tonari-call-latency'));
if(!Number.isFinite(latency)||Math.abs(latency)>200)latency=null;
const setPhase=value=>{phase=value;document.documentElement.dataset.callPhase=value;};
const clearTimers=()=>{for(const timer of timers)clearTimeout(timer);timers=[];};
const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
function flash(node){node.classList.add('hit');later(()=>node.classList.remove('hit'),110);}
function setPulse(){const node=$('#pulse');node.classList.remove('on');requestAnimationFrame(()=>node.classList.add('on'));}
function renderCall(){call=makeSoloCall(round,20261013);$('#round').textContent=`コール ${round}`;$('#accuracy').textContent=`${call.pads.length}拍・${call.bpm} BPM`;
 $('#ticker').replaceChildren(...call.pads.map((pad,index)=>{const dot=document.createElement('i');dot.dataset.callPad=String(pad);dot.dataset.beat=String(index);return dot;}));}
function playCall(){clearTimers();renderCall();setPhase('playback');$('#start').hidden=true;$('#retry').hidden=true;$('#call-status').textContent='もものコールを見て覚えよう。';document.body.classList.remove('full-combo');
 call.pads.forEach((pad,index)=>later(()=>{setPulse();pads[pad].classList.add('hit');document.querySelector(`[data-beat="${index}"]`).classList.add('on');later(()=>pads[pad].classList.remove('hit'),120);},index*call.stepMs));
 later(beginResponse,call.pads.length*call.stepMs+350);}
function beginResponse(){for(const dot of document.querySelectorAll('#ticker i'))dot.classList.remove('on');taps=[];responseStart=performance.now()+450;setPhase('ready');$('#call-status').textContent='せーの…';later(()=>{setPhase('response');setPulse();$('#call-status').textContent='同じコールを返してね。';},450);later(finishResponse,450+call.pads.length*call.stepMs+450);}
function finishResponse(){if(phase!=='response')return;setPhase('result');const result=gradeResponse(call,taps,latency||0);misses+=result.misses;$('#accuracy').textContent=`正確さ ${result.accuracy}%`;
 if(result.fullCombo){document.body.classList.add('full-combo');$('#call-status').textContent='フルコンボ 👑　ハイ！';document.querySelector('tonari-guide').setAttribute('state','complete');}
 else $('#call-status').textContent=`${result.hits}拍成功・${result.misses}拍ミス。正直な判定です。`;
 if(misses>=3){$('#retry').hidden=false;$('#retry').textContent='最初からもう一回';}else{$('#start').hidden=false;$('#start').textContent='次のコール（1拍長く）';round++;}}
function tap(pad,node){flash(node);if(phase==='calibration'){const index=calibration.length;if(index>=8)return;calibration.push({expected:calibrationExpected[index],actual:performance.now()});if(calibration.length===8){latency=calibrationOffset(calibration);localStorage.setItem('tonari-call-latency',String(latency));clearTimers();setPhase('idle');$('#call-status').textContent=`端末調整 ${latency>=0?'+':''}${latency}ms。音なしで始められます。`;$('#start').textContent='コール開始';}return;}
 if(phase==='response'&&performance.now()>=responseStart)taps.push({pad,at:performance.now()-responseStart});}
for(const node of pads)node.addEventListener('pointerdown',event=>{event.preventDefault();tap(Number(node.dataset.pad),node);});
function startCalibration(){clearTimers();calibration=[];calibrationExpected=[];setPhase('calibration');$('#start').hidden=true;$('#call-status').textContent='輪が光るたび、好きなパッドを8回タップ。';const base=performance.now()+700;for(let index=0;index<8;index++){const expected=base+index*600;calibrationExpected.push(expected);later(setPulse,expected-performance.now());}later(()=>{if(calibration.length<8){setPhase('idle');$('#start').hidden=false;$('#call-status').textContent='8回そろいませんでした。すぐやり直せます。';}},5700);}
$('#start').addEventListener('click',()=>latency===null?startCalibration():playCall());
$('#retry').addEventListener('click',()=>{clearTimers();round=1;misses=0;$('#retry').hidden=true;$('#start').hidden=false;$('#start').textContent='コール開始';$('#call-status').textContent='すぐ、もう一回できます。';setPhase('idle');renderCall();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['playback','ready','response','calibration'].includes(phase)){clearTimers();setPhase('idle');$('#start').hidden=false;$('#start').textContent=latency===null?'端末を8タップで調整':'コール開始';$('#call-status').textContent='画面を戻したので、安全に最初から再開します。';}});
renderCall();setPhase('idle');if(latency!==null){$('#start').textContent='コール開始';$('#call-status').textContent=`端末調整 ${latency>=0?'+':''}${latency}ms。音なしで始められます。`;}
prepareOffline().then(()=>{$('#offline-status').textContent='通信なしで開き直して遊べます。';document.documentElement.dataset.offlineReady='true';}).catch(error=>{$('#offline-status').textContent='通信なしでの再起動は準備できませんでした：'+error.message;});
