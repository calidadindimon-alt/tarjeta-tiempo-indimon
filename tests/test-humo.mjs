// Prueba de humo: abre la app COMPLETA (index.html) en un Chrome automático y comprueba que arranca y que sus
// pantallas principales abren, sin errores de JavaScript.
//
// Las pruebas de cálculo (test-jornada-diaria.mjs y las demás) prueban funciones sueltas extraídas del archivo;
// no notan si un cambio rompe el arranque de la app, un botón o un modal. Esta sí.
//
// Firebase (incluido App Check) y EmailJS se reemplazan por versiones simuladas en memoria (ver STUB_* abajo): la prueba NO lee ni
// escribe en Firestore real y no envía correos. Por eso tampoco detecta problemas de la base real (reglas,
// índices, conexión).
//
// Uso: node tests/test-humo.mjs   (necesita playwright instalado: npm install --no-save playwright@1.56.1
// y el navegador: npx playwright install chromium)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- Servidor local de solo lectura para index.html y sus archivos ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const servidor = http.createServer((req, res) => {
  const ruta = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
  fs.createReadStream(ruta).pipe(res);
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

// ---------- Firebase y EmailJS simulados (en memoria) ----------
const STUB_APP = `export const initializeApp = () => ({});`;
const STUB_AUTH = `
export const getAuth = () => ({ get currentUser() { return window.__AUTH_USER__ || null; } });
export const createUserWithEmailAndPassword = async () => { throw new Error('simulado'); };
export const signInWithEmailAndPassword = async (a, email) => { window.__AUTH_USER__ = { email, uid: email.startsWith('admin') ? 'adm1' : 'u1' }; return { user: window.__AUTH_USER__ }; };
export const signOut = async () => { window.__AUTH_USER__ = null; };
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(null), 0); return () => {}; };`;
const STUB_FS = `
const DB = () => (window.__DB__ = window.__DB__ || {});
const ref = (p, extra = {}) => { const seg = p.split('/'); const r = Object.assign({ path: p, id: seg[seg.length - 1] }, extra);
  if (seg.length >= 2) r.parent = { id: seg[seg.length - 2], path: seg.slice(0, -1).join('/'), parent: seg.length >= 3 ? { id: seg[seg.length - 3] } : null }; return r; };
const leer = (p) => { const col = p.split('/').slice(0, -1).join('/'), id = p.split('/').pop(); return (DB()[col] || {})[id]; };
const snapDoc = (p) => { const d = leer(p); return { id: p.split('/').pop(), exists: () => d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))), ref: ref(p) }; };
const cumple = (d, filtros) => filtros.every(([f, op, v]) => op !== '==' || f === '__name__' || (d || {})[f] === v);
const lista = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) });
const resolver = (q) => {
  const filtros = (q.cons || []).filter(c => c && c.where).map(c => c.where);
  let rutas = [];
  if (q.path.startsWith('__group__/')) { const n = q.path.split('/')[1]; for (const col of Object.keys(DB())) if (col.split('/').pop() === n) for (const id of Object.keys(DB()[col])) rutas.push(col + '/' + id); }
  else rutas = Object.keys(DB()[q.path] || {}).map(id => q.path + '/' + id);
  return lista(rutas.map(snapDoc).filter(s => cumple(s.data(), filtros)));
};
const aplicar = (r, data, merge) => { const col = r.path.split('/').slice(0, -1).join('/'), id = r.path.split('/').pop(); const m = (DB()[col] = DB()[col] || {});
  const out = JSON.parse(JSON.stringify(merge ? (m[id] || {}) : {}));
  for (const [k, v] of Object.entries(data)) { const partes = k.split('.'); let o = out; for (let i = 0; i < partes.length - 1; i++) o = o[partes[i]] = o[partes[i]] || {}; o[partes[partes.length - 1]] = v; }
  m[id] = out; (window.__OYENTES__ || []).forEach(fn => fn()); };
export const getFirestore = () => ({}); export const initializeFirestore = () => ({}); export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
export const collection = (db, ...seg) => ref(seg.join('/'), { isCollection: true });
export const collectionGroup = (db, n) => ({ path: '__group__/' + n, isCollection: true });
export const doc = (a, ...seg) => (a && a.isCollection ? ref(a.path + '/' + (seg[0] || 'auto' + Math.random().toString(36).slice(2, 8))) : ref(seg.join('/')));
export const getDoc = async (r) => snapDoc(r.path);
export const getDocs = async (q) => resolver(q);
export const query = (r, ...cons) => ({ ...r, cons });
export const where = (f, op, v) => ({ where: [typeof f === 'string' ? f : '__name__', op, v] });
export const orderBy = () => ({}); export const limit = () => ({}); export const documentId = () => ({});
export const setDoc = async (r, data, o) => aplicar(r, data, o && o.merge);
export const updateDoc = async (r, data) => aplicar(r, data, true);
export const deleteDoc = async () => {};
export const onSnapshot = (q, cb) => { const run = () => { try { cb(q.isCollection || q.cons ? resolver(q) : snapDoc(q.path)); } catch (e) { console.error(e); } }; (window.__OYENTES__ = window.__OYENTES__ || []).push(run); run(); return () => {}; };
export const writeBatch = () => { const ops = []; return { set(r, d) { ops.push(() => aplicar(r, d, false)); }, update(r, d) { ops.push(() => aplicar(r, d, true)); }, delete() {}, commit: async () => ops.forEach(f => f()) }; };
export const arrayUnion = (...a) => a; export const serverTimestamp = () => new Date().toISOString(); export const increment = (n) => n;
export const runTransaction = async (db, fn) => fn({ get: async (r) => snapDoc(r.path), update() {}, set() {} });`;
const STUB_EMAILJS = `export default { init() {}, send: async () => ({ status: 200 }) };`;
const STUB_APPCHECK = `export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider { constructor() {} }`;

