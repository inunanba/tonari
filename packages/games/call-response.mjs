function fail(code){throw Error(code);}
const exact=(value,keys,code)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==keys.slice().sort().join())fail(code);};

export function validateCall(value){
 exact(value,['id','bpm','pads'],'BAD_CALL');
 if(typeof value.id!=='string'||!/^[a-z0-9-]{1,48}$/.test(value.id)||!Number.isInteger(value.bpm)||value.bpm<100||value.bpm>140||!Array.isArray(value.pads)||value.pads.length<3||value.pads.length>12)fail('BAD_CALL');
 if(value.pads.some(pad=>pad!==null&&(!Number.isInteger(pad)||pad<0||pad>3))||value.pads.every(pad=>pad===null))fail('BAD_CALL');
 return Object.freeze({id:value.id,bpm:value.bpm,pads:Object.freeze([...value.pads]),stepMs:30000/value.bpm});
}

function normalizeCall(value){
 if(value&&Object.hasOwn(value,'stepMs')){
  exact(value,['id','bpm','pads','stepMs'],'BAD_CALL');
  const call=validateCall({id:value.id,bpm:value.bpm,pads:value.pads});
  if(value.stepMs!==call.stepMs)fail('BAD_CALL');
  return call;
 }
 return validateCall(value);
}

export function gradeResponse(callValue,tapsValue,latencyMs=0){
 const call=normalizeCall(callValue);if(!Array.isArray(tapsValue)||!Number.isFinite(latencyMs)||Math.abs(latencyMs)>200)fail('BAD_RESPONSE');
 let prior=-1;const taps=tapsValue.map(tap=>{exact(tap,['pad','at'],'BAD_RESPONSE');if(!Number.isInteger(tap.pad)||tap.pad<0||tap.pad>3||!Number.isFinite(tap.at)||tap.at<0||tap.at<=prior)fail('BAD_RESPONSE');prior=tap.at;return {pad:tap.pad,at:tap.at-latencyMs};});
 const expected=[];for(let beat=0;beat<call.pads.length;beat++)if(call.pads[beat]!==null)expected.push({beat,pad:call.pads[beat],at:beat*call.stepMs});
 const grades=expected.map((want,index)=>{const tap=taps[index];if(!tap||tap.pad!==want.pad)return {beat:want.beat,pad:want.pad,grade:'MISS',delta:null};const delta=Math.round(tap.at-want.at),absolute=Math.abs(delta);return {beat:want.beat,pad:want.pad,grade:absolute<=70?'BEST':absolute<=130?'GOOD':absolute<=200?'OK':'MISS',delta};});
 if(taps.length>expected.length)for(let index=expected.length;index<taps.length;index++)grades.push({beat:null,pad:taps[index].pad,grade:'MISS',delta:null});
 const hits=grades.filter(x=>x.grade!=='MISS').length,misses=grades.length-hits;
 return Object.freeze({grades:Object.freeze(grades.map(Object.freeze)),hits,misses,accuracy:grades.length?Math.round(hits/grades.length*100):0,fullCombo:misses===0});
}

export function makeSoloCall(round,seed=1){
 if(!Number.isInteger(round)||round<1||round>100||!Number.isSafeInteger(seed)||seed<0)fail('BAD_SOLO_ROUND');
 const length=Math.min(12,round+2),available=round<3?2:round<5?3:4,bpm=Math.min(140,100+Math.floor((round-1)/5)*5);let state=(seed^round*2654435761)>>>0;const pads=[];
 for(let beat=0;beat<length;beat++){state=(Math.imul(state,1664525)+1013904223)>>>0;pads.push(state%available);}
 return validateCall({id:`solo-${round}-${seed}`,bpm,pads});
}

export function calibrationOffset(samples){
 if(!Array.isArray(samples)||samples.length!==8)fail('BAD_CALIBRATION');const deltas=samples.map(sample=>{exact(sample,['expected','actual'],'BAD_CALIBRATION');if(!Number.isFinite(sample.expected)||!Number.isFinite(sample.actual))fail('BAD_CALIBRATION');return sample.actual-sample.expected;}).sort((a,b)=>a-b);const median=(deltas[3]+deltas[4])/2;return Math.max(-200,Math.min(200,Math.round(median)));
}
