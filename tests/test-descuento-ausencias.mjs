// Prueba de regresión del descuento legal por ausencia injustificada (Art. 173 CST): quien falta
// sin justificar un día de la semana pierde también el pago del domingo de esa semana — una sola
// falta injustificada descuenta 2 días (el día + el domingo).
//
// Igual que test-jornada-diaria.mjs: extrae el código real de index.html en cada corrida, nunca
// reimplementa la lógica a mano.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerDescuentoAusencias } from './extraer-descuento-ausencias.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-descuento.cjs');

const fuente = leerFuente(RUTA_INDEX);
fs.writeFileSync(RUTA_EXTRAIDO, extraerDescuentoAusencias(fuente));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const { calcularDiasDescontadosPorAusenciasMes } = require('./_extraido-descuento.cjs');

const results = [];
function caso(nombre, registros, mesPrefix, esperado) {
  const obtenido = calcularDiasDescontadosPorAusenciasMes(registros, mesPrefix);
  const ok = obtenido === esperado;
  results.push({ nombre, ok });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${esperado}, obtuvo ${obtenido})`}`);
}

// Semana lunes 2026-06-01 a domingo 2026-06-07 (verificada: Jun 1 es lunes).
const semanaNormal = (extra) => ([
  { fecha: '2026-06-01' }, { fecha: '2026-06-02' }, { fecha: '2026-06-03' }, { fecha: '2026-06-04' },
  ...extra,
]);

// ---------------------------------------------------------------
// 1. Caso real: Jhon Freddy falta el viernes sin justificar -> 2 días descontados (día + domingo)
// ---------------------------------------------------------------
caso(
  '1. Falta injustificada un viernes -> 2 días (Jhon Freddy)',
  semanaNormal([{ fecha: '2026-06-05', tipo_permiso: 'Ausencia injustificada' }]),
  '2026-06',
  2
);

// ---------------------------------------------------------------
// 2. Dos días de ausencia injustificada en la misma semana -> 3 días (2 días + 1 solo domingo)
// ---------------------------------------------------------------
caso(
  '2. Dos ausencias injustificadas en la misma semana -> 3 días (el domingo se pierde una sola vez)',
  semanaNormal([
    { fecha: '2026-06-04', tipo_permiso: 'Ausencia injustificada' },
    { fecha: '2026-06-05', tipo_permiso: 'Ausencia injustificada' },
  ]),
  '2026-06',
  3
);

// ---------------------------------------------------------------
// 3. Ausencia JUSTIFICADA (incapacidad, calamidad, permiso autorizado) -> NO pierde el domingo
// ---------------------------------------------------------------
caso(
  '3. Ausencia justificada -> 0 días (conserva el derecho al domingo)',
  semanaNormal([{ fecha: '2026-06-05', tipo_permiso: 'Ausencia justificada' }]),
  '2026-06',
  0
);

// ---------------------------------------------------------------
// 4. Semana sin ninguna ausencia -> 0 días
// ---------------------------------------------------------------
caso(
  '4. Semana completa sin faltas -> 0 días',
  semanaNormal([{ fecha: '2026-06-05' }]),
  '2026-06',
  0
);

// ---------------------------------------------------------------
// 5. Semana que cruza el límite de mes: el descuento se atribuye al mes del DOMINGO, no al mes
//    donde cayó el día faltado. Semana lunes 2026-06-29 a domingo 2026-07-05.
// ---------------------------------------------------------------
const semanaCruzaMes = [
  { fecha: '2026-06-29' },
  { fecha: '2026-06-30', tipo_permiso: 'Ausencia injustificada' }, // falta en junio
  { fecha: '2026-07-01' }, { fecha: '2026-07-02' }, { fecha: '2026-07-03' },
];
caso('5a. Semana cruza mes -> NO se descuenta de junio (el domingo cae en julio)', semanaCruzaMes, '2026-06', 0);
caso('5b. Semana cruza mes -> SÍ se descuenta de julio (ahí cae el domingo perdido)', semanaCruzaMes, '2026-07', 2);

console.log('\n========== RESUMEN ==========');
const fails = results.filter((r) => !r.ok);
console.log(`${results.length - fails.length} / ${results.length} casos correctos`);
if (fails.length > 0) {
  console.log('\nFALLARON:');
  fails.forEach((f) => console.log(` - ${f.nombre}`));
  process.exit(1);
} else {
  console.log('\nEl descuento del Art. 173 CST calcula exactamente lo esperado en los 6 casos probados.');
  process.exit(0);
}
