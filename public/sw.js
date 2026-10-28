// Offline shell: caches the app files so it opens fast and installs as an app.
// Catalogue and videos always come live (videos are never cached here).
const CACHE = "lm-v6";
const SHELL = ["./", "index.html", "styles.css", "app.js", "player.js", "util.js", "access.js", "starter-titles.js", "config.js", "api-firebase.js", "manifest.webmanifest", "icon-192.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (/\.(mp4|m3u8|ts)$/i.test(url.pathname) || e.request.headers.has("range")) return; // videos stream straight from the server
  // Network first so new versions show up right away; cache only when offline.
  const req = e.request.mode === "navigate" ? e.request : new Request(e.request, { cache: "no-cache" });
  e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