// Datos de prueba ficticios: un colaborador, un admin, un registro por revisar y un día con extras aprobadas que cambia al recalcular.
const DATOS = () => {
  window.__DB__ = {
    'admins': { adm1: { rol: 'admin' } },
    'catalogos': { listas: { clientes: ['INDIMON S.A.S.'], obras: ['BODEGA'], supervisores: ['JLAF'], horarios_obra: { BODEGA: '07:30' } } },
    'empleados_publico': { '111': { nombre: 'COLABORADOR DE PRUEBA', authUid: 'u1' } },
    'empleados': { '111': { nombre: 'COLABORADOR DE PRUEBA', cargo: 'AUXILIAR', sueldo_base: 1750905, activo: true, authUid: 'u1' } },
    'empleados/111/registros': {
      '2026-10-15': { fecha: '2026-10-15', cedula: '111', empleado_nombre: 'COLABORADOR DE PRUEBA', obra: 'BODEGA', entrada: '07:30', salida: '17:40', estado: 'requiere_revision_admin', horas_ordinarias: 8.5, horas_extras_diurnas: 0.67, nota_revision: 'Fuera de la geocerca (salida a 90m de la obra).' },
      '2026-10-20': { fecha: '2026-10-20', cedula: '111', empleado_nombre: 'COLABORADOR DE PRUEBA', obra: 'BODEGA', entrada: '07:30', salida: '17:00', estado: 'completado', horas_ordinarias: 8, horas_extras_diurnas: 0.5, extras_estado: 'aprobada' },
      '2026-10-21': { fecha: '2026-10-21', cedula: '111', empleado_nombre: 'COLABORADOR DE PRUEBA', obra: 'BODEGA', entrada: '07:30', salida: '18:30', estado: 'completado', horas_ordinarias: 8.5, horas_extras_diurnas: 1.5, extras_estado: 'por_aprobar', extras_autoriza: 'JLAF' }
    }
  };
};

