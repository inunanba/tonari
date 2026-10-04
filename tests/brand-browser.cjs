// Host browser verification. Run after all existing gates; no state/chain claims inferred from styling.
const {chromium}=require(process.env.TONARI_PLAYWRIGHT||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.TONARI_CHROME_PATH?{executablePath:process.env.TONARI_CHROME_PATH}:{channel:'chrome'})});
 try{const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await ctx.newPage();const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});
 for(const route of ['index','exchange','operations']){
  await ctx.setOffline(false);await page.goto('http://127.0.0.1:4173/apps/web/'+route+'.html');await page.waitForFunction(()=>document.documentElement.dataset.offlineReady==='true'&&document.querySelector('tonari-guide svg'));
  await page.screenshot({path:'docs/kawaii-'+route+'-after.png',fullPage:true,animations:'disabled',timeout:120000});
  await ctx.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('tonari-guide svg'));assert.match(await page.locator('tonari-guide').innerText(),/もも ＆ るる/);
  assert.equal(await page.locator('tonari-guide').evaluate(el=>getComputedStyle(el).color),'rgb(73, 52, 71)');
  if(route==='exchange'){
   await page.locator('summary').click();assert.equal(await page.locator('details').evaluate(el=>el.open),true);
   await page.screenshot({path:'docs/kawaii-onboarding-after.png',fullPage:true,animations:'disabled',timeout:120000});
   // Preview component states only. Actual swap reaction is checked by qr-browser below.
   for(const state of ['swap','rare','complete']){await page.locator('tonari-guide').evaluate((el,s)=>el.setAttribute('state',s),state);assert.equal(await page.locator('tonari-guide').getAttribute('data-guide-state'),state);await page.screenshot({path:'docs/kawaii-'+state+'-component.png',fullPage:true,animations:'disabled',timeout:120000});}
   const duration=await page.locator('button').first().evaluate(el=>getComputedStyle(el).transitionDuration);assert.equal(duration,'0s');
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({status:'PASS',offline_brand_pages:3,onboarding:true,guide_component_states:5,real_completion:false,reduced_motion:true,external_requests:0,page_errors:[]}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
