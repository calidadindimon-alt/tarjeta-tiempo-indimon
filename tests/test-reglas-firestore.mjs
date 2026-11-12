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
// "Hoy" en Colombia (UTC-5): las reglas solo dejan crear el día de hoy (con margen), así que la prueba no puede usar
// una fecha fija.
const diaColombia = (desplazamientoDias) => new Date(Date.now() - 5 * 3600000 + desplazamientoDias * 86400000).toISOString().slice(0, 10);
const HOY = diaColombia(0), MANANA = diaColombia(1);

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
await caso(C, 'sí lee su registro de hoy aunque no exista todavía', SI, () => getDoc(doc(ana, `empleados/111/registros/${HOY}`)));
await caso(C, 'NO lee registros de otro', NO, () => getDoc(doc(ana, 'empleados/222/registros/2026-10-20')));
await caso(C, 'NO usa la consulta de registros de todos', NO, () => getDocs(collectionGroup(ana, 'registros')));
await caso(C, 'sí busca SU incapacidad activa', SI, () => getDocs(query(collection(ana, 'incapacidades'), where('trabajador_cedula', '==', '111'))));
await caso(C, 'NO busca incapacidades de otro', NO, () => getDocs(query(collection(ana, 'incapacidades'), where('trabajador_cedula', '==', '222'))));
await caso(C, 'sí lista SUS permisos (Mi historial)', SI, () => getDocs(query(collection(ana, 'permisos'), where('trabajador_cedula', '==', '111'))));
await caso(C, 'NO lista permisos sin cédula de toda la empresa', NO, () => getDocs(query(collection(ana, 'permisos'), where('trabajador_cedula', '==', null))));
await caso(C, 'NO lista permisos de otro', NO, () => getDocs(query(collection(ana, 'permisos'), where('trabajador_cedula', '==', '222'))));
await caso(C, 'sí lista SUS desprendibles (Mi nómina)', SI, () => getDocs(query(collection(ana, 'desprendibles'), where('trabajador_cedula', '==', '111'))));
await caso(C, 'sí marca su entrada (escribe su registro de hoy)', SI, () => setDoc(doc(ana, `empleados/111/registros/${HOY}`), { fecha: HOY, entrada: '07:30', estado: 'activo', horas_ordinarias: 0 }));

await caso(C, 'sí sale a una cita y vuelve (salidas_permiso en su registro de hoy)', SI, () => updateDoc(doc(ana, `empleados/111/registros/${HOY}`), { salidas_permiso: [{ motivo: 'Cita médica', sale: '10:00', vuelve: '12:00' }] }));
await caso(C, 'sí marca "Entendido" en la decisión de RRHH (decisiones_vistas)', SI, () => updateDoc(doc(ana, `empleados/111/registros/${HOY}`), { decisiones_vistas: ['0:descuenta'] }));
await caso(C, 'NO cambia la decisión de RRHH sobre su permiso', NO, () => updateDoc(doc(ana, `empleados/111/registros/${HOY}`), { 'decisiones_permiso.0': { decision: 'no_descuenta' } }));
await caso(C, 'NO crea un registro ya con una decisión de RRHH', NO, () => setDoc(doc(ana, `empleados/111/registros/${MANANA}`), { fecha: MANANA, entrada: '07:00', estado: 'activo', horas_ordinarias: 0, decisiones_permiso: { 0: { decision: 'no_descuenta' } } }));

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
await caso(A, 'sí decide sobre el permiso personal de un colaborador', SI, () => updateDoc(doc(admin, `empleados/111/registros/${HOY}`), { 'decisiones_permiso.0': { decision: 'descuenta', horas: 2 } }));
await caso(A, 'sí copia cargo y saldo a la ficha pública', SI, () => setDoc(doc(admin, 'empleados_publico/111'), { cargo: 'AUXILIAR', dias_vacaciones_disponibles: 10 }, { merge: true }));

// Después de la decisión de RRHH, el colaborador sigue pudiendo guardar su día (sin tocar la decisión).
await caso(C, 'sí marca "Entendido" y sigue fichando con la decisión de RRHH ya guardada', SI, () => updateDoc(doc(ana, `empleados/111/registros/${HOY}`), { decisiones_vistas: ['0:descuenta'], salida: '17:00' }));

