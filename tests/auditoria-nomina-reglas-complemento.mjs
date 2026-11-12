// AUDITORÍA DE NÓMINA (nov-2026) — COMPLEMENTO de tests/auditoria-nomina-reglas.mjs: tres casos de firestore.rules
// que agregó la segunda revisión (hallazgo 3, puntos 8 y 9, y hallazgo 21 de docs/auditoria-nomina/INFORME.md).
// Corre en el emulador: no toca la base real.
//
// OJO: NO forma parte del CI y NUNCA termina en error.
//   🔴 HALLAZGO VIGENTE -> las reglas se comportan como dice el informe.     🟢 YA CORREGIDO -> ya no.
//
// IMPORTANTE: al escribir el informe esta prueba NO se pudo ejecutar (el equipo de la segunda revisión no tenía Java,
// que el emulador necesita). Estos tres casos salen de leer firestore.rules; córrela una vez para confirmarlos:
//   npm install --no-save firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.13.0
//   npx firebase emulators:exec --only firestore --project demo-indimon "node tests/auditoria-nomina-reglas-complemento.mjs"
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
  // Salida olvidada: el colaborador declaró la hora y quedó para revisión de Admin.
  await setDoc(doc(db, 'empleados/111/registros/2026-11-12'), { fecha: '2026-11-12', entrada: '07:30', salida: '21:00', estado: 'requiere_revision_admin', ...CEROS, horas_ordinarias: 8.5, horas_extras_diurnas: 2, horas_extras_nocturnas: 2, extras_estado: 'por_aprobar', salida_declarada_por_colaborador: true });
  // Día con una salida a permiso personal que RRHH decidió descontar (2 h).
  await setDoc(doc(db, 'empleados/111/registros/2026-11-13'), { fecha: '2026-11-13', entrada: '07:30', salida: '16:30', estado: 'completado', ...CEROS, horas_ordinarias: 6, horas_permiso_turno: 2, salidas_permiso: [{ motivo: 'Permiso personal', sale: '09:00', vuelve: '11:00' }], decisiones_permiso: { 0: { decision: 'descuenta', por: 'rrhh@indimon.com' } } });
});

const ana = env.authenticatedContext('u111', { email: 'emp111@indimon-tiempo.app' }).firestore();

let vigentes = 0, corregidos = 0;
const intenta = async (fn) => { try { await fn(); return true; } catch (e) { return false; } };
// vigenteSiPasa: true si el problema es que las reglas ACEPTAN; false si el problema es que RECHAZAN.
const hallazgo = async (n, titulo, fn, vigenteSiPasa = true) => {
  const paso = await intenta(fn);
  const vigente = paso === vigenteSiPasa;
  if (vigente) vigentes++; else corregidos++;
  console.log(`${vigente ? '🔴 HALLAZGO VIGENTE' : '🟢 YA CORREGIDO   '} — demuestra el hallazgo ${n}: ${titulo} (las reglas ${paso ? 'lo PERMITEN' : 'lo RECHAZAN'})`);
};

await hallazgo('3 (punto 8)', 'el colaborador pasa a "completado" su salida olvidada, que esperaba revisión de Admin', () =>
  updateDoc(doc(ana, 'empleados/111/registros/2026-11-12'), { estado: 'completado' }));
await hallazgo('3 (punto 9)', 'pone en 0 las horas del permiso que RRHH decidió descontar (la decisión queda, el descuento da $0)', () =>
  updateDoc(doc(ana, 'empleados/111/registros/2026-11-13'), { horas_permiso_turno: 0 }));
// Hallazgo 21: verificarCumplimientoSemanal lee esta marca desde el celular del colaborador antes de enviar el correo.
// Si la lectura se rechaza, la función termina ahí y el aviso a RRHH nunca sale.
await hallazgo(21, 'el colaborador NO puede leer avisos_semana_incumplida, y por eso el aviso a RRHH no se envía', () =>
  getDoc(doc(ana, 'avisos_semana_incumplida/111_2026-11-02')), false);

await env.cleanup();
console.log(`\n${vigentes} hallazgo(s) vigentes, ${corregidos} ya corregido(s). Este archivo es informativo: no falla el CI.`);
process.exit(0);
