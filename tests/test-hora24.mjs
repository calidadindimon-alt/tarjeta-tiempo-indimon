// Prueba de las funciones que interpretan las horas en formato 24 horas (13:00, 17:30) de los campos de hora.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente, bloqueBalanceado } from './extraer-calculadora.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const fuente = leerFuente(process.argv[2] || join(DIR, '..', 'index.html'));
const ruta = join(DIR, '_extraido-hora24.cjs');
fs.writeFileSync(ruta, ['"use strict";', bloqueBalanceado(fuente, 'function normalizarHora24(texto) {'), bloqueBalanceado(fuente, 'function formatearHoraEscribiendo(texto) {'),
  'module.exports = { normalizarHora24, formatearHoraEscribiendo };'].join('\n\n'));
const require = createRequire(import.meta.url);
delete require.cache[ruta];
const { normalizarHora24, formatearHoraEscribiendo } = require('./_extraido-hora24.cjs');

const results = [];
function ig(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  results.push({ nombre, ok });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)})`}`);
}
ig('1. Horas completas en 24 h se respetan', ['07:30', '13:00', '17:30', '00:00', '23:59'].map(normalizarHora24), ['07:30', '13:00', '17:30', '00:00', '23:59']);
ig('2. Sin los dos puntos: 1730, 730, 0700', ['1730', '730', '0700'].map(normalizarHora24), ['17:30', '07:30', '07:00']);
ig('3. Solo la hora: 7, 13 -> en punto', ['7', '13'].map(normalizarHora24), ['07:00', '13:00']);
ig('4. Con a. m. / p. m.: 5:30 pm, 5:30 p. m., 12:15 am, 12:00 pm', ['5:30 pm', '5:30 p. m.', '12:15 am', '12:00 pm'].map(normalizarHora24), ['17:30', '17:30', '00:15', '12:00']);
ig('5. Horas imposibles o vacías -> vacío', ['25:00', '12:60', '', '   ', 'abc', '12345', '24:00'].map(normalizarHora24), ['', '', '', '', '', '', '']);
ig('6. Al escribir se forma HH:MM solo', ['1', '17', '173', '1730', '17305', '1a7b3c0'].map(formatearHoraEscribiendo), ['1', '17', '17:3', '17:30', '17:30', '17:30']);
ig('7. Los dos puntos escritos a mano no estorban', formatearHoraEscribiendo('17:'), '17');

console.log('\n========== RESUMEN ==========');
const fails = results.filter(r => !r.ok);
console.log(`${results.length - fails.length} / ${results.length} casos correctos`);
process.exit(fails.length ? 1 : 0);
