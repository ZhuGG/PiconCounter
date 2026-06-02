const CACHE_NAME = "picon-counter-v11";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "visual-tuning.css",
  "app.js",
  "manifest.webmanifest",
  "icon.svg",
  "manual-tests.js",
  "assets/brand/icon-1024.png",
  "assets/brand/art-nouveau-bg.png",
  "assets/brand/logo-horizontal.svg",
  "assets/brand/og-image.svg",
  "assets/illustrations/empty-today.svg",
  "assets/illustrations/threshold-reached.svg",
  "assets/icons/context-tags.svg",
  "assets/patterns/art-nouveau-bg.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const request = event.request;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("index.html"));
    })
  );
});
