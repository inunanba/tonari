#!/usr/bin/env node
/** Finalized, read-only Devnet verifier for the non-token completion PDA. */
import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Connection,PublicKey} from '@solana/web3.js';
import {verifyCompletion} from '../packages/protocol/completion.mjs';
import {completionAddress,readAccount,PROGRAM_ID} from './chain-client.mjs';

const signaturePattern=/^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
export function requireDevnetReadRPC(value){
 let url;try{url=new URL(value);}catch{throw Error('DEVNET_RPC_REQUIRED');}
 if(url.href!=='https://api.devnet.solana.com/')throw Error('DEVNET_RPC_REQUIRED');
 return url.href;
}

export async function verifyCompletionAnchorOnChain({record,expected,connection,signature}){
 if(!signaturePattern.test(signature||''))throw Error('BAD_TRANSACTION_SIGNATURE');
 const portable=await verifyCompletion(record,expected),show=new PublicKey(Buffer.from(expected.show,'hex')),device=new PublicKey(Buffer.from(portable.recipient,'hex')),address=completionAddress(show,device);
 const status=(await connection.getSignatureStatuses([signature],{searchTransactionHistory:true}))?.value?.[0];
 if(!status||status.err||status.confirmationStatus!=='finalized'||!Number.isSafeInteger(status.slot))throw Error('ANCHOR_TRANSACTION_NOT_FINALIZED');
 const history=await connection.getSignaturesForAddress(address,{limit:20},'finalized'),entry=history.find(x=>x.signature===signature);
 if(!entry||entry.err||entry.confirmationStatus!=='finalized'||entry.slot!==status.slot)throw Error('ANCHOR_TRANSACTION_NOT_BOUND');
 const result=await connection.getAccountInfoAndContext(address,{commitment:'finalized',minContextSlot:status.slot});
 if(!result||!Number.isSafeInteger(result.context?.slot)||result.context.slot<status.slot)throw Error('ANCHOR_READBACK_NOT_FINALIZED');
 const account=readAccount(result.value,'Completion');
 if(!account.show.equals(show)||!account.device.equals(device)||!account.policy.equals(Buffer.from(expected.policy,'hex'))||!account.recordDigest.equals(Buffer.from(portable.id,'hex')))throw Error('ANCHOR_ACCOUNT_MISMATCH');
 return Object.freeze({
  integrity:'VERIFIED',portableRecord:'VERIFIED',onChainAnchor:'VERIFIED',cNFT:'NOT_VERIFIED',nonTransferability:'NOT_VERIFIED',
  programId:PROGRAM_ID.toBase58(),address:address.toBase58(),transaction:signature,slot:status.slot,anchoredAt:account.anchoredAt,recordDigest:portable.id
 });
}

export async function verifyCompletionAnchorDocument(document,expected,connection,signature){
 if(!document||Object.getPrototypeOf(document)!==Object.prototype||Object.keys(document).join()!=='record')throw Error('BAD_COMPLETION_DOCUMENT');
 return verifyCompletionAnchorOnChain({record:document.record,expected,connection,signature});
}

async function main(args){
 const [file,show,policy,authority,rpc,signature,...extra]=args;
 if(!file||!show||!policy||!authority||!rpc||!signature||extra.length)throw Error('Usage: node tools/verify-completion-anchor.mjs completion.json SHOW_HEX POLICY_HEX AUTHORITY_HEX DEVNET_RPC TX_SIGNATURE');
 if((await stat(file)).size>1_048_576)throw Error('COMPLETION_FILE_TOO_LARGE');
 const document=JSON.parse(await readFile(file,'utf8')),connection=new Connection(requireDevnetReadRPC(rpc),'finalized');
 console.log(JSON.stringify(await verifyCompletionAnchorDocument(document,{show,policy,authority},connection,signature),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
