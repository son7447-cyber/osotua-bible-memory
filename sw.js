const CACHE_NAME="osotua-v5-1";
const APP_SHELL=[
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/offline.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./offline.html",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  if(event.request.mode==="navigate"){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match("./index.html").then(r=>r||caches.match("./offline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      const networkFetch=fetch(event.request).then(response=>{
        if(response && (response.status===200 || response.type==="opaque")){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
        }
        return response;
      }).catch(()=>cached);
      return cached||networkFetch;
    })
  );
});
