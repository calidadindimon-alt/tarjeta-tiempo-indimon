// Service Worker de la Tarjeta de Tiempo INDIMON.
// Objetivo: una vez que alguien abre la app CON señal al menos una vez, guardar en el celular una copia
// de los estilos visuales (Tailwind, Google Fonts, íconos), las librerías (Firebase, jsPDF, Chart.js) y
// el propio archivo de la app — para que si la vuelve a abrir SIN señal, se siga viendo con el diseño
// normal (colores, tipografía, botones) en vez de aparecer "en crudo", como pasaba antes.
// Esto NO reemplaza la sincronización de datos (fichajes, permisos), que ya la maneja Firestore por su
// cuenta con su propia persistencia offline — este archivo solo se encarga de la PARTE VISUAL.

// IMPORTANTE: sube este número (v2 → v3 → ...) cada vez que cambies ALGO de este archivo.
// Cambiar el nombre es lo que obliga al navegador a tratar esto como un service worker nuevo.
const CACHE_NAME = 'indimon-estaticos-v2';

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

// RESCATE DE PESTAÑAS CONGELADAS (bug real reportado en iPhone):
// En iPhone (y en menor medida en Android), una pestaña que la persona deja abierta días no se cierra:
// el sistema la "congela" en segundo plano y, al volver, la despierta TAL CUAL estaba, sin volver a
// pedir la página a internet. Esa pestaña puede quedarse semanas ejecutando una versión vieja de la
// app — sin los arreglos publicados después, y sin siquiera el aviso de "hay una versión nueva"
// (porque ese aviso vive en el código nuevo, que esa pestaña nunca llegó a cargar). Peor: con el
// tiempo, Safari borra por su cuenta el almacenamiento local del sitio si no se usa por varios días,
// y la copia offline de Firestore que esa pestaña vieja tiene abierta queda rota — entonces TODO
// intento de fichar falla con un error de guardado, para siempre, hasta que se recargue.
//
// El service worker es la única pieza que puede rescatar esas pestañas, porque vive fuera de la
// página: el navegador lo vuelve a pedir por su cuenta cada cierto tiempo (aprox. cada 24 h) aunque
// la pestaña esté congelada. Cuando detecta que este archivo cambió, instala la versión nueva y aquí,
// al activarse, recarga las pestañas abiertas para sacarlas de la versión vieja.
//
// Solo se recargan las pestañas que NO están a la vista en ese momento (visibilityState 'hidden'):
// así nadie pierde lo que esté escribiendo ni se interrumpe un fichaje a medias. Una pestaña que la
// persona esté mirando se recarga sola en cuanto la deja en segundo plano.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((nombres) =>
                Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
            )
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
            .then((pestanas) => {
                pestanas.forEach((pestana) => {
                    if (pestana.visibilityState === 'hidden' && typeof pestana.navigate === 'function') {
                        pestana.navigate(pestana.url).catch(() => {});
                    }
                });
            })
            .catch(() => {})
    );
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
