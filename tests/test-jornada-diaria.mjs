// Prueba de regresión de calcularJornadaDiaria() — la función que liquida cada día de nómina.
//
// No reimplementa la función: la EXTRAE textualmente del index.html real en cada corrida (ver
// extraer-calculadora.mjs) y prueba esa copia exacta. Si alguien cambia la lógica de horas en el
// futuro, esta prueba corre en segundos (`node tests/test-jornada-diaria.mjs`) y avisa antes de
// que un cálculo equivocado llegue a la nómina de un colaborador real.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente, extraerCalculadora } from './extraer-calculadora.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido.cjs');

const fuente = leerFuente(RUTA_INDEX);
fs.writeFileSync(RUTA_EXTRAIDO, extraerCalculadora(fuente));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const { calcularJornadaDiaria, setCatalogosCache } = require('./_extraido.cjs');

const results = [];
function aprox(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }

function caso(nombre, { catalogos = {}, reg, tope = 8 }, esperado) {
  setCatalogosCache({ horarios_obra: {}, festivos: [], ...catalogos });
  const r = calcularJornadaDiaria(reg, tope);
  const campos = ['ord', 'extD', 'extN', 'recNoct', 'dominical', 'horas_dominicales', 'minutosTarde', 'horasDescontadasTardanza'];
  const diffs = [];
  for (const campo of campos) {
    const a = r[campo], e = esperado[campo];
    const ok = typeof e === 'boolean' ? a === e : aprox(a, e);
    if (!ok) diffs.push(`${campo}: esperado ${e}, obtuvo ${a}`);
  }
  const ok = diffs.length === 0;
  results.push({ nombre, ok, diffs, obtenido: r });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}`);
  if (!ok) diffs.forEach((d) => console.log(`      ${d}`));
}

// ---------------------------------------------------------------
// 1. Día normal, almuerzo asumido de 1h (nadie marcó almuerzo real)
// ---------------------------------------------------------------
caso('1. Jornada normal 7am-4pm, almuerzo asumido', {
  reg: { fecha: '2026-06-01', entrada: '07:00', salida: '16:00' },
}, { ord: 8, extD: 0, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 2. Jornada larga -> genera horas extra diurnas
// ---------------------------------------------------------------
caso('2. Jornada 7am-6pm -> 2h extra diurnas', {
  reg: { fecha: '2026-06-01', entrada: '07:00', salida: '18:00' },
}, { ord: 8, extD: 2, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 3. Turno nocturno completo cruzando medianoche (bug de la "madrugada")
// ---------------------------------------------------------------
caso('3. Turno nocturno 8pm-4am, cruza medianoche', {
  reg: { fecha: '2026-06-01', entrada: '20:00', salida: '04:00' },
}, { ord: 7, extD: 0, extN: 0, recNoct: 7, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 4. Domingo con horas extra -> el recargo dominical se acumula con el de extra (Art. 179 CST)
// ---------------------------------------------------------------
caso('4. Domingo 7am-7pm -> dominical se paga sobre ordinarias Y extra', {
  reg: { fecha: '2026-06-07', entrada: '07:00', salida: '19:00' },
}, { ord: 8, extD: 4, extN: 0, recNoct: 0, dominical: true, horas_dominicales: 12, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 5. Tardanza: se detecta y queda informativa, pero YA NO se descuenta del pago del día
// ---------------------------------------------------------------
caso('5. Llega 40min tarde -> tardanza informativa, ord NO se descuenta', {
  catalogos: { horarios_obra: { 'OBRA TEST': '07:00' } },
  reg: { fecha: '2026-01-19', obra: 'OBRA TEST', entrada: '07:40', salida: '16:00' },
}, { ord: 7.33, extD: 0, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 40, horasDescontadasTardanza: 0.67 });

// ---------------------------------------------------------------
// 6. Llega temprano -> no se paga tiempo no autorizado antes de la hora oficial
// ---------------------------------------------------------------
caso('6. Llega 30min antes -> no infla las horas pagadas', {
  catalogos: { horarios_obra: { 'OBRA TEST': '07:00' } },
  reg: { fecha: '2026-01-19', obra: 'OBRA TEST', entrada: '06:30', salida: '15:00' },
}, { ord: 7, extD: 0, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 7. Almuerzo real marcado (1h exacta) -> se descuenta lo marcado, no el legal a ciegas
// ---------------------------------------------------------------
caso('7. Almuerzo real de 12 a 1pm', {
  reg: { fecha: '2026-06-02', entrada: '07:00', salida: '17:00', almuerzo_inicio: '12:00', almuerzo_fin: '13:00' },
}, { ord: 8, extD: 1, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 8. Almuerzo demasiado corto (10 min, dos toques por error) -> se ignora, aplica el legal (bug C1)
// ---------------------------------------------------------------
caso('8. Almuerzo de 10min se ignora, aplica el legal de 1h', {
  reg: { fecha: '2026-06-02', entrada: '07:00', salida: '16:00', almuerzo_inicio: '12:00', almuerzo_fin: '12:10' },
}, { ord: 8, extD: 0, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 9. Almuerzo invertido (fin antes que inicio, error de digitación) -> se descarta (bug A1)
// ---------------------------------------------------------------
caso('9. Almuerzo invertido (13:00 -> 12:00) se descarta', {
  reg: { fecha: '2026-06-02', entrada: '07:00', salida: '16:00', almuerzo_inicio: '13:00', almuerzo_fin: '12:00' },
}, { ord: 8, extD: 0, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 10. Sin entrada o sin salida -> día sin liquidar, todo en cero
// ---------------------------------------------------------------
caso('10a. Sin hora de entrada', {
  reg: { fecha: '2026-06-01', entrada: null, salida: '16:00' },
}, { ord: 0, extD: 0, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

caso('10b. Sin hora de salida', {
  reg: { fecha: '2026-06-01', entrada: '07:00', salida: null },
}, { ord: 0, extD: 0, extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 11. Recargo nocturno ORDINARIO (parte de la jornada normal cae de noche, sin ser turno completo)
// ---------------------------------------------------------------
caso('11. Turno 2pm-10pm -> 3h de recargo nocturno ordinario', {
  reg: { fecha: '2026-06-01', entrada: '14:00', salida: '22:00' },
}, { ord: 7, extD: 0, extN: 0, recNoct: 3, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 12. Horas EXTRA que caen en horario nocturno (75% recargo extra nocturna)
// ---------------------------------------------------------------
caso('12. Turno 10am-9pm -> 2h extra nocturnas', {
  reg: { fecha: '2026-06-01', entrada: '10:00', salida: '21:00' },
}, { ord: 8, extD: 0, extN: 2, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 });

// ---------------------------------------------------------------
// 13+. Clasificación por SEMANA: ordinarias hasta la meta semanal (tope diario de 9 h), extras solo lo que pase
// ---------------------------------------------------------------
const CERO = { extN: 0, recNoct: 0, dominical: false, horas_dominicales: 0, minutosTarde: 0, horasDescontadasTardanza: 0 };
caso('13. Día de 8,5 h con meta semanal por cumplir (quedan 33,5 h) -> 8,5 ordinarias, 0 extras', {
  reg: { fecha: '2026-10-13', entrada: '07:30', salida: '17:00', almuerzo_inicio: '12:00', almuerzo_fin: '13:00' }, tope: 33.5,
}, { ord: 8.5, extD: 0, ...CERO });
caso('14. Día de 10 h con meta por cumplir -> máximo 9 ordinarias por día, 1 extra', {
  reg: { fecha: '2026-10-13', entrada: '07:00', salida: '18:00', almuerzo_inicio: '12:00', almuerzo_fin: '13:00' }, tope: 42,
}, { ord: 9, extD: 1, ...CERO });
caso('15. Quedan 8 h de meta y se trabajan 8,5 -> 8 ordinarias y 0,5 extra', {
  reg: { fecha: '2026-10-16', entrada: '07:30', salida: '17:00', almuerzo_inicio: '12:00', almuerzo_fin: '13:00' }, tope: 8,
}, { ord: 8, extD: 0.5, ...CERO });
caso('16. Meta semanal ya cumplida -> todo el día (sábado de 4 h) es extra', {
  reg: { fecha: '2026-10-17', entrada: '07:00', salida: '11:00' }, tope: 0,
}, { ord: 0, extD: 4, ...CERO });

// Semana completa, día por día, igual que se guarda al marcar cada salida (acumulando lo ordinario ya usado).
function semana(meta, dias) {
  let acum = 0, ord = 0, ext = 0;
  for (const [fecha, entrada, salida] of dias) {
    setCatalogosCache({ horarios_obra: {}, festivos: [] });
    const r = calcularJornadaDiaria({ fecha, entrada, salida, almuerzo_inicio: '12:00', almuerzo_fin: '13:00' }, meta - acum);
    acum += r.ord; ord += r.ord; ext += r.extD + r.extN;
  }
  return { ord: Math.round(ord * 100) / 100, ext: Math.round(ext * 100) / 100 };
}
function casoSemana(nombre, meta, dias, esperado) {
  const o = semana(meta, dias);
  const ok = aprox(o.ord, esperado.ord) && aprox(o.ext, esperado.ext);
  results.push({ nombre, ok, diffs: [], obtenido: o });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(o)})`}`);
}
casoSemana('17. Semana normal 8,5 h lun-jue + 8 h vie (42 h) -> 42 ordinarias, 0 extras', 42,
  [['2026-10-19', '07:30', '17:00'], ['2026-10-20', '07:30', '17:00'], ['2026-10-21', '07:30', '17:00'], ['2026-10-22', '07:30', '17:00'], ['2026-10-23', '07:30', '16:30']],
  { ord: 42, ext: 0 });
casoSemana('18. Semana con lunes festivo (meta 33,5) y 33,5 h trabajadas -> 33,5 ordinarias, 0 extras', 33.5,
  [['2026-10-13', '07:30', '17:00'], ['2026-10-14', '07:30', '17:00'], ['2026-10-15', '07:30', '17:00'], ['2026-10-16', '07:30', '16:30']],
  { ord: 33.5, ext: 0 });
casoSemana('19. Semana con tardanza (menos de la meta) -> todo ordinario, sin extras inventadas', 42,
  [['2026-10-19', '08:00', '17:00'], ['2026-10-20', '07:30', '17:00'], ['2026-10-21', '07:30', '17:00'], ['2026-10-22', '07:30', '17:00'], ['2026-10-23', '07:30', '16:30']],
  { ord: 41.5, ext: 0 });
casoSemana('20. Obra con sábado: lun-vie 8,5 h + sábado 7:00-14:00 (6 h netas) = 48,5 h -> 42 ordinarias y 6,5 extras (lo que pasa de la meta)', 42,
  [['2026-10-19', '07:00', '16:30'], ['2026-10-20', '07:00', '16:30'], ['2026-10-21', '07:00', '16:30'], ['2026-10-22', '07:00', '16:30'], ['2026-10-23', '07:00', '16:30'], ['2026-10-24', '07:00', '14:00']],
  { ord: 42, ext: 6.5 });

console.log('\n========== RESUMEN ==========');
const fails = results.filter((r) => !r.ok);
console.log(`${results.length - fails.length} / ${results.length} casos correctos`);
if (fails.length > 0) {
  console.log('\nFALLARON:');
  fails.forEach((f) => console.log(` - ${f.nombre}`));
  process.exit(1);
} else {
  console.log(`\ncalcularJornadaDiaria() sigue calculando exactamente lo esperado en los ${results.length} casos probados.`);
  process.exit(0);
}