// ---------- Prueba ----------
const resultados = [];
const ok = (nombre, cumple, detalle = '') => { resultados.push(cumple); console.log(`${cumple ? '✅' : '❌'} ${nombre}${!cumple && detalle ? ' — ' + detalle : ''}`); };
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 430, height: 900 }, serviceWorkers: 'block' })).newPage();
const errores = [];
page.on('pageerror', e => errores.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
await page.addInitScript(DATOS);
await page.route('**/*', (route) => {
  const url = route.request().url();
  const js = (cuerpo) => route.fulfill({ contentType: 'application/javascript', body: cuerpo });
  if (url.startsWith(BASE)) return route.continue();
  if (url.includes('firebase-app.js')) return js(STUB_APP);
  if (url.includes('firebase-auth.js')) return js(STUB_AUTH);
  if (url.includes('firebase-firestore.js')) return js(STUB_FS);
  if (url.includes('@emailjs/browser')) return js(STUB_EMAILJS);
  if (url.includes('firebase-app-check.js')) return js(STUB_APPCHECK);
  if (/\.js(\?|$)/.test(url)) return js('/* librería externa omitida en la prueba de humo */');
  return route.abort(); // fuentes, íconos y cualquier otra cosa de internet
});

try {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  ok('1. La app carga sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  const nombres = await page.$$eval('#lista-empleados option', os => os.map(o => o.value));
  ok('2. Aparece la pantalla de ingreso con la lista de colaboradores', await page.isVisible('#login-nombre') && nombres.includes('COLABORADOR DE PRUEBA'), JSON.stringify(nombres));

  await page.fill('#login-nombre', 'COLABORADOR DE PRUEBA');
  await page.click('#btn-login');
  await page.waitForSelector('#pin-input-1', { state: 'visible', timeout: 5000 });
  await page.fill('#pin-input-1', '123456');
  await page.click('#btn-pin-confirm');
  await page.waitForTimeout(1500);
  ok('3. El colaborador entra con PIN y ve "Registro Diario" con el botón de Entrada',
    await page.isVisible('#view-tarjeta') && await page.isVisible('#state-1-entrada') && await page.isVisible('#btn-punch-in'));

  ok('3b. Mi Tarjeta: el héroe muestra "Aún no marcas entrada" y la obra del último turno queda elegida',
    (await page.getAttribute('#mt-hero', 'data-estado')) === 'entrada' && (await page.textContent('#mt-fila-obra')) === 'BODEGA');
  await page.click('#mt-extras');
  await page.waitForTimeout(300);
  ok('3c. Al tocar las extras se abre el detalle del mes', await page.isVisible('#hoja-extras') && /Extra diurna/.test(await page.textContent('#hoja-extras-tipo')));
  await page.click('#btn-hoja-extras-cerrar');
  await page.waitForTimeout(200);

  for (const [tab, nombre] of [['tab-permisos', 'Permisos'], ['tab-desprendibles', 'Nómina']]) {
    await page.locator(`.nav-tab[data-target="${tab}"]:visible`).first().click();
    await page.waitForTimeout(500);
    ok(`4. La pestaña ${nombre} abre`, await page.isVisible(`#${tab}`));
  }

  await page.locator('.nav-tab[data-target="tab-admin"]:visible').first().click();
  await page.waitForTimeout(400);
  await page.fill('#admin-email', 'admin@indimon.com');
  await page.fill('#admin-pass', 'prueba');
  await page.click('#btn-admin-login');
  await page.waitForSelector('#admin-panel-view', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(800);
  ok('5. Admin entra y ve el Consolidado', await page.isVisible('#admin-panel-view') && /Consolidado de Tiempos/.test(await page.textContent('#admin-panel-view')));
  await page.click('#btn-add-horario-obra');
  await page.waitForTimeout(400);
  ok('6. "Horarios por Obra" abre con la lista de obras', await page.isVisible('#modal-horarios-obra-box') && /BODEGA/.test(await page.textContent('#horarios-obra-lista')));
  await page.click('#btn-horarios-obra-cerrar');
  await page.waitForTimeout(400);
  ok('7. El aviso "por revisar" aparece y abre la lista', await page.isVisible('#btn-aviso-por-revisar') && /1 registro por revisar/.test(await page.textContent('#aviso-por-revisar-texto')));
  await page.click('#btn-aviso-por-revisar');
  await page.waitForTimeout(400);
  ok('   … con el registro pendiente y su botón Aprobar', await page.isVisible('#modal-por-revisar-box') && (await page.locator('.btn-aprobar-revision').count()) === 1);
  await page.click('#btn-por-revisar-cerrar');
  await page.waitForTimeout(400);
  ok('8. El aviso de "Extras por aprobar" aparece y abre la lista por semana',
    await page.isVisible('#btn-aviso-extras') && /1,5 h extra por aprobar/.test(await page.textContent('#aviso-extras-texto')));
  await page.click('#btn-aviso-extras');
  await page.waitForTimeout(400);
  ok('   … con el botón de aprobar de la semana', await page.isVisible('#modal-extras-box') && (await page.locator('.btn-extras-aprobar').count()) >= 1);
  await page.locator('.btn-extras-aprobar').first().click();
  await page.waitForTimeout(600);
  ok('   … y al aprobar, el aviso desaparece', !(await page.isVisible('#btn-aviso-extras')));
  await page.click('#btn-extras-cerrar');
  await page.waitForTimeout(400);
  await page.click('#btn-resumen-alertas');
  await page.waitForSelector('#modal-alertas-box', { state: 'visible', timeout: 5000 });
  await page.fill('#alertas-mes', '2026-10');
  await page.dispatchEvent('#alertas-mes', 'change');
  await page.waitForTimeout(300);
  ok('9. "Resumen de alertas" abre y muestra al colaborador con su alerta de geocerca',
    /COLABORADOR DE PRUEBA/.test(await page.textContent('#alertas-tabla')) && (await page.locator('.fila-alerta').count()) === 1);
  await page.click('#btn-alertas-cerrar');
  await page.waitForTimeout(400);
  await page.selectOption('#recalc-empleado', '__todos__');
  await page.fill('#recalc-fecha', '2026-10-21');
  await page.evaluate(() => document.getElementById('btn-recalcular-semana').click());
  await page.waitForSelector('#modal-recalc-todos-box', { state: 'visible', timeout: 5000 });
  const tablaRecalc = await page.textContent('#recalc-todos-tabla');
  ok('10. "Recalcular semana de todos" muestra la vista previa con el día que cambia y el aviso de extras aprobadas',
    /COLABORADOR DE PRUEBA/.test(tablaRecalc) && /vuelven a por aprobar/.test(tablaRecalc) && await page.isVisible('#recalc-todos-aviso'), tablaRecalc);
  await page.click('#btn-recalc-todos-cancelar');
  await page.waitForTimeout(400);
  const dia20 = () => page.evaluate(() => window.__DB__['empleados/111/registros']['2026-10-20']);
  ok('    … Cancelar no guarda nada', (await dia20()).horas_ordinarias === 8 && (await dia20()).extras_estado === 'aprobada');
  await page.evaluate(() => document.getElementById('btn-recalcular-semana').click());
  await page.waitForSelector('#modal-recalc-todos-box', { state: 'visible', timeout: 5000 });
  await page.click('#btn-recalc-todos-aplicar');
  await page.waitForTimeout(800);
  const d20 = await dia20();
  ok('    … y Aplicar guarda las horas nuevas y deja las extras "por aprobar"', d20.horas_extras_diurnas === 0 && d20.extras_estado === 'por_aprobar', JSON.stringify(d20));
  ok('11. Ningún error de JavaScript durante todo el recorrido', errores.length === 0, errores.join(' | '));
} catch (e) {
  ok('La prueba de humo pudo terminar el recorrido', false, e.message.split('\n')[0]);
  await page.screenshot({ path: path.join(RAIZ, 'tests', '_humo-fallo.png') }).catch(() => {});
} finally {
  await browser.close();
  servidor.close();
}

const fallas = resultados.filter(r => !r).length;
console.log(`\n${resultados.length - fallas} / ${resultados.length} comprobaciones correctas`);
process.exit(fallas ? 1 : 0);
