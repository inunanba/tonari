/** Local-operator claim window coordinator. Secrets never cross the API before reveal. */
import {randomBytes} from 'node:crypto';
import {buildClaimsBatch,verifyClaim,verifyClaimLog} from '../packages/protocol/claims.mjs';
import {dropFrameNonce,dropRevealCommitment,evaluateDrop,verifyDrop,verifyDropReveal} from '../packages/protocol/drop.mjs';
import {fromHex} from '../packages/protocol/swap.mjs';

const clone=value=>structuredClone(value);
const uint=(value,name,max=0xffffffff)=>{if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('BAD_'+name);return value;};

export class ClaimOperator {
 #state=null;#tail=Promise.resolve();
 constructor({config,checkpointKey,signToken,clock,finalityClock=clock,commitWindow,postRoot,revealWindow,persistState=async()=>{},loadWindow=null,random=()=>randomBytes(32),minimumStartDelay=0}){
  this.config=clone(config);this.checkpointKey=checkpointKey;this.signToken=signToken;this.clock=clock;this.finalityClock=finalityClock;this.commitWindow=commitWindow;this.postRoot=postRoot;this.revealWindow=revealWindow;this.random=random;this.minimumStartDelay=uint(minimumStartDelay,'MINIMUM_START_DELAY',60);
  this.persistState=persistState;this.loadWindow=loadWindow;
 }
 #serial(job){const result=this.#tail.then(job);this.#tail=result.catch(()=>{});return result;}
 #snapshot(){if(!this.#state)return null;const s=this.#state;return {version:1,show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey,status:s.status,window:s.window,checkpoint:s.checkpoint,validFrom:s.validFrom,validTo:s.validTo,revealAfter:s.revealAfter,probabilityPPM:s.probabilityPPM,cap:s.cap,entropyCommitment:s.entropyCommitment,root:s.root,count:s.count,posted:s.posted,revealed:s.revealed,secret:s.secret.toString('hex'),issued:[...s.issued],claims:[...s.claims]};}
 async #save(){await this.persistState(this.#snapshot());}
 async restore(snapshot){if(snapshot===null)return;const x=clone(snapshot),keys=['version','show','policy','checkpointKey','status','window','checkpoint','validFrom','validTo','revealAfter','probabilityPPM','cap','entropyCommitment','root','count','posted','revealed','secret','issued','claims'];if(!x||Object.keys(x).sort().join()!==keys.sort().join()||x.version!==1||x.show!==this.config.show||x.policy!==this.config.policy||x.checkpointKey!==this.checkpointKey)throw Error('BAD_CLAIM_OPERATOR_STATE');
  for(const [n,v,max] of [['window',x.window],['checkpoint',x.checkpoint],['validFrom',x.validFrom],['validTo',x.validTo],['revealAfter',x.revealAfter],['probabilityPPM',x.probabilityPPM,1_000_000],['cap',x.cap,65_535],['count',x.count,65_535]])uint(v,n.toUpperCase(),max);fromHex(x.entropyCommitment,32);fromHex(x.secret,32);if(x.root!==null)fromHex(x.root,32);if(!['COMMITTING','OPEN','ROOT_POSTING','ROOT_POSTED','REVEALING','REVEALED'].includes(x.status)||typeof x.posted!=='boolean'||typeof x.revealed!=='boolean'||!Array.isArray(x.issued)||!Array.isArray(x.claims))throw Error('BAD_CLAIM_OPERATOR_STATE');
  if(await dropRevealCommitment(this.config.show,this.config.policy,x.window,x.secret)!==x.entropyCommitment)throw Error('BAD_CLAIM_OPERATOR_STATE');const issued=new Map(x.issued),claims=new Map(x.claims);if(issued.size!==x.issued.length||claims.size!==x.claims.length||issued.size>0xffffffff||claims.size>x.cap)throw Error('BAD_CLAIM_OPERATOR_STATE');const rooted=['ROOT_POSTING','ROOT_POSTED','REVEALING','REVEALED'].includes(x.status),posted=['ROOT_POSTED','REVEALING','REVEALED'].includes(x.status),revealed=x.status==='REVEALED';if(x.posted!==posted||x.revealed!==revealed||rooted!==(x.root!==null)||(!rooted&&x.count!==0)||(rooted&&x.count!==claims.size))throw Error('BAD_CLAIM_OPERATOR_STATE');
  for(const [frame,token] of issued){uint(frame,'FRAME');if(token?.value?.frame!==frame||token.value.window!==x.window)throw Error('BAD_CLAIM_OPERATOR_STATE');await verifyDrop(token,{show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey},x.validFrom);await verifyDropReveal(token,x.secret,x.entropyCommitment);}
  const byTicket=new Map();for(const [id,row] of claims){if(id!==row?.id||row?.value?.window!==x.window||!Array.isArray(row.missing))throw Error('BAD_CLAIM_OPERATOR_STATE');uint(row.acceptedAt,'ACCEPTED_AT');const claim=await verifyClaim(row.envelope,{show:this.config.show,policy:this.config.policy});if(claim.id!==id||JSON.stringify(issued.get(claim.value.frame))!==JSON.stringify(row.token))throw Error('BAD_CLAIM_OPERATOR_STATE');const outcome=await evaluateDrop(row.token,{show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey},claim.value.ticket,row.missing,row.acceptedAt);if(!outcome.eligible||outcome.digest!==claim.value.tokenDigest||outcome.boardDigest!==claim.value.boardDigest||outcome.tile!==claim.value.tile)throw Error('BAD_CLAIM_OPERATOR_STATE');if(!byTicket.has(claim.value.ticket))byTicket.set(claim.value.ticket,[]);byTicket.get(claim.value.ticket).push(row.envelope);}for(const [ticket,rows] of byTicket)await verifyClaimLog(rows.sort((a,b)=>a.value.sequence-b.value.sequence),{show:this.config.show,policy:this.config.policy},ticket);
  this.#state={...x,secret:Buffer.from(x.secret,'hex'),issued,claims};await this.#recover();
 }
 async #recover(){const s=this.#state;if(!s)return;const immutable={window:s.window,checkpointKey:this.checkpointKey,entropyCommitment:s.entropyCommitment,validFrom:s.validFrom,validTo:s.validTo,revealAfter:s.revealAfter,probabilityPPM:s.probabilityPPM,cap:s.cap},recovering=['COMMITTING','ROOT_POSTING','REVEALING'].includes(s.status);if(recovering&&!this.loadWindow)throw Error('CLAIM_RECOVERY_READER_REQUIRED');const chain=this.loadWindow?await this.loadWindow(s.window):null;
  if(chain&&!['window','checkpointKey','entropyCommitment','validFrom','validTo','revealAfter','probabilityPPM','cap'].every(k=>chain[k]===immutable[k]))throw Error('CLAIM_WINDOW_CHANGED');if(this.loadWindow&&!chain&&!recovering)throw Error('CLAIM_WINDOW_MISSING');if(chain&&s.posted&&(!chain.rootPosted||chain.root!==s.root||chain.count!==s.count))throw Error('CLAIM_ROOT_CHANGED');if(chain&&s.revealed&&!chain.revealed)throw Error('CLAIM_REVEAL_MISSING');
  if(s.status==='COMMITTING'){if(!chain)await this.commitWindow(immutable);s.status='OPEN';await this.#save();}
  if(s.status==='ROOT_POSTING'){if(chain?.rootPosted&&(chain.root!==s.root||chain.count!==s.count))throw Error('CLAIM_ROOT_CHANGED');if(!chain?.rootPosted)await this.postRoot({window:s.window,root:s.root,count:s.count});s.posted=true;s.status='ROOT_POSTED';await this.#save();}
  if(s.status==='REVEALING'){if(chain?.rootPosted&&(chain.root!==s.root||chain.count!==s.count))throw Error('CLAIM_ROOT_CHANGED');if(!chain?.revealed)await this.revealWindow({window:s.window,secret:Buffer.from(s.secret)});s.revealed=true;s.status='REVEALED';await this.#save();}
 }
 status(){if(!this.#state)return {status:'IDLE',scope:{show:this.config.show,policy:this.config.policy},checkpointKey:this.checkpointKey};const {secret,issued,claims,...publicState}=this.#state;return clone({...publicState,issued:issued.size,claims:claims.size,...(publicState.revealed?{secret:secret.toString('hex')}:{})});}
 open({window,startsIn=2,duration=20,revealDelay=2,probabilityPPM,cap}){return this.#serial(async()=>{
  if(this.#state&&!this.#state.revealed)throw Error('WINDOW_ACTIVE');uint(window,'WINDOW');uint(startsIn,'START_DELAY',60);uint(duration,'DURATION',60);uint(revealDelay,'REVEAL_DELAY',60);uint(probabilityPPM,'PROBABILITY',1_000_000);uint(cap,'CAP',65_535);if(!duration||!cap)throw Error('BAD_WINDOW');
  const now=await this.clock(),finalizedNow=await this.finalityClock(),finalityLag=Math.max(0,now-finalizedNow),validFrom=now+Math.max(startsIn,this.minimumStartDelay+finalityLag),validTo=validFrom+duration,revealAfter=validTo+revealDelay,secret=Buffer.from(this.random());if(secret.length!==32)throw Error('BAD_RANDOM');
  const entropyCommitment=await dropRevealCommitment(this.config.show,this.config.policy,window,secret.toString('hex'));
  this.#state={status:'COMMITTING',window,checkpoint:window,validFrom,validTo,revealAfter,probabilityPPM,cap,entropyCommitment,root:null,count:0,posted:false,revealed:false,secret,issued:new Map(),claims:new Map()};await this.#save();
  await this.commitWindow({window,checkpointKey:this.checkpointKey,entropyCommitment,validFrom,validTo,revealAfter,probabilityPPM,cap});this.#state.status='OPEN';await this.#save();return this.status();
 });}
 token({frame}){return this.#serial(async()=>{
  const s=this.#state;if(!s||s.status!=='OPEN')throw Error('WINDOW_NOT_OPEN');uint(frame,'FRAME');const now=await this.clock();if(now<s.validFrom||now>s.validTo)throw Error('WINDOW_NOT_LIVE');if(s.issued.has(frame))return clone(s.issued.get(frame));
  const nonce=await dropFrameNonce(this.config.show,this.config.policy,s.window,frame,s.secret.toString('hex'));
  const value={show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey,checkpoint:s.checkpoint,window:s.window,frame,validFrom:s.validFrom,validTo:s.validTo,probabilityPPM:s.probabilityPPM,cap:s.cap,nonce},envelope=await this.signToken(value);s.issued.set(frame,envelope);try{await this.#save();}catch(e){s.issued.delete(frame);throw e;}return clone(envelope);
 });}
 submit(record){return this.#serial(async()=>{
  const s=this.#state;if(!s||s.status!=='OPEN')throw Error('WINDOW_NOT_OPEN');if(s.claims.size>=s.cap)throw Error('CLAIM_CAP');const row=clone(record),value=row?.envelope?.value,token=row?.token;
  uint(row?.acceptedAt,'ACCEPTED_AT');if(!Array.isArray(row?.missing))throw Error('BAD_CLAIM_RECORD');if(value?.window!==s.window||value?.checkpoint!==s.checkpoint)throw Error('WRONG_WINDOW');
  const issued=s.issued.get(value.frame);if(!issued||JSON.stringify(issued)!==JSON.stringify(token))throw Error('TOKEN_NOT_ISSUED');
  await verifyDrop(token,{show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey},row.acceptedAt);await verifyDropReveal(token,s.secret.toString('hex'),s.entropyCommitment);
  const outcome=await evaluateDrop(token,{show:this.config.show,policy:this.config.policy,checkpointKey:this.checkpointKey},value.ticket,row.missing,row.acceptedAt);if(!outcome.eligible)throw Error('INELIGIBLE_CLAIM');
  const claim=await verifyClaim(row.envelope,{show:this.config.show,policy:this.config.policy});if(claim.value.tokenDigest!==outcome.digest||claim.value.boardDigest!==outcome.boardDigest||claim.value.tile!==outcome.tile)throw Error('CLAIM_OUTCOME_MISMATCH');
  if(s.claims.has(claim.id)||[...s.claims.values()].some(x=>x.value.tokenDigest===claim.value.tokenDigest))throw Error('CLAIM_REPLAY');
  const ticketLog=[...s.claims.values()].filter(x=>x.value.ticket===claim.value.ticket).map(x=>x.envelope);ticketLog.push(row.envelope);await verifyClaimLog(ticketLog,{show:this.config.show,policy:this.config.policy},claim.value.ticket);
  s.claims.set(claim.id,{id:claim.id,value:claim.value,envelope:row.envelope,token:row.token,missing:row.missing,acceptedAt:row.acceptedAt});try{await this.#save();}catch(e){s.claims.delete(claim.id);throw e;}return {accepted:true,id:claim.id,count:s.claims.size};
 });}
 publish(){return this.#serial(async()=>{
  const s=this.#state;if(!s||s.status!=='OPEN')throw Error('ROOT_ALREADY_POSTED');if(await this.finalityClock()<s.validTo)throw Error('WINDOW_STILL_LIVE');const batch=await buildClaimsBatch([...s.claims.values()].map(x=>x.envelope),{show:this.config.show,policy:this.config.policy});s.root=batch.root;s.count=batch.count;s.status='ROOT_POSTING';await this.#save();await this.postRoot({window:s.window,root:batch.root,count:batch.count});s.posted=true;s.status='ROOT_POSTED';await this.#save();return this.status();
 });}
 reveal(){return this.#serial(async()=>{
  const s=this.#state;if(!s||s.status!=='ROOT_POSTED')throw Error('NOT_READY_TO_REVEAL');if(await this.finalityClock()<s.revealAfter)throw Error('REVEAL_TOO_EARLY');s.status='REVEALING';await this.#save();await this.revealWindow({window:s.window,secret:Buffer.from(s.secret)});s.revealed=true;s.status='REVEALED';await this.#save();return this.status();
 });}
}
