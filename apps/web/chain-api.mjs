import {fromHex} from '../../packages/protocol/swap.mjs';
export function validateConfig(config){
 if(!config||Object.keys(config).sort().join()!==['show','policy','issuer','cluster','programId'].sort().join())throw Error('BAD_CONFIG');
 for(const k of ['show','policy','issuer'])fromHex(config[k],32);
 if(config.cluster!=='localnet'||config.programId!=='2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA')throw Error('UNSUPPORTED_CHAIN');return config;
}
/** Same-origin, bounded requests. Remote sponsors need a separately reviewed deployment. */
export async function chainAPI(endpoint,value){
 const url=new URL('../../api/tonari/'+endpoint,import.meta.url);
 const r=await fetch(url,{method:value?'POST':'GET',headers:value?{'Content-Type':'application/json'}:{},body:value?JSON.stringify(value):undefined,cache:'no-store',signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error(r.status===503||r.status===404?'CHAIN_SERVICE_UNAVAILABLE':(await r.text()).slice(0,160));
 const text=await r.text();if(text.length>16000)throw Error('RESPONSE_TOO_LARGE');return JSON.parse(text);
}
export const joinMessage=(config,client,key)=>new TextEncoder().encode(`TONARI/v2/local-join\0${config.show}:${client}:${key}`);
