#!/usr/bin/env node
/** Local, read-only integrity verification. Expected root must come from a trusted source. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildClaimsBatch,verifyClaimLog} from '../packages/protocol/claims.mjs';
export async function verifyClaimsDocument(document,expectedRoot,expectedScope){
 if(!document||Object.getPrototypeOf(document)!==Object.prototype||Object.keys(document).sort().join()!=='claims,scope')throw Error('BAD_CLAIMS_DOCUMENT');
 if(document.scope?.show!==expectedScope.show||document.scope?.policy!==expectedScope.policy)throw Error('WRONG_CLAIM_SCOPE');
 const batch=await buildClaimsBatch(document.claims,expectedScope);
 if(batch.root!==expectedRoot)throw Error('CLAIMS_ROOT_MISMATCH');
 const tickets=new Map();for(const c of batch.claims){const entries=tickets.get(c.value.ticket)??[];entries.push({value:c.value,signature:c.signature});tickets.set(c.value.ticket,entries);}
 for(const [ticket,entries]of tickets){entries.sort((a,b)=>a.value.sequence-b.value.sequence);await verifyClaimLog(entries,expectedScope,ticket);}
 return {integrity:'VERIFIED',root:batch.root,count:batch.count,tickets:tickets.size,issuanceEligibility:'NOT_VERIFIED',onChainAnchor:'NOT_VERIFIED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const [file,root,show,policy,...extra]=process.argv.slice(2);if(!file||!root||!show||!policy||extra.length)throw Error('Usage: node tools/verify-claims.mjs claims.json TRUSTED_ROOT SHOW_HEX POLICY_HEX');const bytes=await readFile(file);if(bytes.length>8*1024*1024)throw Error('DOCUMENT_TOO_LARGE');console.log(JSON.stringify(await verifyClaimsDocument(JSON.parse(bytes.toString('utf8')),root,{show,policy})));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
