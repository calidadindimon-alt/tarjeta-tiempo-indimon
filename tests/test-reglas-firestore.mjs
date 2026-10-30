// Prueba de las reglas de seguridad de Firestore (firestore.rules) en el emulador de Firebase: no toca la base real.
//
// Comprueba, con datos ficticios, quién puede leer y escribir qué: alguien sin sesión, un colaborador con su PIN, un
// intruso que creó una cuenta con la cédula de alguien que todavía no tenía PIN, y Admin. Cubre la privacidad (sueldos,
// GPS, selfies, diagnósticos) y que lo que la app necesita siga funcionando (ingreso, fichar, enlaces de firma…).
//
// Uso (necesita Java):
//   npm install --no-save firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.13.0
//   npx firebase emulators:exec --only firestore --project demo-indimon "node tests/test-reglas-firestore.mjs"
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, collectionGroup, query, where } from 'firebase/firestore';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-indimon',
  firestore: { rules: fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'), host, port: Number(port) },
});

const FIRMANTES = (rrhh) => ({ trabajador: { firmado: true }, jefe: { firmado: true }, supervisor: { firmado: true }, rrhh: { firmado: rrhh } });
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admins/adm1'), { rol: 'admin' });
  await setDoc(doc(db, 'empleados/111'), { nombre: 'ANA PRUEBA', cargo: 'AUXILIAR', sueldo_base: 1750905, authUid: 'u111', activo: true, dias_vacaciones_disponibles: 15 });
  await setDoc(doc(db, 'empleados/222'), { nombre: 'BETO PRUEBA', cargo: 'SOLDADOR', sueldo_base: 2500000, authUid: 'u222', activo: true });
  await setDoc(doc(db, 'empleados/333'), { nombre: 'CAMI SIN PIN', cargo: 'AYUDANTE', sueldo_base: 1750905, authUid: null, activo: true });
  await setDoc(doc(db, 'empleados_publico/111'), { nombre: 'ANA PRUEBA', authUid: 'u111', cargo: 'AUXILIAR', dias_vacaciones_disponibles: 15 });
  await setDoc(doc(db, 'empleados/111/registros/2026-10-20'), { fecha: '2026-10-20', estado: 'completado', horas_ordinarias: 8, loc_entrada: { lat: 4.6, lng: -74 }, foto_entrada: 'data:image/jpeg;base64,xx' });
  await setDoc(doc(db, 'empleados/222/registros/2026-10-20'), { fecha: '2026-10-20', estado: 'completado', horas_ordinarias: 8 });
  await setDoc(doc(db, 'incapacidades/i1'), { trabajador_cedula: '111', diagnostico: 'confidencial', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-03' });
  await setDoc(doc(db, 'incapacidades/i2'), { trabajador_cedula: '222', diagnostico: 'confidencial' });
  await setDoc(doc(db, 'permisos/p1'), { trabajador: 'ANA PRUEBA', trabajador_cedula: '111', estado: 'pendiente', fecha: '2026-10-28', firmantes: FIRMANTES(false) });
  await setDoc(doc(db, 'permisos/p2'), { trabajador: 'BETO PRUEBA', trabajador_cedula: '222', estado: 'pendiente', firmantes: FIRMANTES(false) });
  await setDoc(doc(db, 'permisos/p3'), { trabajador: 'Ana Prueba', trabajador_cedula: null, estado: 'aprobado' });
  await setDoc(doc(db, 'desprendibles/d1'), { trabajador_cedula: '111', estado: 'pendiente', enlace_documento: 'https://drive.google.com/x' });
  await setDoc(doc(db, 'catalogos/listas'), { obras: ['BODEGA'] });
});

const anon = env.unauthenticatedContext().firestore();
const ana = env.authenticatedContext('u111', { email: 'emp111@indimon-tiempo.app' }).firestore();
const intruso = env.authenticatedContext('uX', { email: 'emp333@indimon-tiempo.app' }).firestore();
const admin = env.authenticatedContext('adm1', { email: 'admin@indimon.com' }).firestore();

const resultados = [];
const caso = async (grupo, nombre, esperado, fn) => {
  try { await (esperado ? assertSucceeds(fn()) : assertFails(fn())); resultados.push(true); console.log(`✅ ${grupo} · ${nombre}`); }
  catch (e) { resultados.push(false); console.log(`❌ ${grupo} · ${nombre} — ${String(e.message || e).split('\n')[0]}`); }
};
const SI = true, NO = false;
const registros = (db, ced) => collection(db, 'empleados', ced, 'registros');