// ---------- Candados del colaborador sobre su propio día (auditoría nov-2026, hallazgo 3) ----------
// Primero, que TODO lo que la app hace normalmente desde el celular siga funcionando; después, que lo que no hace se rechace.
// Los días cerrados usan fechas fijas (las reglas no miran la fecha al recalcular); los que se crean, la fecha de hoy.
const beto = env.authenticatedContext('u222', { email: 'emp222@indimon-tiempo.app' }).firestore();
const CERO = { horas_ordinarias: 0, horas_extras_diurnas: 0, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 0 };
const reg = (ced, f) => `empleados/${ced}/registros/${f}`;
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'catalogos/listas'), { obras: ['BODEGA'], festivos: ['2026-11-25'] }); // festivo regional agregado por Admin (miércoles)
  // Turnos abiertos (el celular los cierra): martes, domingo, sábado de noche, víspera de festivo y uno abierto 4 días.
  await setDoc(doc(db, reg('222', '2026-11-10')), { fecha: '2026-11-10', entrada: '07:30', estado: 'activo', ...CERO });
  await setDoc(doc(db, reg('222', '2026-11-15')), { fecha: '2026-11-15', entrada: '07:00', estado: 'activo', ...CERO });
  await setDoc(doc(db, reg('222', '2026-11-14')), { fecha: '2026-11-14', entrada: '20:00', estado: 'activo', ...CERO });
  await setDoc(doc(db, reg('222', '2026-11-24')), { fecha: '2026-11-24', entrada: '20:00', estado: 'activo', ...CERO });
  await setDoc(doc(db, reg('222', '2026-11-03')), { fecha: '2026-11-03', entrada: '07:30', estado: 'activo', ...CERO });
  // Días cerrados de Ana: uno con 1 h extra ya aprobada, uno con extras de antes de la aprobación, una ausencia, uno
  // "por revisar" y uno con una salida a permiso que RRHH decidió descontar.
  for (const f of ['2026-11-09', '2026-11-10']) {
    await setDoc(doc(db, reg('111', f)), { fecha: f, estado: 'completado', entrada: '07:30', salida: '18:00', ...CERO, horas_ordinarias: 8.5, horas_extras_diurnas: 1, extras_estado: 'aprobada', extras_revisada_por: 'rrhh@indimon.com', extras_revisada_en: '2026-11-11T10:00:00Z' });
  }
  await setDoc(doc(db, reg('111', '2026-10-15')), { fecha: '2026-10-15', estado: 'completado', entrada: '07:30', salida: '18:00', ...CERO, horas_ordinarias: 8.5, horas_extras_diurnas: 1 });
  await setDoc(doc(db, reg('111', '2026-11-04')), { fecha: '2026-11-04', estado: 'completado', tipo_permiso: 'Ausencia injustificada', horas_permiso: 8, ...CERO });
  await setDoc(doc(db, reg('111', '2026-11-12')), { fecha: '2026-11-12', estado: 'requiere_revision_admin', entrada: '07:30', salida: '21:00', ...CERO, horas_ordinarias: 8.5, horas_extras_diurnas: 2, horas_extras_nocturnas: 2, extras_estado: 'por_aprobar', salida_declarada_por_colaborador: true });
  await setDoc(doc(db, reg('111', '2026-11-13')), { fecha: '2026-11-13', estado: 'completado', entrada: '07:30', salida: '16:30', ...CERO, horas_ordinarias: 6, horas_permiso_turno: 2, salidas_permiso: [{ motivo: 'Permiso personal', sale: '09:00', vuelve: '11:00' }], decisiones_permiso: { 0: { decision: 'descuenta', por: 'rrhh@indimon.com' } } });
  // Día viejo con datos que no cumplirían los candados nuevos (8 h en un turno de 30 min, guardado antes de ellos).
  await setDoc(doc(db, reg('111', '2026-09-30')), { fecha: '2026-09-30', estado: 'completado', entrada: '07:30', salida: '08:00', ...CERO, horas_ordinarias: 8, decisiones_permiso: { 0: { decision: 'descuenta' } } });
  // Hoy: Beto tiene una ausencia que puso Admin a media mañana. Mañana: un permiso por horas aprobado de antemano.
  await setDoc(doc(db, reg('222', HOY)), { fecha: HOY, estado: 'completado', tipo_permiso: 'Ausencia injustificada', horas_permiso: 8, nota_permiso: 'No llegó', ...CERO });
  await setDoc(doc(db, reg('222', MANANA)), { fecha: MANANA, estado: 'completado', tipo_permiso: 'Cita médica (urgencia o especialista)', horas_permiso: 2, permiso_id: 'p1', entrada: null, salida: null, ...CERO });
});

