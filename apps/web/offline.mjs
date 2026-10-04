export async function prepareOffline() {
  if(!('serviceWorker' in navigator))throw new Error('OFFLINE_UNAVAILABLE');
  await navigator.serviceWorker.register('./sw.mjs',{type:'module',scope:'./'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
}
