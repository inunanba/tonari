import {fromHex} from '../../packages/protocol/swap.mjs';
export function validateConfig(config){
 if(!config||Object.keys(config).sort().join()!==['show','policy','issuer','cluster','programId'].sort().join())throw Error('BAD_CONFIG');
 for(const k of ['show','policy','issuer'])fromHex(config[k],32);
 if(!['localnet','devnet'].includes(config.cluster)||config.programId!=='2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA')throw Error('UNSUPPORTED_CHAIN');return config;
}
/** Same-origin, bounded requests. Remote sponsors need a separately reviewed deployment. */
export async function chainAPI(endpoint,value){
 const url=new URL('../../api/tonari/'+endpoint,import.meta.url);
 const r=await fetch(url,{method:value?'POST':'GET',headers:value?{'Content-Type':'application/json'}:{},body:value?JSON.stringify(value):undefined,cache:'no-store',signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error(r.status===503||r.status===404?'CHAIN_SERVICE_UNAVAILABLE':(await r.text()).slice(0,160));
 const text=await r.text();if(text.length>16000)throw Error('RESPONSE_TOO_LARGE');return JSON.parse(text);
}
export const joinMessage=(config,client,key)=>new TextEncoder().encode(`TONARI/v2/local-join\0${config.show}:${client}:${key}`);

export function settlementPresentation(config,signature){
 validateConfig(config);
 if(!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature))throw Error('BAD_TRANSACTION_SIGNATURE');
 return config.cluster==='devnet'?{label:'Devnet取引 '+signature,url:'https://explorer.solana.com/tx/'+signature+'?cluster=devnet',status:'Solana Devnetの確定済み記録です。'}:{label:'ローカル取引 '+signature,url:null,status:'ローカル検証の確定済み記録です。'};
}

export function connectionNotice(config){
 validateConfig(config);return config.cluster==='devnet'?'Solana Devnetで開発検証しています。実際のお金は使いません。審査員向けの常設接続は制作中です。':'この画面はローカルチェーンで開発検証しています。公開Devnetの取引ではありません。';
}