const F = 'Fichaje normal (debe seguir funcionando)';
await caso(F, 'sí inicia y termina el almuerzo', SI, () => updateDoc(doc(beto, reg('222', '2026-11-10')), { almuerzo_inicio: '12:00', almuerzo_fin: '13:00' }));
await caso(F, 'sí cambia la obra del turno abierto', SI, () => updateDoc(doc(beto, reg('222', '2026-11-10')), { obra: 'BODEGA', cliente: 'INDIMON', autoriza: 'JLAF' }));
await caso(F, 'sí marca "hoy no tomo almuerzo" (con quién autorizó)', SI, () => setDoc(doc(beto, reg('222', '2026-11-10')), { almuerzo_omitido: true, almuerzo_omitido_autoriza: 'JLAF' }, { merge: true }));
await caso(F, 'sí cierra el día con 8,5 h y 2 h extra por aprobar (07:30–19:00)', SI, () => setDoc(doc(beto, reg('222', '2026-11-10')), { salida: '19:00', estado: 'completado', horas_ordinarias: 8.5, horas_extras_diurnas: 2, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 0, es_dominical_festivo: false, extras_estado: 'por_aprobar', extras_autoriza: 'JLAF' }, { merge: true }));
await caso(F, 'sí cierra un domingo trabajado (horas dominicales)', SI, () => updateDoc(doc(beto, reg('222', '2026-11-15')), { salida: '16:00', estado: 'completado', horas_ordinarias: 9, horas_dominicales: 9, es_dominical_festivo: true }));
await caso(F, 'sí cierra un sábado 20:00 → domingo 06:00 (6 h dominicales)', SI, () => updateDoc(doc(beto, reg('222', '2026-11-14')), { salida: '06:00', estado: 'completado', horas_extras_nocturnas: 10, horas_dominicales: 6, extras_estado: 'por_aprobar' }));
await caso(F, 'sí cierra la víspera de un festivo de Admin, 20:00 → 06:00', SI, () => updateDoc(doc(beto, reg('222', '2026-11-24')), { salida: '06:00', estado: 'completado', horas_ordinarias: 8, horas_recargo_nocturno: 8, horas_extras_nocturnas: 2, horas_dominicales: 6, extras_estado: 'por_aprobar' }));
await caso(F, 'sí cierra un turno que quedó abierto 4 días (queda por revisar, sin horas)', SI, () => updateDoc(doc(beto, reg('222', '2026-11-03')), { salida: '08:00', estado: 'requiere_revision_admin', nota_revision: 'Turno quedó abierto 4 días', ...CERO }));
await caso(F, 'sí marca entrada hoy aunque Admin le había puesto ausencia (la app la quita)', SI, () => setDoc(doc(beto, reg('222', HOY)), { entrada: '09:10', estado: 'activo', tipo_permiso: null, horas_permiso: 0, nota_permiso: null, obra: 'BODEGA' }, { merge: true }));
await caso(F, 'sí marca entrada sobre el día de un permiso por horas aprobado de antemano', SI, () => setDoc(doc(beto, reg('222', MANANA)), { entrada: '07:30', estado: 'activo', obra: 'BODEGA' }, { merge: true }));
await caso(F, 'sí recalcula un día cerrado (las extras cambian y vuelven a "por aprobar")', SI, () => updateDoc(doc(ana, reg('111', '2026-11-09')), { horas_ordinarias: 8, horas_extras_diurnas: 1.5, extras_estado: 'por_aprobar' }));
await caso(F, 'sí recalcula un día cerrado sin cambiar sus extras', SI, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { minutos_tarde: 0, horas_descuento_tardanza: 0 }));
await caso(F, 'sí marca "Entendido" en un día viejo que no cumpliría los candados nuevos', SI, () => updateDoc(doc(ana, reg('111', '2026-09-30')), { decisiones_vistas: ['0:descuenta'] }));
await caso(F, 'sí marca "Entendido" en un día por revisar', SI, () => updateDoc(doc(ana, reg('111', '2026-11-12')), { decisiones_vistas: ['0:descuenta'] }));

