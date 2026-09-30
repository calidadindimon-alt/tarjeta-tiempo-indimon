// Prueba de regresión de esDiaDescansoInferido(): un sábado/domingo/festivo sin ningún registro
// se muestra como "Descanso remunerado" en el historial SOLO si esa semana ya completó las 42
// horas ordinarias legales -así la app no necesita que nadie configure a mano qué obras trabajan
// sábado y cuáles no, y nunca confunde un descanso real con una ausencia.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerDescansoInferido } from './extraer-descanso-inferido.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-descanso.cjs');

const fuente = leerFuente(RUTA_INDEX);
fs.writeFileSync(RUTA_EXTRAIDO, extraerDescansoInferido(fuente));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const { esDiaDescansoInferido, diasADescontarPorSemana } = require('./_extraido-descanso.cjs');

const results = [];
function caso(nombre, fecha, horasPorDia, esperado) {
  const registrosSemana = horasPorDia.map((h) => ({ horas_ordinarias: h }));
  const obtenido = esDiaDescansoInferido(fecha, registrosSemana);
  const ok = obtenido === esperado;
  results.push({ nombre, ok });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${esperado}, obtuvo ${obtenido})`}`);
}

// Semana lunes 2026-06-01 a domingo 2026-06-07 (verificada). Sábado = 2026-06-06.
caso('1. Sábado sin registro, semana completó 42h (lun-vie 8.5h) -> Descanso', '2026-06-06', [8.5, 8.5, 8.5, 8.5, 8.5], true);
caso('2. Sábado sin registro, semana NO completó 42h (lun-vie 8h = 40h) -> NO es descanso', '2026-06-06', [8, 8, 8, 8, 8], false);
caso('3. Domingo sin registro, semana completó 42h -> Descanso', '2026-06-07', [8.5, 8.5, 8.5, 8.5, 8.5], true);
caso('4. Día laboral normal (martes), aunque la semana sume mucho -> nunca es descanso', '2026-06-02', [999], false);

// Festivo entre semana: 2026-06-08 es Corpus Christi (lunes, verificado). Semana lunes 08 a domingo 14.
caso('5. Festivo entre semana sin registro, semana completó 42h -> Descanso', '2026-06-08', [10.5, 10.5, 10.5, 10.5], true);

// Caso Jhon Freddy: falta injustificada el viernes -> esa semana NO llega a 42h -> el sábado NO se
// infiere como descanso (para no taparle el descuento del Art. 173 CST con un "descanso" falso).
caso('6. Semana con falta injustificada (Jhon Freddy) -> sábado NO se infiere como descanso', '2026-06-06', [8, 8, 8, 8, 0], false);

// Caso Jhon Freddy, el domingo de esa misma semana: tampoco se infiere como descanso remunerado (ya
// lo cubre el caso 6), PERO diasADescontarPorSemana() sí debe marcarlo con sanción (2 días: la falta
// + el domingo perdido) -esta es la combinación exacta que usa el historial (personal y admin) para
// decidir si un domingo sin registro se muestra como "Descanso remunerado" o como "sanción".
{
  const registrosSemanaJhonFreddy = [
    { fecha: '2026-06-01', horas_ordinarias: 8 },
    { fecha: '2026-06-02', horas_ordinarias: 8 },
    { fecha: '2026-06-03', horas_ordinarias: 8 },
    { fecha: '2026-06-04', horas_ordinarias: 8 },
    { fecha: '2026-06-05', tipo_permiso: 'Ausencia injustificada' },
  ];
  caso('7. Domingo de la semana de Jhon Freddy -> NO es descanso remunerado', '2026-06-07', [8, 8, 8, 8, 0], false);
  const diasDescontados = diasADescontarPorSemana(registrosSemanaJhonFreddy);
  const ok7b = diasDescontados === 2;
  results.push({ nombre: '7b. Esa misma semana SÍ marca sanción (2 días descontados)', ok: ok7b });
  console.log(`${ok7b ? '✅ PASS' : '❌ FAIL'} — 7b. Esa misma semana SÍ marca sanción (2 días descontados)${ok7b ? '' : `  (esperado 2, obtuvo ${diasDescontados})`}`);
}

console.log('\n========== RESUMEN ==========');
const fails = results.filter((r) => !r.ok);
console.log(`${results.length - fails.length} / ${results.length} casos correctos`);
if (fails.length > 0) {
  console.log('\nFALLARON:');
  fails.forEach((f) => console.log(` - ${f.nombre}`));
  process.exit(1);
} else {
  console.log(`\nesDiaDescansoInferido() y diasADescontarPorSemana() calculan exactamente lo esperado en los ${results.length} casos probados.`);
  process.exit(0);
}
