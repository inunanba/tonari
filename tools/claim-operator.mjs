/** Local-operator claim window coordinator. Secrets never cross the API before reveal. */
import {randomBytes} from 'node:crypto';
import {buildClaimsBatch,verifyClaim,verifyClaimLog} from '../packages/protocol/claims.mjs';
import {dropFrameNonce,dropRevealCommitment,evaluateDrop,verifyDrop,verifyDropReveal} from '../packages/protocol/drop.mjs';

const clone=value=>structuredClone(value);
const uint=(value,name,max=0xffffffff)=>{if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('BAD_'+name);return value;};

export class ClaimOperator {
 #state=null;#tail=Promise.resolve();
 constructor({config,checkpointKey,signToken,clock,commitWindow,postRoot,revealWindow,random=()=>randomBytes(32)}){
  this.config=clone(config);this.checkpointKey=checkpointKey;this.signToken=signToken;this.clock=clock;this.commitWindow=commitWindow;this.postRoot=postRoot;this.revealWindow=revealWindow;this.random=random;
 }
 #serial(job){const result=this.#tail.then(job);this.#tail=result.catch(()=>{});return result;}
 status(){if(!this.#state)return {status:'IDLE',scope:{show:this.config.show,policy:this.config.policy},checkpointKey:this.checkpointKey};const {secret,issued,claims,...publicState}=this.#state;return clone({...publicState,issued:issued.size,claims:claims.size,...(publicState.revealed?{secret:secret.toString('hex')}:{})});}
 open({window,startsIn=2,duration=20,revealDelay=2,probabilityPPM,cap}){return this.#serial(async()=>{
  if(this.#state&&!this.#state.revealed)throw Error('WINDOW_ACTIVE');uint(window,'WINDOW');uint(startsIn,'START_DELAY',60);uint(duration,'DURATION',60);uint(revealDelay,'REVEAL_DELAY',60);uint(probabilityPPM,'PROBABILITY',1_000_000);uint(cap,'CAP',65_535);if(!duration||!cap)throw Error('BAD_WINDOW');
  const now=await this.clock(),validFrom=now+startsIn,validTo=validFrom+duration,revealAfter=validTo+revealDelay,secret=Buffer.from(this.random());if(secret.length!==32)throw Error('BAD_RANDOM');
  const entropyCommitment=await dropRevealCommitment(this.config.show,this.config.policy,window,secret.toString('hex'));
  await this.commitWindow({window,checkpointKey:this.checkpointKey,entropyCommitment,validFrom,validTo,revealAfter,probabilityPPM,cap});
  this.#state={status:'OPEN',window,checkpoint:window,validFrom,validTo,revealAfter,probabilityPPM,cap,entropyCommitment,root:null,count:0,posted:false,revealed:false,secret,issued:new Map(),claims:new Map()};return this.status();
 });}
 token({frame}){return this.#serial(async()=>{
  const s=this.#state;if(!s||s.posted)throw Error('WINDOW_NOT_OPEN');uint(frame,'FRAME');const now=await this.clock();if(now<s.validFrom||now>s.validTo)throw Error('WINDOW_NOT_LIVE');if(s.issued.has(frame))return clone(s.issued.get(frame));
  const nonce=await dropFrameNonce(this.config.show,this.config.policy,s.window,frame,s.secret.toString('hex'));
  const value={show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey,checkpoint:s.checkpoint,window:s.window,frame,validFrom:s.validFrom,validTo:s.validTo,probabilityPPM:s.probabilityPPM,cap:s.cap,nonce},envelope=await this.signToken(value);s.issued.set(frame,envelope);return clone(envelope);
 });}
 submit(record){return this.#serial(async()=>{
  const s=this.#state;if(!s||s.posted)throw Error('WINDOW_NOT_OPEN');if(s.claims.size>=s.cap)throw Error('CLAIM_CAP');const row=clone(record),value=row?.envelope?.value,token=row?.token;
  uint(row?.acceptedAt,'ACCEPTED_AT');if(!Array.isArray(row?.missing))throw Error('BAD_CLAIM_RECORD');if(value?.window!==s.window||value?.checkpoint!==s.checkpoint)throw Error('WRONG_WINDOW');
  const issued=s.issued.get(value.frame);if(!issued||JSON.stringify(issued)!==JSON.stringify(token))throw Error('TOKEN_NOT_ISSUED');
  await verifyDrop(token,{show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey},row.acceptedAt);await verifyDropReveal(token,s.secret.toString('hex'),s.entropyCommitment);
  const outcome=await evaluateDrop(token,{show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey},value.ticket,row.missing,row.acceptedAt);if(!outcome.eligible)throw Error('INELIGIBLE_CLAIM');
  const claim=await verifyClaim(row.envelope,{show:this.config.show,policy:this.config.policy});if(claim.value.tokenDigest!==outcome.digest||claim.value.boardDigest!==outcome.boardDigest||claim.value.tile!==outcome.tile)throw Error('CLAIM_OUTCOME_MISMATCH');
  if(s.claims.has(claim.id)||[...s.claims.values()].some(x=>x.value.tokenDigest===claim.value.tokenDigest))throw Error('CLAIM_REPLAY');
  const ticketLog=[...s.claims.values()].filter(x=>x.value.ticket===claim.value.ticket).map(x=>x.envelope);ticketLog.push(row.envelope);await verifyClaimLog(ticketLog,{show:this.config.show,policy:this.config.policy},claim.value.ticket);
  s.claims.set(claim.id,{id:claim.id,value:claim.value,envelope:row.envelope});return {accepted:true,id:claim.id,count:s.claims.size};
 });}
 publish(){return this.#serial(async()=>{
  const s=this.#state;if(!s||s.posted)throw Error('ROOT_ALREADY_POSTED');if(await this.clock()<s.validTo)throw Error('WINDOW_STILL_LIVE');const batch=await buildClaimsBatch([...s.claims.values()].map(x=>x.envelope),{show:this.config.show,policy:this.config.policy});await this.postRoot({window:s.window,root:batch.root,count:batch.count});s.root=batch.root;s.count=batch.count;s.posted=true;s.status='ROOT_POSTED';return this.status();
 });}
 reveal(){return this.#serial(async()=>{
  const s=this.#state;if(!s?.posted||s.revealed)throw Error('NOT_READY_TO_REVEAL');if(await this.clock()<s.revealAfter)throw Error('REVEAL_TOO_EARLY');await this.revealWindow({window:s.window,secret:Buffer.from(s.secret)});s.revealed=true;s.status='REVEALED';return this.status();
 });}
}
