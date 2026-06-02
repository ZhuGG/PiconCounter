const CACHE_NAME = "picon-counter-v8";
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
  "assets/illustrations/discreet-mode.svg",
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

function injectVisualTuning(html) {
  if (html.includes("visual-tuning.css")) return html;
  return html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    '<link rel="stylesheet" href="styles.css" />\n    <link rel="stylesheet" href="visual-tuning.css" />'
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");

  if (acceptsHtml) {
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetch(request))
        .then((response) => response.text())
        .then((html) => new Response(injectVisualTuning(html), { headers: { "content-type": "text/html; charset=utf-8" } }))
        .catch(() => caches.match("index.html").then((response) => response.text()).then((html) => new Response(injectVisualTuning(html), { headers: { "content-type": "text/html; charset=utf-8" } })))
    );
    return;
  }

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
