/** Browser-safe bridge from a verified portable completion record to the non-token PDA anchor. */
import {fromHex,hex,concat} from './swap.mjs';
import {verifyCompletion} from './completion.mjs';

const enc=new TextEncoder();
const DOMAIN=enc.encode('TONARI/v2/completion-anchor\0');
const fields=['show','policy','device','recordDigest'];
const exact=(value,expected,error)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==[...expected].sort().join())throw Error(error);};
const verify=async(pub,sig,message)=>crypto.subtle.verify('Ed25519',await crypto.subtle.importKey('raw',fromHex(pub,32),'Ed25519',false,['verify']),fromHex(sig,64),message);

export function completionAnchorBytes(value){
 exact(value,fields,'BAD_COMPLETION_ANCHOR_FIELDS');
 const digest=fromHex(value.recordDigest,32);
 if(digest.every(x=>x===0))throw Error('BAD_COMPLETION_ANCHOR_DIGEST');
 return concat(DOMAIN,fromHex(value.show,32),fromHex(value.policy,32),fromHex(value.device,32),digest);
}

export async function prepareCompletionAnchor(record,expected,device){
 const verified=await verifyCompletion(record,expected);
 if(!device||device.publicKey!==verified.recipient||!device.privateKey)throw Error('WRONG_COMPLETION_ANCHOR_DEVICE');
 const value={show:expected.show,policy:expected.policy,device:verified.recipient,recordDigest:verified.id};
 const deviceSignature=hex(new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,completionAnchorBytes(value))));
 return Object.freeze({value:Object.freeze(value),deviceSignature});
}

export async function verifyCompletionAnchorRequest(request,record,expected){
 exact(request,['value','deviceSignature'],'BAD_COMPLETION_ANCHOR_REQUEST');
 const verified=await verifyCompletion(record,expected),snapshot=structuredClone(request);
 completionAnchorBytes(snapshot.value);
 if(snapshot.value.show!==expected.show||snapshot.value.policy!==expected.policy||snapshot.value.device!==verified.recipient||snapshot.value.recordDigest!==verified.id)throw Error('WRONG_COMPLETION_ANCHOR_BINDING');
 if(!await verify(snapshot.value.device,snapshot.deviceSignature,completionAnchorBytes(snapshot.value)))throw Error('BAD_COMPLETION_ANCHOR_SIGNATURE');
 return Object.freeze({value:Object.freeze(snapshot.value),deviceSignature:snapshot.deviceSignature,portableRecord:'VERIFIED',onChainAnchor:'NOT_VERIFIED',cNFT:'NOT_VERIFIED',nonTransferability:'NOT_VERIFIED'});
}
