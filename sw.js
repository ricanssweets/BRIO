/* =========================================================================
   B.R.I.O. — Service Worker
   Qué cambia respecto a la versión anterior:

   1. NAVEGACIÓN NETWORK-FIRST. Antes todo se servía con cache-first y el
      nombre de la caché ('brio-app-v4') solo cambiaba si alguien editaba
      ESTE archivo a mano. Como el navegador solo instala un service worker
      nuevo cuando cambian los bytes de sw.js, publicar un cambio únicamente
      en index.html dejaba a quien tenía la app instalada congelado en la
      versión antigua para siempre. Ahora el HTML siempre se pide a la red
      (con la caché como respaldo sin conexión), así que las actualizaciones
      llegan solas.

   2. PRECACHÉ SOLO DEL SHELL. cache.addAll() es atómico: si un solo recurso
      falla, la instalación entera falla y la app se queda sin modo offline,
      en silencio. Antes se precacheaban logo.png (1,04 MB) y logo-full.png
      (204 KB), así que una red lenta podía romper la instalación. Las
      imágenes ahora se guardan cuando se usan.

   3. LOS TERCEROS NO SE INTERCEPTAN. El fetch handler anterior atrapaba
      también las peticiones a Google Fonts, que nunca estaban en caché.
      Ahora se dejan pasar al navegador.
   ========================================================================= */

const CACHE_NAME = 'brio-app-v6';

/* Solo el shell: lo mínimo para que la app abra sin conexión.
   app.js va incluido: es el código de la app (index.html ya no lo lleva en línea). */
const SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

/* ------------------------------------------------------------ install */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .catch(err => {
        /* No abortamos la instalación: es preferible un SW sin precaché
           completa que una app sin service worker. */
        console.warn('[BRIO SW] precaché incompleta:', err);
      })
  );
  self.skipWaiting();
});

/* ----------------------------------------------------------- activate */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* --------------------------------------------------- estrategias de red */
function fromCache(request, fallback) {
  return caches.match(request).then(hit => hit || fallback());
}

/* Red primero; si falla (sin conexión) se sirve lo cacheado. */
function networkFirst(request, cacheKey) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(cacheKey || request, copy))
          .catch(() => {});
      }
      return response;
    })
    .catch(() => fromCache(cacheKey || request, () => fromCache(request, () => undefined)));
}

/* Caché primero con refresco en segundo plano: ideal para imágenes. */
function cacheFirst(request) {
  return caches.match(request).then(hit => {
    const network = fetch(request)
      .then(response => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => hit);
    return hit || network;
  });
}

/* --------------------------------------------------------------- fetch */
self.addEventListener('fetch', event => {
  const request = event.request;

  /* Solo GET: no se cachean ni se interceptan envíos. */
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* 1. Navegación: red primero, respaldo offline con el shell. */
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, './index.html')
        .then(response => response || caches.match('./'))
        .then(response => response || Response.error())
    );
    return;
  }

  /* 2. Otros orígenes (Google Fonts): los gestiona el navegador. */
  if (url.origin !== self.location.origin) return;

  /* 3. Imágenes del propio sitio: caché primero. */
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* 4. Resto del mismo origen (manifest.json y demás): red primero. */
  event.respondWith(networkFirst(request));
});
