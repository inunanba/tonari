const VERSION='tonari-shell-v0.8.1';
const assets=['../../packages/protocol/wire-v2.mjs','../../packages/protocol/swap-v2.mjs','./kawaii.css','./mascots.mjs','./index.html','./phone.html','./exchange.html','./operations.html','./style.css','./phone.css','./exchange.css','./operations.css','./stage.mjs','./phone.mjs','./exchange.mjs','./camera.mjs','./operations.mjs','./offline.mjs','../../packages/protocol/swap.mjs','../../packages/protocol/ledger.mjs','../../packages/protocol/storage.mjs','../../packages/protocol/wire.mjs','../../packages/protocol/qr.mjs','../../packages/protocol/allocator.mjs','../../vendor/qrcodegen.mjs','../../vendor/jsqr.mjs'];
assets.push('./action-queue.mjs','../../packages/protocol/observed-clock.mjs','../../packages/protocol/ownership-view.mjs','../../packages/protocol/rally.mjs','../../packages/protocol/rally-session.mjs','../../packages/games/queue-line.mjs','../../packages/games/call-response.mjs','./queue-line.html','./queue-line.css','./queue-line-ui.mjs','./call-response.html','./call-response.css','./call-response-ui.mjs','./swap.html','./swap-ui.mjs','./claim.html','./claim.css','./claim-ui.mjs','./claim-flow.mjs','./chain-api.mjs','./settlement-retry.mjs','../../packages/protocol/storage-v2.mjs','../../packages/protocol/attestation.mjs','../../packages/protocol/claim-store.mjs','../../packages/protocol/drop.mjs','../../packages/protocol/claims.mjs');
const urls=assets.map(p=>new URL(p,self.location.href).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);await cache.addAll(urls);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // Only this application's cache namespace is managed here.
  for(const name of await caches.keys())if(name.startsWith('tonari-shell-')&&name!==VERSION)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);if(u.origin!==self.location.origin)return;
  // Only the phone route has a permitted query parameter; never cache arbitrary URLs.
  if(['phone.html','exchange.html','swap.html','claim.html'].some(p=>u.pathname===new URL('./'+p,self.location.href).pathname)&&u.search) {
    if([...u.searchParams.keys()].some(k=>k!=='client')||!['0','1','2'].includes(u.searchParams.get('client')))return;
    u.search='';
  }
  if(!urls.includes(u.href))return;
  event.respondWith((async()=>{
    const cached=await (await caches.open(VERSION)).match(u.href);
    return cached||fetch(event.request);
  })());
});
