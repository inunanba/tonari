const STEPS=Object.freeze(['swap','queue','call','tier','offer','proof']);
const fail=()=>{throw Error('BAD_JUDGE_JOURNEY');};

export function freshJourney(){return Object.freeze({version:1,completed:Object.freeze([]),tiles:18});}

export function validateJourney(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!=='completed,tiles,version'||value.version!==1||!Array.isArray(value.completed))fail();
 if(value.completed.length>STEPS.length||value.completed.some((step,index)=>step!==STEPS[index])||value.tiles!==18+value.completed.length)fail();
 return Object.freeze({version:1,completed:Object.freeze([...value.completed]),tiles:value.tiles});
}

export function advanceJourney(value,step,verified){
 const state=validateJourney(value),expected=STEPS[state.completed.length];
 if(step!==expected||verified!==true)fail();
 return validateJourney({version:1,completed:[...state.completed,step],tiles:state.tiles+1});
}

export function journeyComplete(value){return validateJourney(value).completed.length===STEPS.length;}
export const judgeSteps=STEPS;
