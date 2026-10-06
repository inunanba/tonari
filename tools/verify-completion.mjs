#!/usr/bin/env node
/** Read-only portable completion verifier. Never reports a cNFT or chain anchor. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {verifyCompletion} from '../packages/protocol/completion.mjs';

export async function verifyCompletionDocument(document,expected){
 if(!document||Object.getPrototypeOf(document)!==Object.prototype)throw Error('BAD_COMPLETION_DOCUMENT');
 const keys=Object.keys(document).sort().join(),withAnchor=keys==='anchor,record';
 if(keys!=='record'&&!withAnchor)throw Error('BAD_COMPLETION_DOCUMENT');
 const verified=await verifyCompletion(document.record,expected);
 if(withAnchor){
  const anchor=document.anchor,fields=['address','cNFT','integrity','nonTransferability','onChainAnchor','portableRecord','recordDigest','signature'];
  if(!anchor||Object.getPrototypeOf(anchor)!==Object.prototype||Object.keys(anchor).sort().join()!==fields.sort().join()||anchor.integrity!=='VERIFIED'||anchor.portableRecord!=='VERIFIED'||anchor.onChainAnchor!=='VERIFIED'||anchor.cNFT!=='NOT_VERIFIED'||anchor.nonTransferability!=='NOT_VERIFIED'||anchor.recordDigest!==verified.id||typeof anchor.signature!=='string'||!anchor.signature||typeof anchor.address!=='string'||!anchor.address)throw Error('BAD_COMPLETION_ANCHOR_DOCUMENT');
 }
 return verified;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [file,show,policy,authority,...extra]=process.argv.slice(2);
  if(!file||!show||!policy||!authority||extra.length)throw Error('Usage: node tools/verify-completion.mjs completion.json SHOW_HEX POLICY_HEX AUTHORITY_HEX');
  const bytes=await readFile(file);
  if(bytes.length>1024*1024)throw Error('DOCUMENT_TOO_LARGE');
  console.log(JSON.stringify(await verifyCompletionDocument(JSON.parse(bytes.toString('utf8')),{show,policy,authority})));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
