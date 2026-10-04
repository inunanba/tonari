const VERSION='tonari-shell-v0.2.0';
const assets=['./index.html','./phone.html','./style.css','./phone.css','./stage.mjs','./phone.mjs','./offline.mjs','../../packages/protocol/swap.mjs','../../packages/protocol/ledger.mjs','../../packages/protocol/storage.mjs'];
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
  if(u.pathname===new URL('./phone.html',self.location.href).pathname) {
    if([...u.searchParams.keys()].some(k=>k!=='client')||!['0','1','2'].includes(u.searchParams.get('client')))return;
    u.search='';
  }
  if(!urls.includes(u.href))return;
  event.respondWith((async()=>{
    const cached=await (await caches.open(VERSION)).match(u.href);
    return cached||fetch(event.request);
  })());
});
