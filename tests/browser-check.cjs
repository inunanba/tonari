const {chromium}=require(process.env.TONARI_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1360,height:1180}});
 const page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});
 await page.goto('http://127.0.0.1:4173/apps/web/index.html');
 await page.getByText('3つの独立した鍵で準備完了。秘密鍵は各端末の中にあります。').waitFor();
 const frames=page.frames().filter(f=>f.url().includes('phone.html'));
 assert.equal(frames.length,3);
 const keys=await Promise.all(frames.map(f=>f.locator('#key').innerText()));assert.equal(new Set(keys).size,3);
 // All assets already loaded. Disable HTTP network; postMessage transports only public signed bytes.
 await context.setOffline(true);
 await frames[0].locator('#offer').click();await frames[1].locator('#accept').waitFor({state:'visible'});
 await frames[1].locator('#accept').click();
 await frames[0].getByText('署名を確認しました。仮受け取り ✓').waitFor();
 assert.match(await frames[1].locator('#status').innerText(),/仮受け取り/);
 assert.equal(await frames[2].locator('.pending').count(),0);
 assert.equal(await frames[0].locator('.pending').count(),1);
 assert.equal(await frames[1].locator('.pending').count(),1);
 await page.screenshot({path:'docs/three-client-preview.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'docs/mobile-preview.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({status:'PASS',independent_clients:3,distinct_keys:3,offline_after_load:true,two_signatures_verified:true,unrelated_client_unchanged:true,external_requests:external.length,page_errors:errors,qr_scanning:false,persistence:false,chain_settlement:false}));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