// ---------- Sin sesión (internet, o quien abre un enlace de firma) ----------
const G = 'Sin sesión';
await caso(G, 'NO lee la ficha con sueldo (empleados/111)', NO, () => getDoc(doc(anon, 'empleados/111')));
await caso(G, 'NO lista todas las fichas', NO, () => getDocs(collection(anon, 'empleados')));
await caso(G, 'NO lee registros (GPS, selfies)', NO, () => getDoc(doc(anon, 'empleados/111/registros/2026-10-20')));
await caso(G, 'NO lista los registros de todos (collectionGroup)', NO, () => getDocs(collectionGroup(anon, 'registros')));
await caso(G, 'NO lee incapacidades (diagnóstico)', NO, () => getDoc(doc(anon, 'incapacidades/i1')));
await caso(G, 'NO lista incapacidades', NO, () => getDocs(collection(anon, 'incapacidades')));
await caso(G, 'NO lista permisos', NO, () => getDocs(collection(anon, 'permisos')));
await caso(G, 'NO lista desprendibles', NO, () => getDocs(collection(anon, 'desprendibles')));
await caso(G, 'NO crea desprendibles', NO, () => setDoc(doc(anon, 'desprendibles/falso'), { trabajador_cedula: '111' }));
await caso(G, 'NO marca un permiso como pasado a nómina', NO, () => updateDoc(doc(anon, 'permisos/p2'), { nomina_sincronizada: true }));
await caso(G, 'sí lista nombres para el ingreso (empleados_publico)', SI, () => getDocs(collection(anon, 'empleados_publico')));
await caso(G, 'sí lee catálogos (obras, horarios)', SI, () => getDoc(doc(anon, 'catalogos/listas')));
await caso(G, 'sí abre UN permiso por su enlace', SI, () => getDoc(doc(anon, 'permisos/p1')));
await caso(G, 'sí abre UN desprendible por su enlace', SI, () => getDoc(doc(anon, 'desprendibles/d1')));
await caso(G, 'sí crea una solicitud de permiso pendiente', SI, () => setDoc(doc(anon, 'permisos/nuevo'), { trabajador: 'ANA PRUEBA', trabajador_cedula: '111', estado: 'pendiente', firmantes: FIRMANTES(false) }));
await caso(G, 'sí firma de último y aprueba (con aprobado_en)', SI, () => updateDoc(doc(anon, 'permisos/p1'), { 'firmantes.rrhh.firmado': true, estado: 'aprobado', aprobado_en: '2026-10-30T12:00:00Z' }));
await caso(G, 'sí firma un desprendible por su enlace', SI, () => updateDoc(doc(anon, 'desprendibles/d1'), { firmado_por: 'ANA', firma: 'x', estado: 'firmado', firmado_en: '2026-10-30' }));

// ---------- Colaborador con su PIN (ANA, cédula 111) ----------
const C = 'Colaborador';
await caso(C, 'sí lee su propia ficha', SI, () => getDoc(doc(ana, 'empleados/111')));
await caso(C, 'NO lee la ficha de otro (sueldo de 222)', NO, () => getDoc(doc(ana, 'empleados/222')));
await caso(C, 'sí lee sus registros (mes, rango de fechas)', SI, () => getDocs(query(registros(ana, '111'), where('fecha', '>=', '2026-10-01'), where('fecha', '<=', '2026-10-31'))));
await caso(C, 'sí lee su registro de hoy aunque no exista todavía', SI, () => getDoc(doc(ana, 'empleados/111/registros/2026-10-30')));
await caso(C, 'NO lee registros de otro', NO, () => getDoc(doc(ana, 'empleados/222/registros/2026-10-20')));
await caso(C, 'NO usa la consulta de registros de todos', NO, () => getDocs(collectionGroup(ana, 'registros')));
await caso(C, 'sí busca SU incapacidad activa', SI, () => getDocs(query(collection(ana, 'incapacidades'), where('trabajador_cedula', '==', '111'))));
await caso(C, 'NO busca incapacidades de otro', NO, () => getDocs(query(collection(ana, 'incapacidades'), where('trabajador_cedula', '==', '222'))));
await caso(C, 'sí lista SUS permisos (Mi historial)', SI, () => getDocs(query(collection(ana, 'permisos'), where('trabajador_cedula', '==', '111'))));
await caso(C, 'NO lista permisos sin cédula de toda la empresa', NO, () => getDocs(query(collection(ana, 'permisos'), where('trabajador_cedula', '==', null))));
await caso(C, 'NO lista permisos de otro', NO, () => getDocs(query(collection(ana, 'permisos'), where('trabajador_cedula', '==', '222'))));
await caso(C, 'sí lista SUS desprendibles (Mi nómina)', SI, () => getDocs(query(collection(ana, 'desprendibles'), where('trabajador_cedula', '==', '111'))));
await caso(C, 'sí marca su entrada (escribe su registro de hoy)', SI, () => setDoc(doc(ana, 'empleados/111/registros/2026-10-30'), { fecha: '2026-10-30', entrada: '07:30', estado: 'activo', horas_ordinarias: 0 }));

// ---------- Intruso: creó la cuenta emp333 (Cami aún no tenía PIN) ----------
const I = 'Intruso con cédula ajena';
await caso(I, 'NO lee la ficha de Cami', NO, () => getDoc(doc(intruso, 'empleados/333')));
await caso(I, 'NO lee registros de Cami', NO, () => getDocs(registros(intruso, '333')));

// ---------- Admin ----------
const A = 'Admin';
await caso(A, 'sí lista todas las fichas', SI, () => getDocs(collection(admin, 'empleados')));
await caso(A, 'sí lista los registros de todos (Consolidado)', SI, () => getDocs(collectionGroup(admin, 'registros')));
await caso(A, 'sí lista incapacidades', SI, () => getDocs(collection(admin, 'incapacidades')));
await caso(A, 'sí lista permisos (también los sin cédula)', SI, () => getDocs(collection(admin, 'permisos')));
await caso(A, 'sí crea desprendibles', SI, () => setDoc(doc(admin, 'desprendibles/d2'), { trabajador_cedula: '222', estado: 'pendiente' }));
await caso(A, 'sí pasa un permiso a nómina (marca)', SI, () => updateDoc(doc(admin, 'permisos/p1'), { nomina_sincronizada: true }));
await caso(A, 'sí vincula un permiso sin cédula', SI, () => updateDoc(doc(admin, 'permisos/p3'), { trabajador_cedula: '111' }));
await caso(A, 'sí copia cargo y saldo a la ficha pública', SI, () => setDoc(doc(admin, 'empleados_publico/111'), { cargo: 'AUXILIAR', dias_vacaciones_disponibles: 10 }, { merge: true }));

await env.cleanup();
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok} / ${resultados.length} comprobaciones de reglas correctas`);
process.exit(ok === resultados.length ? 0 : 1);