const X = 'Colaborador saltándose la app (debe rechazarse)';
// (Las cifras caben entre la entrada y la salida, para que lo que se pruebe sea la regla de las extras.)
await caso(X, 'NO sube las extras de un día ya aprobado dejándolo "aprobada"', NO, () => updateDoc(doc(ana, reg('111', '2026-11-10')), { horas_extras_diurnas: 0, horas_extras_nocturnas: 2 }));
await caso(X, 'NO cambia extras diurnas por nocturnas dejándolas aprobadas', NO, () => updateDoc(doc(ana, reg('111', '2026-11-10')), { horas_extras_diurnas: 0, horas_extras_nocturnas: 1, extras_estado: 'aprobada' }));
await caso(X, 'NO sube las extras de un día anterior a la aprobación sin dejarlas "por aprobar"', NO, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { horas_extras_diurnas: 0, horas_extras_nocturnas: 2 }));
await caso(X, 'NO marca horas dominicales en un martes', NO, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { horas_dominicales: 8.5, horas_recargo_nocturno: 8.5 }));
await caso(X, 'NO marca un martes como dominical (sin horas dominicales)', NO, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { es_dominical_festivo: true }));
await caso(X, 'NO pasa de las horas que hay entre su entrada y su salida', NO, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { horas_ordinarias: 12 }));
await caso(X, 'NO crea un día pasado con horas (14-oct-2026)', NO, () => setDoc(doc(ana, reg('111', '2026-10-14')), { fecha: '2026-10-14', estado: 'completado', entrada: '07:00', salida: '23:00', ...CERO, horas_extras_nocturnas: 10, extras_estado: 'por_aprobar' }));
await caso(X, 'NO crea un domingo "trabajado" sin fichar', NO, () => setDoc(doc(ana, reg('111', '2026-11-08')), { fecha: '2026-11-08', estado: 'completado', ...CERO, horas_ordinarias: 9, horas_dominicales: 9, es_dominical_festivo: true }));
await caso(X, 'NO abre un turno de hace 10 días', NO, () => setDoc(doc(ana, reg('111', diaColombia(-10))), { fecha: diaColombia(-10), entrada: '07:30', estado: 'activo', ...CERO }));
await caso(X, 'NO crea un día con una fecha distinta a la del documento', NO, () => setDoc(doc(ana, reg('111', MANANA)), { fecha: '2026-10-01', entrada: '07:30', estado: 'activo', ...CERO }));
await caso(X, 'NO se quita la ausencia injustificada de un día pasado', NO, () => updateDoc(doc(ana, reg('111', '2026-11-04')), { tipo_permiso: null, horas_permiso: 0 }));
await caso(X, 'NO se autoriza la entrada temprana en un día cerrado', NO, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { entrada_temprana_autorizada: true }));
await caso(X, 'NO marca "sin almuerzo" en un día cerrado', NO, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { almuerzo_omitido: true, almuerzo_omitido_autoriza: 'JLAF' }));
await caso(X, 'NO cambia la hora de entrada de un día cerrado', NO, () => updateDoc(doc(ana, reg('111', '2026-10-15')), { entrada: '05:00' }));
await caso(X, 'NO se aprueba un día por revisar', NO, () => updateDoc(doc(ana, reg('111', '2026-11-12')), { estado: 'completado' }));
await caso(X, 'NO pone en 0 las horas del permiso que RRHH decidió descontar', NO, () => updateDoc(doc(ana, reg('111', '2026-11-13')), { horas_permiso_turno: 0 }));
await caso(X, 'NO cambia la hora de entrada de su turno abierto', NO, () => updateDoc(doc(beto, reg('222', HOY)), { entrada: '07:00' }));
await caso(X, 'NO se autoriza la entrada temprana en su turno abierto', NO, () => updateDoc(doc(beto, reg('222', HOY)), { entrada_temprana_autorizada: true }));
await caso(X, 'NO se pone un tipo de permiso en su turno abierto', NO, () => updateDoc(doc(beto, reg('222', HOY)), { tipo_permiso: 'Cita médica (urgencia o especialista)', horas_permiso: 4 }));
await caso(X, 'NO reabre un día cerrado con horas', NO, () => updateDoc(doc(beto, reg('222', '2026-11-10')), { estado: 'activo' }));

await env.cleanup();
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok} / ${resultados.length} comprobaciones de reglas correctas`);
process.exit(ok === resultados.length ? 0 : 1);
