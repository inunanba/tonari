/** Requires serve-chain on 4173 and a real local validator; zero simulated finality. */
const {chromium}=require(process.env.TONARI_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{
 // A finalized local show takes several slots to create. Bounded readiness loop.
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch('http://127.0.0.1:4173/api/tonari/config')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert(ready,'LOCAL_RELAY_NOT_READY');
 const opts={headless:true,args:['--no-sandbox']};if(process.env.TONARI_CHROME_PATH)opts.executablePath=process.env.TONARI_CHROME_PATH;else opts.channel='chrome';const browser=await chromium.launch(opts);let pages=[];const network=[];
 try{
  const expectedCluster=process.env.TONARI_BROWSER_CLUSTER||'localnet';assert(['localnet','devnet'].includes(expectedCluster));
  const config=await(await fetch('http://127.0.0.1:4173/api/tonari/config')).json();assert.equal(config.cluster,expectedCluster);
  const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[],external=[];pages=await Promise.all([context.newPage(),context.newPage(),context.newPage()]);
  await context.addInitScript(()=>{const realNow=Date.now.bind(Date);Date.now=()=>realNow()+3600000;window.tonariNetworkEvents={online:0,offline:0};for(const kind of ['online','offline'])addEventListener(kind,()=>window.tonariNetworkEvents[kind]++);});
  for(const p of pages){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});}
  for(const [client,p] of pages.entries()){
   p.on('requestfailed',r=>{if(r.url().includes('/api/tonari/'))network.push({client,path:new URL(r.url()).pathname,event:'requestfailed',error:r.failure()?.errorText});});
   p.on('response',async r=>{if(r.url().includes('/api/tonari/')){const entry={client,path:new URL(r.url()).pathname,status:r.status()};if(!r.ok())try{entry.body=(await r.text()).slice(0,500);}catch{}network.push(entry);}});
  }
  await Promise.all(pages.map((p,i)=>p.goto('http://127.0.0.1:4173/apps/web/swap.html?client='+i)));
  for(const p of pages)await p.waitForFunction(()=>document.documentElement.dataset.chainReady==='true'&&document.documentElement.dataset.offlineReady==='true',null,{timeout:180000});
  const [a,b,c]=pages,keys=await Promise.all(pages.map(p=>p.locator('#key').innerText()));assert.equal(new Set(keys).size,3);
  const ownership=async p=>p.locator('#ownership').evaluate(section=>({hidden:section.hidden,count:section.querySelector('#ownership-count').textContent,cells:section.querySelectorAll('.tile').length,issued:[...section.querySelectorAll('.tile:not(.unissued)')].map(node=>Number(node.dataset.tile)),owned:[...section.querySelectorAll('.tile.owned')].map(node=>Number(node.dataset.tile)),versions:[...section.querySelectorAll('.tile:not(.unissued)')].map(node=>Number(node.dataset.version))}));
  const initialBoards=await Promise.all(pages.map(ownership));for(const board of initialBoards){assert.equal(board.hidden,false);assert.equal(board.count,'3枚所有・9/24枚発行');assert.equal(board.cells,24);assert.deepEqual(board.issued,[0,1,2,8,9,10,16,17,18]);assert.deepEqual(board.versions,Array(9).fill(0));}assert.deepEqual(initialBoards.map(board=>board.owned),[[0,8,16],[1,9,17],[2,10,18]]);
  for(const p of pages){await p.locator('#refresh').click();await p.waitForFunction(()=>document.documentElement.dataset.actionState==='idle'&&document.querySelector('#want').options.length===6);}
  const png=async p=>Buffer.from((await p.locator('#qr').evaluate(c=>c.toDataURL('image/png'))).split(',')[1],'base64'),upload=async(p,bytes)=>p.locator('#image').setInputFiles({name:'tonari-v2.png',mimeType:'image/png',buffer:bytes});
  // Hold a completed third-device state response so QR upload races with busy refresh deterministically.
  await c.evaluate(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0]).endsWith('/state')&&!window.tonariStateHeld){window.tonariStateHeld=true;await new Promise(resolve=>window.tonariReleaseState=resolve);}return response;};});
  await c.locator('#refresh').click();await c.waitForFunction(()=>window.tonariStateHeld===true);
  await a.locator('#want').selectOption('01'.repeat(32));await context.setOffline(true);
  await upload(a,await png(b));await a.getByText('② 相手の確認を待つ').waitFor();const offer=await png(a);await upload(c,offer);await c.waitForFunction(()=>document.documentElement.dataset.actionCount==='2');await c.evaluate(()=>window.tonariReleaseState());await c.getByText('この端末宛ての交換ではありません。',{exact:false}).waitFor();
  await upload(b,offer);await b.locator('#review').waitFor({state:'visible'});assert.match(await b.locator('#terms').innerText(),/所有権 0/);
  await Promise.all([a.reload(),b.reload()]);await b.locator('#review').waitFor({state:'visible'});await a.getByText('② 保存した交換を続ける').waitFor();
  await b.locator('#confirm').click();await b.getByText('③ 仮受け取りを保存しました ✓').waitFor();await upload(a,await png(b));await a.getByText('③ 仮受け取りを保存しました ✓').waitFor();
  await a.locator('#settle').click();await a.getByText('仮受け取りは保存されています。',{exact:false}).waitFor();assert.equal(await a.locator('html').getAttribute('data-swap-state'),'provisional');
  await Promise.all([a.reload(),b.reload()]);for(const p of [a,b])await p.getByText('③ 仮受け取りを保存しました ✓').waitFor();
  // Suppress the online notification deliberately. The restored pending record must
  // independently retry and settle on a visible page, using the exact same packet.
  for(const p of [a,b])await p.evaluate(()=>addEventListener('online',e=>e.stopImmediatePropagation(),{capture:true}));
  await context.setOffline(false);for(const p of [a,b]){await p.bringToFront();await p.getByText('④ 交換が確定しました ✓').waitFor({timeout:180000});assert.equal(await p.locator('#settle').isHidden(),true);}
  await a.waitForFunction(()=>document.querySelector('[data-tile="1"]')?.classList.contains('owned')&&!document.querySelector('[data-tile="0"]')?.classList.contains('owned')&&document.querySelector('[data-tile="0"]')?.dataset.version==='1'&&document.querySelector('[data-tile="1"]')?.dataset.version==='1');
  await b.waitForFunction(()=>document.querySelector('[data-tile="0"]')?.classList.contains('owned')&&!document.querySelector('[data-tile="1"]')?.classList.contains('owned')&&document.querySelector('[data-tile="0"]')?.dataset.version==='1'&&document.querySelector('[data-tile="1"]')?.dataset.version==='1');
  const txs=await Promise.all([a,b].map(p=>p.locator('#transaction').innerText()));assert.equal(txs[0],txs[1]);if(expectedCluster==='devnet'){for(const p of [a,b]){const href=await p.locator('#transaction a').getAttribute('href');assert.match(href,/^https:\/\/explorer.solana.com\/tx\/[1-9A-HJ-NP-Za-km-z]+\?cluster=devnet$/);assert.match(await p.locator('#chain-status').innerText(),/Devnet/);assert.match(await p.locator('#connection-notice').innerText(),/Solana Devnet/);assert.doesNotMatch(await p.locator('body').innerText(),/公開Devnetの確定はまだ利用できません/);}}
  if(process.env.TONARI_TEST_RECEIPT_FILE){const record=await a.evaluate(async()=>{const {DeviceStore}=await import('/packages/protocol/storage.mjs');const root=await DeviceStore.open('phone-0'),config=await root.exchange.config(),row=(await root.exchange.receipts(config))[0];root.close();return {config,id:row.id,packet:row.packet,settlement:row.settlement};});const {writeFile}=require('node:fs/promises');await writeFile(process.env.TONARI_TEST_RECEIPT_FILE,JSON.stringify(record),{mode:0o600});}
  await context.setOffline(true);await Promise.all([a.reload(),b.reload()]);for(const p of [a,b])await p.getByText('④ 交換が確定しました ✓').waitFor();assert.deepEqual(await Promise.all(pages.map(p=>p.locator('#key').innerText())),keys);
  const counts=await Promise.all(pages.map((p,i)=>p.evaluate(async i=>{const {DeviceStore}=await import('/packages/protocol/storage.mjs');const root=await DeviceStore.open('phone-'+i),s=root.exchange,config=await s.config(),rows=await s.receipts(config);root.close();return rows.length;},i)));assert.deepEqual(counts,[1,1,0]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await a.screenshot({path:'docs/v2-local-confirmed.png',fullPage:true,animations:'disabled',timeout:120000});
  console.log(JSON.stringify({status:'PASS',v2_qr:true,verified_ownership_board_24:true,board_refresh_after_finality:true,offline_signed_exchange:true,pending_reload:true,offline_retry_preserves_provisional:true,online_event_suppressed:true,device_clock_one_hour_fast:true,real_finalized:true,real_local_finalized:expectedCluster==='localnet',same_transaction_for_both_devices:true,confirmed_offline_reload:true,third_device_unchanged:true,qr_during_held_refresh_processed:true,page_errors:errors,external_requests:external.length,network:network.slice(-80),cluster:expectedCluster,devnet:expectedCluster==='devnet'}));
 }catch(error){
  const states=await Promise.all(pages.map(async(p,client)=>{try{return await p.evaluate(client=>({client,online:navigator.onLine,hidden:document.hidden,phase:document.querySelector('#phase')?.textContent,status:document.querySelector('#status')?.textContent,chainStatus:document.querySelector('#chain-status')?.textContent,settleDisabled:document.querySelector('#settle')?.disabled,swapState:document.documentElement.dataset.swapState,events:window.tonariNetworkEvents,actionState:document.documentElement.dataset.actionState,actionCount:document.documentElement.dataset.actionCount}),client);}catch(e){return {client,error:e.message};}}));
  console.error(JSON.stringify({status:'FAIL_DIAGNOSTIC',error:error.message,states,network:network.slice(-80)}));
  for(const [i,p] of pages.entries())try{await p.screenshot({path:`docs/v2-chain-failure-client-${i}.png`,fullPage:true,animations:'disabled',timeout:15000});}catch{}
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
