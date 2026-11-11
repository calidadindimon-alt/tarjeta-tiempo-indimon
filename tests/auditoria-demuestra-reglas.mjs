// AUDITORÍA DE NÓMINA (nov-2026) — pruebas que DEMUESTRAN los hallazgos de docs/auditoria-nomina/INFORME-segunda-revision.md sobre lo
// que un colaborador puede cambiar desde su celular (firestore.rules). Corre en el emulador: no toca la base real.
//
// OJO: NO forma parte del CI y NUNCA termina en error. Cada caso intenta una escritura que NO debería poder hacerse:
//   🔴 HALLAZGO VIGENTE -> las reglas la dejan pasar.     🟢 YA CORREGIDO -> las reglas la rechazan.
//
// IMPORTANTE: al escribir el informe esta prueba NO se pudo ejecutar (el equipo de la auditoría no tenía Java, que el
// emulador necesita). Los hallazgos salen de leer firestore.rules; córrela una vez para confirmarlos:
//   npm install --no-save firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.13.0
//   npx firebase emulators:exec --only firestore --project demo-indimon "node tests/auditoria-demuestra-reglas.mjs"
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-indimon',
  firestore: { rules: fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'), host, port: Number(port) },
});

const CEROS = { horas_ordinarias: 0, horas_extras_diurnas: 0, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 0 };
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admins/adm1'), { rol: 'admin' });
  await setDoc(doc(db, 'empleados/111'), { nombre: 'ANA PRUEBA', sueldo_base: 1750905, authUid: 'u111', activo: true });
  await setDoc(doc(db, 'empleados/222'), { nombre: 'BETO PRUEBA', sueldo_base: 1750905, authUid: 'u222', activo: true });
  // Día con 1 h extra que RRHH ya aprobó.
  await setDoc(doc(db, 'empleados/111/registros/2026-11-10'), { fecha: '2026-11-10', entrada: '07:30', salida: '18:00', estado: 'completado', ...CEROS, horas_ordinarias: 8.5, horas_extras_diurnas: 1, extras_estado: 'aprobada', extras_revisada_por: 'rrhh@indimon.com', extras_revisada_en: '2026-11-11T10:00:00.000Z' });
  // Ausencia injustificada que cargó Admin.
  await setDoc(doc(db, 'empleados/111/registros/2026-11-11'), { fecha: '2026-11-11', estado: 'completado', ...CEROS, tipo_permiso: 'Ausencia injustificada' });
  // Salida olvidada: el colaborador declaró la hora y quedó para revisión de Admin.
  await setDoc(doc(db, 'empleados/111/registros/2026-11-12'), { fecha: '2026-11-12', entrada: '07:30', salida: '21:00', estado: 'requiere_revision_admin', ...CEROS, horas_ordinarias: 8.5, horas_extras_diurnas: 2, horas_extras_nocturnas: 2, extras_estado: 'por_aprobar', salida_declarada_por_colaborador: true });
  // Día con una salida a permiso personal que RRHH decidió descontar (2 h).
  await setDoc(doc(db, 'empleados/111/registros/2026-11-13'), { fecha: '2026-11-13', entrada: '07:30', salida: '16:30', estado: 'completado', ...CEROS, horas_ordinarias: 6, horas_permiso_turno: 2, salidas_permiso: [{ motivo: 'Permiso personal', sale: '09:00', vuelve: '11:00' }], decisiones_permiso: { 0: { decision: 'descuenta', por: 'rrhh@indimon.com' } } });
  // Ausencia injustificada de OTRO colaborador.
  await setDoc(doc(db, 'empleados/222/registros/2026-11-11'), { fecha: '2026-11-11', estado: 'completado', ...CEROS, tipo_permiso: 'Ausencia injustificada' });
});

const anon = env.unauthenticatedContext().firestore();
const ana = env.authenticatedContext('u111', { email: 'emp111@indimon-tiempo.app' }).firestore();

