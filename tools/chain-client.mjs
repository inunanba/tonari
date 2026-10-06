/** Local/test client only. Never loaded by the PWA or connected to a wallet. */
import {createHash} from 'node:crypto';
import {PublicKey,Transaction,TransactionInstruction,SystemProgram,SYSVAR_INSTRUCTIONS_PUBKEY} from '@solana/web3.js';
import {decodeOffer} from '../packages/protocol/swap-v2.mjs';
import {swapSignatureInstructions} from '../packages/protocol/precompile-v2.mjs';
import {signatureInstruction} from '../packages/protocol/precompile.mjs';
export const PROGRAM_ID=new PublicKey('2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA');
export const sha=(...data)=>createHash('sha256').update(Buffer.concat(data.map(x=>Buffer.from(x)))).digest();
export const discriminator=(namespace,name)=>sha(Buffer.from(`${namespace}:${name}`)).subarray(0,8);
export function u32(n){if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)throw Error('BAD_UINT32');const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;}
export const pda=(...seeds)=>PublicKey.findProgramAddressSync(seeds.map(x=>Buffer.from(x)),PROGRAM_ID)[0];
export const showAddress=seed=>pda(Buffer.from('show'),seed);
export const ticketAddress=(show,owner)=>pda(Buffer.from('ticket'),show.toBuffer(),owner.toBuffer());
export const tileAddress=(show,id)=>pda(Buffer.from('tile'),show.toBuffer(),id);
export function pairHash(a,b){const x=a.toBuffer(),y=b.toBuffer();return Buffer.compare(x,y)<0?sha(x,y):sha(y,x);}
export const pairAddress=(show,a,b)=>pda(Buffer.from('pair'),show.toBuffer(),pairHash(a,b));
export const nonceAddress=(show,nonce)=>pda(Buffer.from('nonce'),show.toBuffer(),nonce);
export const claimWindowAddress=(show,window)=>pda(Buffer.from('claim-window'),show.toBuffer(),u32(window));
export const completionAddress=(show,device)=>pda(Buffer.from('completion'),show.toBuffer(),device.toBuffer());
export const policyHash=(show,deadline,cap)=>sha(Buffer.from('TONARI/v2/show-policy\0'),show.toBuffer(),u32(deadline),u32(cap));
export const dropRevealHash=(show,policy,window,secret)=>sha(Buffer.from('TONARI/v2/drop-reveal\0'),show.toBuffer(),Buffer.from(policy),u32(window),Buffer.from(secret));
export function completionAnchorMessage(show,policy,device,recordDigest){
 const p=Buffer.from(policy),d=Buffer.from(recordDigest);
 if(p.length!==32||d.length!==32||d.every(x=>x===0))throw Error('BAD_COMPLETION_ANCHOR');
 return Buffer.concat([Buffer.from('TONARI/v2/completion-anchor\0'),show.toBuffer(),p,device.toBuffer(),d]);
}
export const meta=(pubkey,isWritable=false,isSigner=false)=>({pubkey,isWritable,isSigner});
export function instruction(name,args,keys){return new TransactionInstruction({programId:PROGRAM_ID,keys,data:Buffer.concat([discriminator('global',name),...args.map(x=>Buffer.from(x))])});}
export const createShow=(authority,seed,deadline,cap)=>instruction('create_show',[seed,u32(deadline),u32(cap)],[meta(authority,true,true),meta(showAddress(seed),true),meta(SystemProgram.programId)]);
export const registerTicket=(authority,show,owner)=>instruction('register_ticket',[owner.toBuffer()],[meta(authority,true,true),meta(show),meta(ticketAddress(show,owner),true),meta(SystemProgram.programId)]);
export const issueTile=(authority,show,owner,id)=>instruction('issue_tile',[id],[meta(authority,true,true),meta(show),meta(ticketAddress(show,owner)),meta(tileAddress(show,id),true),meta(SystemProgram.programId)]);
export const pauseShow=(authority,show,paused)=>instruction('pause_show',[Uint8Array.of(+paused)],[meta(authority,false,true),meta(show,true)]);
export const commitClaimWindow=(authority,show,{window,checkpointKey,entropyCommitment,validFrom,validTo,revealAfter,probabilityPPM,cap})=>instruction('commit_claim_window',[u32(window),new PublicKey(checkpointKey).toBuffer(),Buffer.from(entropyCommitment),u32(validFrom),u32(validTo),u32(revealAfter),u32(probabilityPPM),u32(cap)],[meta(authority,true,true),meta(show),meta(claimWindowAddress(show,window),true),meta(SystemProgram.programId)]);
export const postClaimsRoot=(authority,show,window,root,count)=>instruction('post_claims_root',[u32(window),Buffer.from(root),u32(count)],[meta(authority,false,true),meta(show),meta(claimWindowAddress(show,window),true)]);
export const revealClaimWindow=(authority,show,window,secret)=>instruction('reveal_claim_window',[u32(window),Buffer.from(secret)],[meta(authority,false,true),meta(show),meta(claimWindowAddress(show,window),true)]);
export function completionAnchorInstructions(authority,show,policy,device,recordDigest,deviceSignature){
 const digest=Buffer.from(recordDigest),message=completionAnchorMessage(show,policy,device,digest);
 const bound=signatureInstruction(device.toBuffer().toString('hex'),Uint8Array.from(deviceSignature),message);
 const verify=new TransactionInstruction({programId:new PublicKey(bound.programId),keys:[],data:Buffer.from(bound.data)});
 const anchor=instruction('anchor_completion',[device.toBuffer(),digest],[meta(authority,true,true),meta(show),meta(completionAddress(show,device),true),meta(SYSVAR_INSTRUCTIONS_PUBKEY),meta(SystemProgram.programId)]);
 return [verify,anchor];
}
export async function settlementInstructions(payer,packet){
 const p=Uint8Array.from(packet),o=decodeOffer(p.subarray(0,240));
 const show=new PublicKey(Buffer.from(o.show,'hex')),a=new PublicKey(Buffer.from(o.a,'hex')),b=new PublicKey(Buffer.from(o.b,'hex')),nonce=Buffer.from(o.nonce,'hex');
 const signatures=(await swapSignatureInstructions(p)).map(i=>new TransactionInstruction({programId:new PublicKey(i.programId),keys:i.accounts,data:Buffer.from(i.data)}));
 const settle=instruction('settle_swap',[nonce],[meta(payer,true,true),meta(show),meta(tileAddress(show,Buffer.from(o.tileA,'hex')),true),meta(tileAddress(show,Buffer.from(o.tileB,'hex')),true),meta(ticketAddress(show,a),true),meta(ticketAddress(show,b),true),meta(pairAddress(show,a,b),true),meta(nonceAddress(show,nonce),true),meta(SYSVAR_INSTRUCTIONS_PUBKEY),meta(SystemProgram.programId)]);
 return [...signatures,settle];
}
export function transaction(payer,blockhash,instructions){return new Transaction({feePayer:payer,recentBlockhash:blockhash}).add(...instructions);}
export function serializedSize(tx){return tx.serialize({requireAllSignatures:false,verifySignatures:false}).length;}
export function readAccount(info,type){
 const lengths={Show:114,Ticket:83,Tile:109,Marker:44,ClaimWindow:239,Completion:141};
 if(!info || !info.owner.equals(PROGRAM_ID) || info.data.length!==lengths[type] || !info.data.subarray(0,8).equals(discriminator('account',type)))throw Error('BAD_ACCOUNT');
 const d=info.data;
 if(type==='Tile')return {show:new PublicKey(d.subarray(8,40)),id:d.subarray(40,72),owner:new PublicKey(d.subarray(72,104)),version:d.readUInt32LE(104)};
 if(type==='Ticket')return {show:new PublicKey(d.subarray(8,40)),owner:new PublicKey(d.subarray(40,72)),count:d.readUInt32LE(72),last:d.readUInt32LE(76),hasLast:!!d[80],frozen:!!d[81]};
 if(type==='Show')return {authority:new PublicKey(d.subarray(40,72)),policy:d.subarray(72,104),deadline:d.readUInt32LE(104),cap:d.readUInt32LE(108),paused:!!d[112]};
 if(type==='ClaimWindow')return {show:new PublicKey(d.subarray(8,40)),policy:d.subarray(40,72),checkpointKey:new PublicKey(d.subarray(72,104)),entropyCommitment:d.subarray(104,136),claimsRoot:d.subarray(136,168),revealedSecret:d.subarray(168,200),window:d.readUInt32LE(200),validFrom:d.readUInt32LE(204),validTo:d.readUInt32LE(208),revealAfter:d.readUInt32LE(212),probabilityPPM:d.readUInt32LE(216),cap:d.readUInt32LE(220),claimCount:d.readUInt32LE(224),rootPostedAt:d.readUInt32LE(228),revealedAt:d.readUInt32LE(232),rootPosted:!!d[236],revealed:!!d[237]};
 if(type==='Completion')return {show:new PublicKey(d.subarray(8,40)),policy:d.subarray(40,72),device:new PublicKey(d.subarray(72,104)),recordDigest:d.subarray(104,136),anchoredAt:d.readUInt32LE(136)};
 return {packetHash:d.subarray(8,40),settledAt:d.readUInt32LE(40)};
}
