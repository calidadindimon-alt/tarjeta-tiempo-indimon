// Service Worker de la Tarjeta de Tiempo INDIMON.
// Objetivo: una vez que alguien abre la app CON señal al menos una vez, guardar en el celular una copia
// de los estilos visuales (Tailwind, Google Fonts, íconos), las librerías (Firebase, jsPDF, Chart.js) y
// el propio archivo de la app — para que si la vuelve a abrir SIN señal, se siga viendo con el diseño
// normal (colores, tipografía, botones) en vez de aparecer "en crudo", como pasaba antes.
// Esto NO reemplaza la sincronización de datos (fichajes, permisos), que ya la maneja Firestore por su
// cuenta con su propia persistencia offline — este archivo solo se encarga de la PARTE VISUAL.

const CACHE_NAME = 'indimon-estaticos-v1';

const HOSTS_A_CACHEAR = [
    'cdn.tailwindcss.com',
    'unpkg.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'www.gstatic.com',
    'cdn.jsdelivr.net'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.add('./').catch(() => {}))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((nombres) =>
            Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // nunca se cachean escrituras a Firestore ni nada que no sea una simple lectura

    const url = new URL(req.url);
    const esRecursoEstatico = HOSTS_A_CACHEAR.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));

    if (esRecursoEstatico) {
        // Estilos, fuentes y librerías: "cache primero". Si ya está guardado, se usa directo (más rápido
        // y funciona sin señal); si no, se descarga y se guarda para la próxima vez.
        event.respondWith(
            caches.match(req).then((enCache) => {
                if (enCache) return enCache;
                return fetch(req).then((resp) => {
                    const copia = resp.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
                    return resp;
                }).catch(() => enCache);
            })
        );
        return;
    }

    if (req.mode === 'navigate') {
        // El HTML de la app: "red primero", para que siempre se vea la versión más reciente si hay
        // señal; si no hay señal, se sirve la última copia guardada.
        event.respondWith(
            fetch(req).then((resp) => {
                const copia = resp.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
                return resp;
            }).catch(() => caches.match(req).then((r) => r || caches.match('./')))
        );
    }
});
