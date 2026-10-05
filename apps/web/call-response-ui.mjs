import {validateCall,makeSoloCall,gradeResponse,calibrationOffset} from '../../packages/games/call-response.mjs';
import {DeviceStore} from '../../packages/protocol/storage.mjs';
import {hex,fromHex,concat} from '../../packages/protocol/swap.mjs';
import {publicKeyWire,decodeWire} from '../../packages/protocol/wire-v2.mjs';
import {signRallyCall,inspectRallyCall,acceptRallyCall,inspectRallyPacket,continueRally,rallyWire,readRallyWire,RALLY_BODY_BYTES} from '../../packages/protocol/rally.mjs';
import {encodeRallySession,inspectRallySession} from '../../packages/protocol/rally-session.mjs';
import {qrRaster} from '../../packages/protocol/qr.mjs';
import {CameraReader,readQRFile} from './camera.mjs';
import {prepareOffline} from './offline.mjs';
const $=selector=>document.querySelector(selector),pads=[...document.querySelectorAll('[data-pad]')];
let round=1,call=null,phase='idle',responseStart=0,taps=[],misses=0,timers=[],calibration=[],calibrationExpected=[];
let rallyRoot=null,device=null,incomingRally=null,latestPacket=null;
const rallyKey='tonari-call-rally-v1',camera=new CameraReader($('#rally-video'));
let latency=Number(localStorage.getItem('tonari-call-latency'));
if(!Number.isFinite(latency)||Math.abs(latency)>200)latency=null;
const setPhase=value=>{phase=value;document.documentElement.dataset.callPhase=value;};
const clearTimers=()=>{for(const timer of timers)clearTimeout(timer);timers=[];};
const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
function flash(node){node.classList.add('hit');later(()=>node.classList.remove('hit'),110);}
function setPulse(){const node=$('#pulse');node.classList.remove('on');requestAnimationFrame(()=>node.classList.add('on'));}
function renderCall(next=null){call=next?validateCall(next):makeSoloCall(round,20261013);$('#round').textContent=next?`となりのコール ${next.id.split('-').at(-1)}`:`コール ${round}`;$('#accuracy').textContent=`${call.pads.length}拍・${call.bpm} BPM`;
 $('#ticker').replaceChildren(...call.pads.map((pad,index)=>{const dot=document.createElement('i');dot.dataset.callPad=String(pad);dot.dataset.beat=String(index);return dot;}));}
function playCall(next=null){clearTimers();renderCall(next);setPhase('playback');$('#start').hidden=true;$('#retry').hidden=true;$('#rally-play').hidden=true;$('#call-status').textContent=next?'となりの署名コールを見て覚えよう。':'もものコールを見て覚えよう。';document.body.classList.remove('full-combo');
 call.pads.forEach((pad,index)=>later(()=>{setPulse();pads[pad].classList.add('hit');document.querySelector(`[data-beat="${index}"]`).classList.add('on');later(()=>pads[pad].classList.remove('hit'),120);},index*call.stepMs));
 later(beginResponse,call.pads.length*call.stepMs+350);}
function beginResponse(){for(const dot of document.querySelectorAll('#ticker i'))dot.classList.remove('on');taps=[];responseStart=performance.now()+450;setPhase('ready');$('#call-status').textContent='せーの…';later(()=>{setPhase('response');setPulse();$('#call-status').textContent='同じコールを返してね。';},450);later(finishResponse,450+call.pads.length*call.stepMs+450);}
async function finishResponse(){if(phase!=='response')return;setPhase('result');const result=gradeResponse(call,taps,latency||0);misses+=result.misses;$('#accuracy').textContent=`正確さ ${result.accuracy}%`;
 if(result.fullCombo){document.body.classList.add('full-combo');$('#call-status').textContent='フルコンボ 👑　ハイ！';document.querySelector('tonari-guide').setAttribute('state','complete');}
 else $('#call-status').textContent=`${result.hits}拍成功・${result.misses}拍ミス。正直な判定です。`;
 if(incomingRally){try{const packet=await acceptRallyCall(device,incomingRally,{accuracy:result.accuracy,misses:result.misses,fullCombo:result.fullCombo});incomingRally=null;await presentRally(rallyWire('P',packet),'返事に署名しました。このQRをとなりへ返してください。');$('#rally-next').hidden=false;latestPacket=packet;}catch(error){rallyError(error);}return;}
 if(misses>=3){$('#retry').hidden=false;$('#retry').textContent='最初からもう一回';}else{$('#start').hidden=false;$('#start').textContent='次のコール（1拍長く）';round++;}}
function tap(pad,node){flash(node);if(phase==='calibration'){const index=calibration.length;if(index>=8)return;calibration.push({expected:calibrationExpected[index],actual:performance.now()});if(calibration.length===8){latency=calibrationOffset(calibration);localStorage.setItem('tonari-call-latency',String(latency));clearTimers();setPhase('idle');$('#call-status').textContent=`端末調整 ${latency>=0?'+':''}${latency}ms。音なしで始められます。`;$('#start').textContent='コール開始';}return;}
 if(phase==='response'&&performance.now()>=responseStart)taps.push({pad,at:performance.now()-responseStart});}
