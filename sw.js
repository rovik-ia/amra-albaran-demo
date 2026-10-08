// Red primero para la página: una versión nueva llega en cuanto hay cobertura.
// Caché primero para fuentes, iconos y manifiesto (cambian con CACHE).
// Sin cobertura, en obra, todo sale de la caché.
const CACHE = "albaran-amra-v7";
const BASE = self.registration.scope;
const ESPERA_RED_MS = 3500;
const PRECARGA = [
  "", "index.html", "tarjeta.html", "vendor/qrcode.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png",
  "fonts/poppins-latin-300-normal.woff2", "fonts/poppins-latin-400-normal.woff2",
  "fonts/poppins-latin-500-normal.woff2", "fonts/poppins-latin-600-normal.woff2",
  "fonts/poppins-latin-700-normal.woff2", "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-500-normal.woff2", "fonts/ibm-plex-mono-latin-600-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECARGA.map((f) => c.add(new Request(BASE + f, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(BASE)) return;
  const ruta = new URL(req.url).pathname;
  const esPagina = req.mode === "navigate" || ruta.endsWith("/") || ruta.endsWith(".html");
  e.respondWith(esPagina ? redPrimero(req) : cachePrimero(req));
});

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function redPrimero(req) {
  const c = await caches.open(CACHE);
  const clave = req.url.split(/[?#]/)[0];
  const guardada = (await c.match(clave)) || (await c.match(BASE)) || (await c.match(BASE + "index.html"));
  const red = fetch(clave, { cache: "no-cache", credentials: "same-origin" }).then((res) => {
    if (res.ok) c.put(clave, res.clone());
    return res;
  });
  if (!guardada) return red;
  // con copia guardada no se espera a una red lenta: se sirve la copia y la red la renueva
  return Promise.race([red.catch(() => guardada), espera(ESPERA_RED_MS).then(() => guardada)]);
}

async function cachePrimero(req) {
  const c = await caches.open(CACHE);
  const guardada = await c.match(req);
  if (guardada) return guardada;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}
