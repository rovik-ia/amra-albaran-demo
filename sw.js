const CACHE = "albaran-amra-v1";
const BASE = self.registration.scope;
const LOCALES = ["index.html","manifest.webmanifest","icon-192.png","icon-512.png",
                 "icon-maskable-512.png","apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(LOCALES.map((f) =>
      c.add(new Request(BASE + f, {cache: "reload"})).catch(() => {})
    ));
    await c.add(new Request(BASE, {cache: "reload"})).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// cache primero: en obra no hay cobertura y la app tiene que abrir igual
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const esFuente = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!req.url.startsWith(BASE) && !esFuente) return;

  e.respondWith((async () => {
    const guardada = await caches.match(req, {ignoreSearch: false});
    if (guardada) return guardada;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const indice = await caches.match(BASE + "index.html");
      if (indice && req.mode === "navigate") return indice;
      throw err;
    }
  })());
});
