// Prueba de regresión: un permiso por HORAS aprobado antes de su fecha crea ese día un registro "completado"
// vacío. Ese registro NO debe bloquear el fichaje de entrada (caso Doris Cruz, 16/10/2026), pero las
// vacaciones, las ausencias y los permisos de un día completo siguen bloqueando como antes.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerRegistroPermiso } from './extraer-registro-permiso.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-registro-permiso.cjs');
fs.writeFileSync(RUTA_EXTRAIDO, extraerRegistroPermiso(leerFuente(RUTA_INDEX)));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const m = require('./_extraido-registro-permiso.cjs');

const results = [];
function ig(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  results.push({ nombre, ok });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)})`}`);
}

const vacio = { fecha: '2026-10-16', estado: 'completado', entrada: null, salida: null, tipo_permiso: 'Cita médica (urgencia o especialista)', horas_permiso: 2, horas_ordinarias: 0, horas_extras_diurnas: 0, horas_extras_nocturnas: 0, permiso_id: 'abc' };

ig('1. Registro vacío de un permiso por horas (2 h) -> se reconoce como "solo permiso parcial"', m.esRegistroSoloPermisoParcial(vacio), true);
ig('2. Permiso de 8 h (día completo) -> sigue bloqueando', m.esRegistroSoloPermisoParcial({ ...vacio, horas_permiso: 8 }), false);
ig('3. Vacaciones -> sigue bloqueando', m.esRegistroSoloPermisoParcial({ ...vacio, tipo_permiso: 'Vacaciones', horas_permiso: 0 }), false);
ig('4. Ausencia injustificada -> sigue bloqueando', m.esRegistroSoloPermisoParcial({ ...vacio, tipo_permiso: 'Ausencia injustificada' }), false);
ig('5. Ya tiene entrada (turno real) -> no es el registro vacío', m.esRegistroSoloPermisoParcial({ ...vacio, entrada: '07:30', estado: 'activo' }), false);
ig('6. Día completado con horas trabajadas y un permiso -> no es el registro vacío', m.esRegistroSoloPermisoParcial({ ...vacio, entrada: '07:30', salida: '17:00', horas_ordinarias: 8 }), false);
ig('7. Sin registro (null) -> false', m.esRegistroSoloPermisoParcial(null), false);

await (async () => {
  m.poner(vacio);
  await m.checkTodayState();
  ig('8. Pantalla de fichaje con el registro vacío del permiso -> muestra ENTRADA (no "completado")', m.llamadas[0][0], 'entrada');
  m.poner({ ...vacio, horas_permiso: 8 });
  await m.checkTodayState();
  ig('9. Permiso de un día completo -> sigue mostrando "completado"', m.llamadas[0][0], 'completado');
  m.poner({ ...vacio, entrada: '07:30', salida: '17:00', horas_ordinarias: 8, horas_permiso: 2 });
  await m.checkTodayState();
  ig('10. Día ya trabajado y cerrado (con un permiso) -> sigue mostrando "completado"', m.llamadas[0][0], 'completado');
  m.poner({ fecha: '2026-10-16', estado: 'activo', entrada: '07:30', almuerzo_inicio: '12:00' });
  await m.checkTodayState();
  ig('11. Turno activo en almuerzo -> sigue mostrando "almuerzo"', m.llamadas[0][0], 'almuerzo');
  m.poner(null);
  await m.checkTodayState();
  ig('12. Sin registro -> muestra entrada', m.llamadas[0][0], 'entrada');
})();

console.log('\n========== RESUMEN ==========');
const fails = results.filter((r) => !r.ok);
console.log(`${results.length - fails.length} / ${results.length} casos correctos`);
if (fails.length > 0) { fails.forEach((f) => console.log(` - ${f.nombre}`)); process.exit(1); }
process.exit(0);
