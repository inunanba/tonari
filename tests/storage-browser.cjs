const {chromium}=require(process.env.TONARI_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict');
(async()=>{
  const opts={headless:true,args:['--no-sandbox']};if(process.env.TONARI_CHROME_PATH)opts.executablePath=process.env.TONARI_CHROME_PATH;else opts.channel='chrome';
  const browser=await chromium.launch(opts);
  try {
    const context=await browser.newContext();const page=await context.newPage();
    // No phone iframe is loaded: these DB namespaces belong exclusively to this fixture.
    await page.goto('http://127.0.0.1:4173/apps/web/phone.css');
    const result=await page.evaluate(async()=>{
      const {DeviceStore}=await import('/packages/protocol/storage.mjs');
      const {createDevice,signOffer,acceptOffer}=await import('/packages/protocol/swap.mjs');
      const must=(b,message)=>{if(!b)throw new Error(message);};
      const rejected=async(job,reason)=>{try{await job();throw new Error('unexpected success');}catch(e){must(e.message.includes(reason),`expected ${reason}, got ${e.message}`);}};
      const [a,a2]=await Promise.all([DeviceStore.open('client-0'),DeviceStore.open('client-0')]);
      must(a.device.publicKey===a2.device.publicKey,'concurrent identity diverged');
      must(a.device.privateKey.extractable===false,'private key extractable');
      const b=await DeviceStore.open('client-1'),c=await createDevice();const show='11'.repeat(32);
      const make=async(nonce,recipient=b.device,at=100)=>{
        const offer={show,a:a.device.publicKey,b:recipient.publicKey,tileA:'01'.repeat(32),tileB:'02'.repeat(32),nonce:nonce.repeat(16),issuedAt:at,expiresAt:at+120};
        return acceptOffer(recipient,await signOffer(a.device,offer),{show,now:at});
      };
      const packet=await make('00');
      await a.saveIntent(show,{direction:'sent',fixture:true});
      // Abort at receipt insertion: intent and receipt must both retain pre-transaction state.
      const original=IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add=function(...args){if(this.name==='receipts'){this.transaction.abort();throw new Error('INJECTED_ABORT');}return original.apply(this,args);};
      try{await rejected(()=>a.receive(packet,{show,now:100}),'INJECTED_ABORT');}finally{IDBObjectStore.prototype.add=original;}
      must((await a.receipts(show)).length===0,'aborted receipt leaked');must((await a.intent(show)).fixture,'aborted intent erased');
      const concurrent=await Promise.allSettled([a.receive(packet,{show,now:100}),a2.receive(packet,{show,now:100})]);
      must(concurrent.filter(r=>r.status==='fulfilled').length===1,'duplicate committed');
      must(concurrent.find(r=>r.status==='rejected').reason.message==='REPLAY','wrong duplicate reason');
      must(await a.intent(show)===undefined,'intent not atomically cleared');
      const before=a.device.publicKey;a.close();a2.close();const reopened=await DeviceStore.open('client-0');
      must(reopened.device.publicKey===before,'key lost on reopen');must((await reopened.receipts(show)).length===1,'receipt lost on reopen');
      await rejected(()=>reopened.receive(packet,{show,now:100}),'REPLAY');
      const changed=await make('01',b.device,220);await rejected(()=>reopened.receive(changed,{show,now:220}),'PAIR_LIMIT');
      await rejected(async()=>reopened.receive(await make('02',c,219),{show,now:219}),'COOLDOWN');
      await reopened.receive(await make('02',c,220),{show,now:220});
      const foreign=await DeviceStore.open('client-2');await rejected(()=>foreign.receive(packet,{show,now:100}),'NOT_PARTICIPANT');
      must((await foreign.receipts(show)).length===0,'foreign packet persisted');
      await b.receive(packet,{show,now:100});must((await b.receipts(show)).length===1,'other party namespace blocked');
      // Quota/storage deletion/power-loss and global settlement are explicitly not measured here.
      reopened.close();b.close();foreign.close();
      return {status:'PASS',checks:['concurrent_identity_singleton','nonextractable_key','abort_atomicity','two_handle_replay_atomicity','intent_clear_atomicity','reopen_identity_receipt','replay_after_reopen','pair_limit_after_reopen','cooldown_boundary','nonparticipant_reject','independent_local_namespaces'],chain_settlement:false};
    });
    assert.equal(result.status,'PASS');console.log(JSON.stringify(result));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
