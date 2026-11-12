// AUDITORÍA DE NÓMINA (nov-2026) — demuestra los hallazgos 3 y 4 de docs/auditoria-nomina/INFORME.md.
//
// NO ES UNA PRUEBA DEL CI: no está en .github/workflows/test-jornada.yml y siempre termina sin error. Muestra, en el
// emulador de Firebase (nunca la base real), escrituras que las reglas de firestore.rules HOY aceptan y que cambian lo
// que se paga. Cada línea dice "DEMUESTRA EL HALLAZGO N" mientras el hueco existe y "YA CORREGIDO" cuando las reglas
// lo rechacen.
//
// Uso (necesita Java):
//   npm install --no-save firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.13.0
//   npx firebase emulators:exec --only firestore --project demo-indimon "node tests/auditoria-nomina-reglas.mjs"
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-indimon',
  firestore: { rules: fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'), host, port: Number(port) },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admins/adm1'), { rol: 'admin' });
  await setDoc(doc(db, 'empleados/111'), { nombre: 'ANA PRUEBA', sueldo_base: 1750905, authUid: 'u111', activo: true });
  await setDoc(doc(db, 'empleados/222'), { nombre: 'BETO PRUEBA', sueldo_base: 1750905, authUid: 'u222', activo: true });
  // Martes normal de Ana, ya cerrado, con 1 hora extra que RRHH ya aprobó.
  await setDoc(doc(db, 'empleados/111/registros/2026-11-10'), {
    fecha: '2026-11-10', estado: 'completado', entrada: '07:30', salida: '18:00', horas_ordinarias: 8.5,
    horas_extras_diurnas: 1, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 0,
    extras_estado: 'aprobada', extras_revisada_por: 'rrhh@indimon.com', extras_revisada_en: '2026-11-11T10:00:00Z',
  });
  // Día que Admin marcó como ausencia injustificada de Ana (se descuentan 2 días: el día y el domingo).
  await setDoc(doc(db, 'empleados/111/registros/2026-11-04'), {
    fecha: '2026-11-04', estado: 'completado', tipo_permiso: 'Ausencia injustificada', horas_permiso: 8,
    horas_ordinarias: 0, horas_extras_diurnas: 0, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 0,
  });
  // Día normal trabajado por Beto.
  await setDoc(doc(db, 'empleados/222/registros/2026-11-10'), {
    fecha: '2026-11-10', estado: 'completado', entrada: '07:30', salida: '17:00', horas_ordinarias: 8.5,
    horas_extras_diurnas: 0, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 0,
  });
});

const ana = env.authenticatedContext('u111').firestore();
const anon = env.unauthenticatedContext().firestore();

let abiertos = 0;
async function intento(hallazgo, descripcion, fn) {
  let aceptado = true;
  try { await fn(); } catch (e) { aceptado = false; }
  if (aceptado) abiertos++;
  console.log(`${aceptado ? `⚠️  DEMUESTRA EL HALLAZGO ${hallazgo}` : '✅ YA CORREGIDO'} — ${descripcion}: las reglas ${aceptado ? 'LO ACEPTAN' : 'lo rechazan'}`);
}

console.log('\n--- Hallazgo 3: el propio colaborador, escribiendo directo a la base (sin pasar por la app) ---');
await intento(3, 'subir de 1 a 15 las horas extra de un día que RRHH YA aprobó (el estado sigue "aprobada")',
  () => updateDoc(doc(ana, 'empleados/111/registros/2026-11-10'), { horas_extras_diurnas: 0, horas_extras_nocturnas: 15 }));
await intento(3, 'marcar como "dominicales" y "nocturnas" las 8,5 h de un martes normal (se pagan sin aprobación)',
  () => updateDoc(doc(ana, 'empleados/111/registros/2026-11-10'), { horas_extras_nocturnas: 0, horas_extras_diurnas: 1, horas_dominicales: 8.5, horas_recargo_nocturno: 8.5 }));
await intento(3, 'crear un día del 15-oct-2026 (antes de la aprobación de extras) con 10 extras nocturnas',
  () => setDoc(doc(ana, 'empleados/111/registros/2026-10-15'), { fecha: '2026-10-15', estado: 'completado', horas_ordinarias: 0, horas_extras_diurnas: 0, horas_extras_nocturnas: 10, horas_recargo_nocturno: 0, horas_dominicales: 0 }));
await intento(3, 'crear un domingo "trabajado" completo sin entrada ni salida (9 h ordinarias dominicales, sin GPS ni foto)',
  () => setDoc(doc(ana, 'empleados/111/registros/2026-11-08'), { fecha: '2026-11-08', estado: 'completado', horas_ordinarias: 9, horas_extras_diurnas: 0, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 9, es_dominical_festivo: true }));
await intento(3, 'quitarse la marca de "Ausencia injustificada" que puso Admin (se salva del descuento de 2 días)',
  () => updateDoc(doc(ana, 'empleados/111/registros/2026-11-04'), { tipo_permiso: null, horas_permiso: 0 }));
await intento(3, 'marcarse a sí mismo "entrada temprana autorizada" y "sin almuerzo" en un día ya cerrado',
  () => updateDoc(doc(ana, 'empleados/111/registros/2026-11-10'), { entrada_temprana_autorizada: true, almuerzo_omitido: true, almuerzo_omitido_autoriza: 'JLAF' }));
await intento(3, 'cambiar su propio sueldo base a $9.000.000 (lo usa el costo de mano de obra de Admin)',
  () => updateDoc(doc(ana, 'empleados/111'), { sueldo_base: 9000000 }));

console.log('\n--- Hallazgo 4: cualquier persona SIN sesión, solo con la dirección pública de la base ---');
const FIRMAS = { trabajador: { firmado: true }, jefe: { firmado: true }, supervisor: { firmado: true }, rrhh: { firmado: true } };
await intento(4, 'crear una solicitud de permiso a nombre de Beto (cédula 222)',
  () => setDoc(doc(anon, 'permisos/falso1'), { trabajador: 'BETO PRUEBA', trabajador_cedula: '222', estado: 'pendiente', fecha: '2026-11-12', tipo: 'Permiso personal', firmantes: { trabajador: { firmado: false }, jefe: { firmado: false }, supervisor: { firmado: false }, rrhh: { firmado: false } } }));
await intento(4, 'ponerle las 4 firmas y dejarla "aprobada" en una sola escritura',
  () => updateDoc(doc(anon, 'permisos/falso1'), { firmantes: FIRMAS, estado: 'aprobado', aprobado_en: '2026-11-11T12:00:00Z' }));
await intento(4, 'con ese permiso falso, crearle a Beto un día de "Ausencia injustificada" (le descuenta 2 días de sueldo)',
  () => setDoc(doc(anon, 'empleados/222/registros/2026-11-12'), { fecha: '2026-11-12', cedula: '222', estado: 'completado', tipo_permiso: 'Ausencia injustificada', horas_permiso: 8, permiso_id: 'falso1', horas_ordinarias: 0, horas_extras_diurnas: 0, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, horas_dominicales: 0 }));
await intento(4, 'marcar como "Ausencia injustificada" un día que Beto SÍ trabajó (el próximo recálculo de la semana le pone las horas en cero)',
  () => updateDoc(doc(anon, 'empleados/222/registros/2026-11-10'), { tipo_permiso: 'Ausencia injustificada', horas_permiso: 8, permiso_id: 'falso1' }));

console.log(`\n${abiertos} escritura(s) aceptada(s) por las reglas actuales. Ver docs/auditoria-nomina/INFORME.md, hallazgos 3 y 4.`);
await env.cleanup();
process.exit(0);