let vigentes = 0, corregidos = 0;
// pasa: true si la escritura (o lectura) fue aceptada por las reglas.
const intenta = async (fn) => { try { await fn(); return true; } catch (e) { return false; } };
const hallazgo = async (n, titulo, fn, vigenteSiPasa = true) => {
  const paso = await intenta(fn);
  const vigente = paso === vigenteSiPasa;
  if (vigente) vigentes++; else corregidos++;
  console.log(`${vigente ? '🔴 HALLAZGO VIGENTE' : '🟢 YA CORREGIDO   '} — demuestra el hallazgo ${n}: ${titulo} (las reglas ${paso ? 'lo PERMITEN' : 'lo RECHAZAN'})`);
};

// Hallazgo 3 — el colaborador escribe horas que no trabajó en campos que se pagan sin aprobación.
await hallazgo('3a', 'el colaborador crea un domingo "trabajado" de 9 h sin haber fichado', () =>
  setDoc(doc(ana, 'empleados/111/registros/2026-11-15'), { fecha: '2026-11-15', cedula: '111', estado: 'completado', ...CEROS, horas_ordinarias: 9, horas_dominicales: 9, es_dominical_festivo: true }));
await hallazgo('3b', 'sube sus horas extra de 1 a 11 en un día que RRHH ya aprobó, y sigue "aprobada"', () =>
  updateDoc(doc(ana, 'empleados/111/registros/2026-11-10'), { horas_extras_nocturnas: 10 }));
await hallazgo('3c', 'se aprueba a sí mismo una salida olvidada que esperaba revisión de Admin', () =>
  updateDoc(doc(ana, 'empleados/111/registros/2026-11-12'), { estado: 'completado' }));
await hallazgo('3d', 'borra su propia ausencia injustificada', () =>
  updateDoc(doc(ana, 'empleados/111/registros/2026-11-11'), { tipo_permiso: null }));
await hallazgo('3e', 'pone en 0 las horas del permiso que RRHH decidió descontar (la decisión queda, el descuento da $0)', () =>
  updateDoc(doc(ana, 'empleados/111/registros/2026-11-13'), { horas_permiso_turno: 0 }));
await hallazgo('3f', 'crea un día del 19-oct-2026 (antes de la aprobación de extras) con 15 h extra nocturnas', () =>
  setDoc(doc(ana, 'empleados/111/registros/2026-10-19'), { fecha: '2026-10-19', cedula: '111', estado: 'completado', ...CEROS, horas_extras_nocturnas: 15 }));

// Hallazgo 4 — el colaborador se cambia el sueldo con el que Admin calcula el costo y el valor de los descuentos.
await hallazgo(4, 'el colaborador cambia su propio sueldo base a $9.000.000', () =>
  updateDoc(doc(ana, 'empleados/111'), { sueldo_base: 9000000 }));

// Hallazgo 6 — el aviso de "semana incompleta" nunca sale: el celular del colaborador no puede leer la marca de "ya avisado".
await hallazgo(6, 'el colaborador NO puede leer avisos_semana_incumplida, y por eso el aviso a RRHH nunca se envía', () =>
  getDoc(doc(ana, 'avisos_semana_incumplida/111_2026-11-02')), false);

// Hallazgo 7 — sin sesión: se inventa un permiso "aprobado" de otra persona y con él se tapa su ausencia injustificada.
await intenta(() => setDoc(doc(anon, 'permisos/inventado'), { trabajador: 'BETO PRUEBA', trabajador_cedula: '222', fecha: '2026-11-11', tipo: 'Calamidad doméstica', estado: 'pendiente',
  firmantes: { trabajador: { firmado: true }, jefe: { firmado: true }, supervisor: { firmado: true }, rrhh: { firmado: true } } }));
await intenta(() => updateDoc(doc(anon, 'permisos/inventado'), { estado: 'aprobado' }));
await hallazgo(7, 'alguien sin sesión cambia la ausencia injustificada de otro por un permiso inventado', () =>
  updateDoc(doc(anon, 'empleados/222/registros/2026-11-11'), { tipo_permiso: 'Calamidad doméstica', permiso_id: 'inventado' }));

await env.cleanup();
console.log(`\n${vigentes} hallazgo(s) vigentes, ${corregidos} ya corregido(s). Este archivo es informativo: no falla el CI.`);
process.exit(0);