for(const node of pads)node.addEventListener('pointerdown',event=>{event.preventDefault();tap(Number(node.dataset.pad),node);});
function startCalibration(){clearTimers();calibration=[];calibrationExpected=[];setPhase('calibration');$('#start').hidden=true;$('#call-status').textContent='輪が光るたび、好きなパッドを8回タップ。';const base=performance.now()+700;for(let index=0;index<8;index++){const expected=base+index*600;calibrationExpected.push(expected);later(setPulse,expected-performance.now());}later(()=>{if(calibration.length<8){setPhase('idle');$('#start').hidden=false;$('#call-status').textContent='8回そろいませんでした。すぐやり直せます。';}},5700);}
$('#start').addEventListener('click',()=>latency===null?startCalibration():playCall());
$('#retry').addEventListener('click',()=>{clearTimers();round=1;misses=0;$('#retry').hidden=true;$('#start').hidden=false;$('#start').textContent='コール開始';$('#call-status').textContent='すぐ、もう一回できます。';setPhase('idle');renderCall();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['playback','ready','response','calibration'].includes(phase)){clearTimers();setPhase('idle');$('#start').hidden=false;$('#start').textContent=latency===null?'端末を8タップで調整':'コール開始';$('#call-status').textContent='画面を戻したので、安全に最初から再開します。';}});
const rallyBytes=signed=>concat(fromHex(signed.body,RALLY_BODY_BYTES),fromHex(signed.signature,64));
function drawRally(text){const raster=qrRaster(text),canvas=$('#rally-qr');canvas.hidden=false;canvas.width=raster.width;canvas.height=raster.height;canvas.getContext('2d').putImageData(new ImageData(raster.data,raster.width,raster.height),0,0);}
const rallyError=error=>{$('#rally-status').textContent='ラリーを確認できませんでした：'+error.message;};
async function presentRally(wire,status){localStorage.setItem(rallyKey,await encodeRallySession(wire,device.publicKey));drawRally(wire);$('#rally-status').textContent=status;$('#rally').hidden=false;}
async function createRallyTo(publicKey){const solo=makeSoloCall(1,20261013),show=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('TONARI/v1/call-response-show')))),signed=await signRallyCall(device,{show,rally:hex(crypto.getRandomValues(new Uint8Array(16))),from:device.publicKey,to:publicKey,prior:'00'.repeat(32),round:1,bpm:solo.bpm,pads:[...solo.pads]});await presentRally(rallyWire('C',rallyBytes(signed)),'署名コールです。このQRをとなりに読んでもらってください。');}
async function readRally(text){const key=(()=>{try{const value=decodeWire(text);return value.type==='K'?hex(value.bytes):null;}catch{return null;}})();if(key){if(key===device.publicKey)throw Error('自分のQRです。');await createRallyTo(key);return;}
 const decoded=readRallyWire(text);if(decoded.type==='C'){const signed={body:hex(decoded.bytes.slice(0,RALLY_BODY_BYTES)),signature:hex(decoded.bytes.slice(RALLY_BODY_BYTES))},rallyCall=await inspectRallyCall(signed);if(rallyCall.to!==device.publicKey)throw Error('この端末宛てではありません。');incomingRally=signed;await presentRally(text,'署名を確認しました。コールを返すと、結果にも署名します。');$('#rally-play').hidden=false;$('#rally-play').onclick=()=>playCall({id:`rally-${rallyCall.round}`,bpm:rallyCall.bpm,pads:[...rallyCall.pads]});return;}
 const proof=await inspectRallyPacket(decoded.bytes);if(proof.call.from!==device.publicKey&&proof.call.to!==device.publicKey)throw Error('この端末のラリーではありません。');latestPacket=decoded.bytes;await presentRally(text,`双方の署名を確認しました。正確さ ${proof.grade.accuracy}%・${proof.grade.misses}ミス。`);$('#rally-next').hidden=proof.call.to!==device.publicKey;}
async function initRally(){try{rallyRoot=await DeviceStore.open('call-response-rally');device=rallyRoot.device;$('#rally').hidden=false;$('#rally-key').textContent='この端末 '+device.publicKey.slice(0,16)+'…';const saved=localStorage.getItem(rallyKey);if(saved){try{const session=await inspectRallySession(saved,device.publicKey);if(session.type==='C'&&session.proof.call.from===device.publicKey){drawRally(session.wire);$('#rally-status').textContent='保存した署名コールです。となりに読んでもらってください。';}else await readRally(session.wire);}catch{localStorage.removeItem(rallyKey);$('#rally-status').textContent='保存されたラリーが壊れていたため、安全に破棄しました。';}}else{drawRally(publicKeyWire(device.publicKey));$('#rally-status').textContent='このQRをとなりに読んでもらうか、相手の端末QRを読んで始めます。';}}catch(error){rallyError(error);}}
$('#rally-scan').addEventListener('click',async()=>{try{await camera.start(text=>readRally(text),rallyError);}catch(error){rallyError(error);}});$('#rally-stop').addEventListener('click',()=>camera.stop());
$('#rally-image').addEventListener('change',async()=>{camera.stop();try{await readRally(await readQRFile($('#rally-image').files[0]));}catch(error){rallyError(error);}finally{$('#rally-image').value='';}});
$('#rally-next').addEventListener('click',async()=>{try{if(!latestPacket)throw Error('返事QRを先に確認してください。');const proof=await inspectRallyPacket(latestPacket),next=makeSoloCall(Math.min(100,proof.call.round+1),20261013),signed=await continueRally(device,latestPacket,[...next.pads],next.bpm);latestPacket=null;$('#rally-next').hidden=true;await presentRally(rallyWire('C',rallyBytes(signed)),'次の署名コールです。1拍長くして、となりへ渡してください。');}catch(error){rallyError(error);}});
window.addEventListener('pagehide',()=>{camera.stop();rallyRoot?.close();});
renderCall();setPhase('idle');if(latency!==null){$('#start').textContent='コール開始';$('#call-status').textContent=`端末調整 ${latency>=0?'+':''}${latency}ms。音なしで始められます。`;}initRally();
prepareOffline().then(()=>{$('#offline-status').textContent='通信なしで開き直して遊べます。';document.documentElement.dataset.offlineReady='true';}).catch(error=>{$('#offline-status').textContent='通信なしでの再起動は準備できませんでした：'+error.message;});
