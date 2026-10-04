/** Signed claim evidence and scoped Merkle batches. Integrity is not issuance eligibility. */
import {fromHex,hex,concat,digest} from './swap.mjs';
import {uint32} from './swap-v2.mjs';
const enc=new TextEncoder();
const fields=['show','policy','ticket','checkpoint','window','frame','tile','tokenDigest','previous','sequence'];
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==keys.slice().sort().join())throw Error('BAD_CLAIM_FIELDS');}
function number(n){uint32(n);const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;}
function scope(s){exact(s,['show','policy']);return concat(fromHex(s.show,32),fromHex(s.policy,32));}
export function claimBytes(value){
 exact(value,fields);
 return concat(enc.encode('TONARI/v2/claim\0'),...fields.map(k=>['checkpoint','window','frame','sequence'].includes(k)?number(value[k]):fromHex(value[k],32)));
}
export async function signClaim(value,device){
 const snapshot=structuredClone(value),bytes=claimBytes(snapshot);
 if(snapshot.ticket!==device.publicKey)throw Error('WRONG_CLAIMANT');
 return {value:snapshot,signature:hex(new Uint8Array(await crypto.subtle.sign('Ed25519',device.privateKey,bytes)))};
}
export async function verifyClaim(envelope,expected){
 exact(envelope,['value','signature']);const e=structuredClone(envelope),bytes=claimBytes(e.value);
 scope(expected);if(e.value.show!==expected.show||e.value.policy!==expected.policy)throw Error('WRONG_CLAIM_SCOPE');
 const key=await crypto.subtle.importKey('raw',fromHex(e.value.ticket,32),'Ed25519',false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,fromHex(e.signature,64),bytes))throw Error('BAD_CLAIM_SIGNATURE');
 const id=hex(await digest(concat(enc.encode('TONARI/v2/claim-id\0'),bytes,fromHex(e.signature,64))));
 return {id,value:e.value,signature:e.signature};
}
async function leaf(id){return digest(concat(enc.encode('TONARI/v2/claim-leaf\0'),fromHex(id,32)));}
async function branch(a,b){return digest(concat(enc.encode('TONARI/v2/claim-node\0'),a,b));}
async function rootHash(s,count,node){return hex(await digest(concat(enc.encode('TONARI/v2/claims-root\0'),scope(s),number(count),node)));}
const MAX_BATCH=4096;
export async function buildClaimsBatch(envelopes,expected){
 if(!Array.isArray(envelopes)||envelopes.length>MAX_BATCH)throw Error('BAD_BATCH_SIZE');
 // Snapshot the whole batch and scope before the first await.
 const input=structuredClone(envelopes),s=structuredClone(expected);scope(s);
 const claims=[];for(const e of input)claims.push(await verifyClaim(e,s));
 claims.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(new Set(claims.map(c=>c.id)).size!==claims.length)throw Error('DUPLICATE_CLAIM');
 const count=claims.length,levels=[];
 if(count){levels.push(await Promise.all(claims.map(c=>leaf(c.id))));while(levels.at(-1).length>1){const last=levels.at(-1),next=[];for(let i=0;i<last.length;i+=2)next.push(await branch(last[i],last[i+1]??last[i]));levels.push(next);}}
 const node=count?levels.at(-1)[0]:await digest(enc.encode('TONARI/v2/claims-empty\0'));
 const root=await rootHash(s,count,node);
 const proofs=claims.map((c,index)=>{let i=index;const siblings=[];for(const level of levels.slice(0,-1)){siblings.push(hex(level[i^1]??level[i]));i=Math.floor(i/2);}return {id:c.id,index,count,siblings};});
 return {scope:s,root,count,claims,proofs};
}
export async function verifyClaimProof(envelope,proof,expected,trustedRoot){
 const e=structuredClone(envelope),p=structuredClone(proof),s=structuredClone(expected);scope(s);fromHex(trustedRoot,32);
 exact(p,['id','index','count','siblings']);fromHex(p.id,32);
 if(!Number.isSafeInteger(p.count)||p.count<1||p.count>MAX_BATCH||!Number.isSafeInteger(p.index)||p.index<0||p.index>=p.count||!Array.isArray(p.siblings))throw Error('BAD_CLAIM_PROOF');
 const claim=await verifyClaim(e,s);if(claim.id!==p.id)throw Error('WRONG_PROOF_CLAIM');
 let n=p.count,i=p.index,node=await leaf(p.id),depth=0;
 while(n>1){const sibling=fromHex(p.siblings[depth++],32);if((i^1)>=n&&hex(sibling)!==hex(node))throw Error('BAD_ODD_SIBLING');node=i%2?await branch(sibling,node):await branch(node,sibling);i=Math.floor(i/2);n=Math.ceil(n/2);}
 if(depth!==p.siblings.length||await rootHash(s,p.count,node)!==trustedRoot)throw Error('CLAIMS_ROOT_MISMATCH');
 return claim;
}
/** Check one ticket's complete log from genesis, independently of batch ordering. */
export async function verifyClaimLog(envelopes,expected,ticket){
 if(!Array.isArray(envelopes)||envelopes.length>MAX_BATCH)throw Error('BAD_BATCH_SIZE');
 fromHex(ticket,32);const input=structuredClone(envelopes),s=structuredClone(expected);let previous='00'.repeat(32);const output=[];
 for(let i=0;i<input.length;i++){const c=await verifyClaim(input[i],s);if(c.value.ticket!==ticket||c.value.sequence!==i||c.value.previous!==previous)throw Error('BROKEN_CLAIM_LOG');previous=c.id;output.push(c);}
 return output;
}
