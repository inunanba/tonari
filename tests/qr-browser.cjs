const {chromium}=require(process.env.TONARI_PLAYWRIGHT||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const opts={headless:true,args:['--no-sandbox']};if(process.env.TONARI_CHROME_PATH)opts.executablePath=process.env.TONARI_CHROME_PATH;else opts.channel='chrome';
 const browser=await chromium.launch(opts);
 try {
   const context=await browser.newContext({viewport:{width:390,height:844}}),pages=await Promise.all([context.newPage(),context.newPage(),context.newPage()]);const errors=[],external=[];
   for(const p of pages){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});}
   await Promise.all(pages.map((p,i)=>p.goto('http://127.0.0.1:4173/apps/web/exchange.html?client='+i)));
   for(const p of pages)await p.waitForFunction(()=>document.documentElement.dataset.offlineReady==='true'&&!document.querySelector('#scan').disabled);
   const [a,b,c]=pages,keys=await Promise.all(pages.map(p=>p.locator('#key').innerText()));assert.equal(new Set(keys).size,3);
   const png=async p=>Buffer.from((await p.locator('#qr').evaluate(canvas=>canvas.toDataURL('image/png'))).split(',')[1],'base64');
   const upload=async(p,bytes)=>p.locator('#image').setInputFiles({name:'tonari.png',mimeType:'image/png',buffer:bytes});
   // Camera permission denied must leave the file-image route usable; no real camera claimed.
   await a.locator('#scan').click();await a.getByText('確認できませんでした：',{exact:false}).waitFor();
   await context.setOffline(true);
   await upload(a,await png(b));await a.getByText('② 相手の確認を待つ').waitFor();
   const offer=await png(a);await upload(c,offer);await c.getByText('この端末宛ての交換ではありません。',{exact:false}).waitFor();
   await upload(b,offer);await b.locator('#review').waitFor({state:'visible'});assert.match(await b.locator('#terms').innerText(),/あなたのピース 2.*相手のピース 1/);
   // Both sides can reopen after an offer but before explicit recipient consent.
   await Promise.all([a.reload(),b.reload()]);await b.locator('#review').waitFor({state:'visible'});await a.getByText('② 保存した交換を続ける').waitFor();
   await b.locator('#confirm').click();await b.getByText('③ 仮受け取りを保存しました ✓').waitFor();
   await upload(a,await png(b));await a.getByText('③ 仮受け取りを保存しました ✓').waitFor();
   await Promise.all([a.reload(),b.reload()]);for(const p of [a,b])await p.getByText('③ 仮受け取りを保存しました ✓').waitFor();
   assert.deepEqual(await Promise.all(pages.map(p=>p.locator('#key').innerText())),keys);assert.equal(await c.locator('#phase').innerText(),'① 相手のQRを読む');
   // Actual same-origin DB state: each participant one receipt, third device zero.
   const receiptCounts=await Promise.all(pages.map((p,i)=>p.evaluate(async id=>{const {DeviceStore}=await import('/packages/protocol/storage.mjs');const s=await DeviceStore.open('phone-'+id);const rows=await s.receipts('22'.repeat(32));s.close();return rows.length;},i)));assert.deepEqual(receiptCounts,[1,1,0]);
   await a.screenshot({path:'docs/qr-mobile-preview.png',fullPage:true,animations:'disabled',timeout:120000});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   console.log(JSON.stringify({status:'PASS',image_qr_roundtrip:true,independent_keys:3,offline_exchange:true,pending_reload:true,completed_reload:true,third_device_unchanged:true,camera_denied_file_fallback:true,external_requests:0,page_errors:[],real_camera:false,physical_phones:false,chain_settlement:false}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
