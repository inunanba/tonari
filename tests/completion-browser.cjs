/** Requires serve-chain (localnet) or serve-devnet on 4173 with a fresh show. Real browser, real finality.
 * Fixture-only: the operator issues the remaining 21 tile accounts to client 0's bound device so the
 * participant-facing 24/24 completion path can be exercised. Never upgrades cNFT/non-transferability labels. */
const {chromium}=require(process.env.TONARI_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const base='http://127.0.0.1:4173';
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/tonari/config')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert(ready,'RELAY_NOT_READY');
 const config=await(await fetch(base+'/api/tonari/config')).json(),cluster=process.env.TONARI_BROWSER_CLUSTER||'localnet';assert.equal(config.cluster,cluster);
 const web3=require('@solana/web3.js'),chain=await import('../tools/chain-client.mjs'),{tileId}=await import('../tools/local-relay.mjs'),{verifyCompletion}=await import('../packages/protocol/completion.mjs');
 let payer;
 if(process.env.TONARI_FIXTURE_OPERATOR_FILE)payer=web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.TONARI_FIXTURE_OPERATOR_FILE,'utf8'))));
 else payer=web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(fs.readFileSync(process.env.TONARI_LOCAL_STATE_DIR+'/local.json','utf8')).payer,'hex'));
 assert.equal(Buffer.from(payer.publicKey.toBytes()).toString('hex'),config.issuer);
 const connection=new web3.Connection(process.env.TONARI_FIXTURE_RPC||process.env.TONARI_LOCAL_RPC||'http://127.0.0.1:18999','finalized');
 const opts={headless:true,args:['--no-sandbox']};if(process.env.TONARI_CHROME_PATH)opts.executablePath=process.env.TONARI_CHROME_PATH;else opts.channel='chrome';
 const browser=await chromium.launch(opts),errors=[],external=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('blob:'))external.push(r.url());});
  const ready=async()=>page.waitForFunction(()=>document.documentElement.dataset.chainReady==='true'&&document.documentElement.dataset.offlineReady==='true',null,{timeout:240000});
  await page.goto(base+'/apps/web/swap.html?client=0');await ready();
  const hiddenBefore=await page.locator('#completion-actions').isHidden(),countBefore=await page.locator('#ownership-count').innerText();
  assert.equal(hiddenBefore,true);assert.match(countBefore,/^3枚所有・3\/24枚発行$/);
  const owned=await page.locator('#ownership-board .tile.owned').evaluateAll(n=>n.map(x=>Number(x.dataset.tile)));assert.equal(owned.length,3);
  const state=(await(await fetch(base+'/api/tonari/state')).json()).value,deviceHex=state.tiles.find(t=>t.id===Buffer.alloc(32,owned[0]).toString('hex')).owner;
  const show=new web3.PublicKey(Buffer.from(config.show,'hex')),owner=new web3.PublicKey(Buffer.from(deviceHex,'hex')),issued=new Set(state.tiles.map(t=>parseInt(t.id.slice(0,2),16)));
  const remaining=Array.from({length:24},(_,i)=>i).filter(i=>!issued.has(i));assert.equal(remaining.length,21);const last=remaining.pop();
  const issue=async ids=>{const sigs=[];for(let s=0;s<ids.length;s+=5){const latest=await connection.getLatestBlockhash('finalized'),tx=chain.transaction(payer.publicKey,latest.blockhash,ids.slice(s,s+5).map(i=>chain.issueTile(payer.publicKey,show,owner,tileId(i))));sigs.push(await web3.sendAndConfirmTransaction(connection,tx,[payer],{commitment:'finalized'}));}return sigs;};
  const countIs=async text=>{await page.locator('#refresh').click();await page.waitForFunction(t=>document.querySelector('#ownership-count').textContent===t&&document.documentElement.dataset.actionState==='idle',text,{timeout:180000});};
  const fixtureSigs=await issue(remaining);
  await countIs('23枚所有・23/24枚発行');const hidden23=await page.locator('#completion-actions').isHidden();assert.equal(hidden23,true);
  const draft=async key=>page.evaluate(async key=>{const r=await fetch('/api/tonari/completion-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({publicKey:key})});return {status:r.status,body:(await r.text()).slice(0,160)};},key);
  const refused23=await draft(deviceHex);assert.notEqual(refused23.status,200);
  fixtureSigs.push(...await issue([last]));
  await countIs('24枚所有・24/24枚発行');assert.equal(await page.locator('#completion-actions').isVisible(),true);assert.equal(await page.locator('#completion-download').isHidden(),true);
  await page.locator('#create-completion').click();
  await page.locator('#completion-download').waitFor({state:'visible',timeout:180000});
  const status=await page.locator('#completion-status').innerText();assert.match(status,/cNFT・非譲渡性は未検証/);
  const linkText=await page.locator('#completion-transaction').innerText(),href=await page.locator('#completion-transaction a').getAttribute('href').catch(()=>null);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#completion-download').click()]);
  const fileName=download.suggestedFilename(),saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(fileName,'tonari-completion.json');
  const expected={show:config.show,policy:config.policy,authority:config.issuer},portable=await verifyCompletion(saved.record,expected);
  assert.equal(portable.recipient,deviceHex);assert.equal(portable.pieces,24);assert.equal(saved.anchor.recordDigest,portable.id);
  assert.equal(saved.anchor.onChainAnchor,'VERIFIED');assert.equal(saved.anchor.cNFT,'NOT_VERIFIED');assert.equal(saved.anchor.nonTransferability,'NOT_VERIFIED');
  const tx=await connection.getTransaction(saved.anchor.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});assert(tx&&tx.meta.err===null,'ANCHOR_TX_NOT_FINALIZED');
  const account=chain.readAccount(await connection.getAccountInfo(new web3.PublicKey(saved.anchor.address),'finalized'),'Completion');
  assert(account.show.equals(show));assert(account.device.equals(owner));assert.equal(Buffer.from(account.recordDigest).toString('hex'),portable.id);
  if(cluster==='devnet'){assert.equal(href,'https://explorer.solana.com/tx/'+saved.anchor.signature+'?cluster=devnet');}else{assert.equal(href,null);assert(linkText.includes(saved.anchor.signature));}
  const shot=process.env.TONARI_SHOT_DIR;if(shot)await page.screenshot({path:shot+'/completion-'+cluster+'.png',fullPage:true});
  // Reload: chain-backed 24/24 survives, action reappears, and repeating is idempotent (same finalized signature).
  await page.reload();await ready();await page.waitForFunction(()=>document.querySelector('#ownership-count').textContent==='24枚所有・24/24枚発行',null,{timeout:180000});
  assert.equal(await page.locator('#completion-actions').isVisible(),true);
  // Repeat after reload: a fresh draft has a new completedAt, so it can never overwrite the immutable PDA.
  // Record whether the UI can recover the original record (GAP if not); the PDA must stay unchanged either way.
  await page.locator('#create-completion').click();
  await page.waitForFunction(()=>!document.querySelector('#completion-download').hidden||document.querySelector('#status').textContent.startsWith('確認できませんでした'),null,{timeout:180000});
  let reloadRepeat;
  if(await page.locator('#completion-download').isVisible()){const [again]=await Promise.all([page.waitForEvent('download'),page.locator('#completion-download').click()]),savedAgain=JSON.parse(fs.readFileSync(await again.path(),'utf8'));reloadRepeat={recovered:savedAgain.anchor.recordDigest===saved.anchor.recordDigest,signature_same:savedAgain.anchor.signature===saved.anchor.signature};assert.equal(savedAgain.anchor.address,saved.anchor.address);}
  else reloadRepeat={recovered:false,error:await page.locator('#status').innerText()};
  const after=chain.readAccount(await connection.getAccountInfo(new web3.PublicKey(saved.anchor.address),'finalized'),'Completion');assert.equal(Buffer.from(after.recordDigest).toString('hex'),portable.id);
  if(!reloadRepeat.recovered)assert.match(reloadRepeat.error||'',/COMPLETION_ANCHOR_MISMATCH/);
  const body=await page.locator('body').innerText();assert(!/cNFT[^\n]{0,12}(VERIFIED|検証済)/.test(body.replace(/NOT_VERIFIED|未検証/g,'')),'CNFT_LABEL_UPGRADED');
  if(shot)await page.screenshot({path:shot+'/completion-'+cluster+'-reload.png',fullPage:true});
  if(shot)fs.writeFileSync(shot+'/completion-'+cluster+'.json',JSON.stringify(saved,null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({status:'COMPLETION_BROWSER_PASS',cluster,hidden_at_3:hiddenBefore,hidden_at_23:hidden23,draft_refused_at_23:refused23,visible_at_24:true,download:fileName,portableRecord:'VERIFIED',recordDigest:portable.id,signature:saved.anchor.signature,address:saved.anchor.address,explorer:href,link_text:linkText,reload_keeps_24_and_action:true,reload_repeat:reloadRepeat,pda_unchanged_after_repeat:true,cNFT:'NOT_VERIFIED',nonTransferability:'NOT_VERIFIED',fixture_issue_txs:fixtureSigs,page_errors:errors,external_requests:external.length},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
