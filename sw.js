const CACHE_NAME="command-v36-money-simplified-final";
const FILES=["./","./index.html","./styles.css","./app.js","./money-planning.js","./money-bills-ui.js","./money-classification.js","./money-bank-import.js","./money-bank-review.js","./money-csv-model.js","./money-import-ui.js","./money-insights-model.js","./money-insights-ui.js","./money-paychecks.js","./money-paychecks-ui.js","./money-simple-ui.js","./money.js","./money-sync-model.js","./money-sync.js","./cloud.js","./firebase-config.js","./timekeeping.js","./schedule.js","./schedule.css","./schedule-import.js","./icons.svg","./icon.svg","./apple-touch-icon-v9.png","./manifest.webmanifest"];
self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.addAll(FILES.map((p)=>new URL(p,self.registration.scope).toString()))).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",(event)=>{
  event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",(event)=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin || !url.href.startsWith(self.registration.scope))return;
  event.respondWith(fetch(event.request).then((response)=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request).then(match=>match||((event.request.mode==="navigate")?caches.match(new URL("./index.html",self.registration.scope).toString()):Response.error()))));
});