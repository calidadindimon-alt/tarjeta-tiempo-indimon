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
const { esDiaDescansoInferido, diasADescontarPorSemana, metaSemanalOrdinaria, etiquetaDescansoRemunerado, motivoAvisoSemanal } = require('./_extraido-descanso.cjs');

const results = [];
// Semana lunes 2026-06-01 a domingo 2026-06-07 (verificada). Sábado = 2026-06-06. horasPorDia[i] = registro del día i (lun=0).
function caso(nombre, fecha, horasPorDia, esperado, primeraFecha, fechasConPermiso) {
  const registrosSemana = horasPorDia.map((h, i) => ({ fecha: `2026-06-0${i + 1}`, horas_ordinarias: h }));
  const obtenido = esDiaDescansoInferido(fecha, registrosSemana, primeraFecha, fechasConPermiso);
  const ok = obtenido === esperado;
  results.push({ nombre, ok });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${esperado}, obtuvo ${obtenido})`}`);
}

// Regla nueva: sábado/domingo = descanso si los 5 días laborales de la semana tienen algún registro (no depende de sumar horas).
caso('1. Sábado sin registro, lun-vie con registro (8.5h) -> Descanso', '2026-06-06', [8.5, 8.5, 8.5, 8.5, 8.5], true);
caso('2. Sábado sin registro, lun-vie con registro aunque sumen solo 40h -> Descanso (ya no depende de las horas)', '2026-06-06', [8, 8, 8, 8, 8], true);
caso('2b. Falta el registro del viernes (hueco sin nada) -> NO es descanso, el hueco queda visible', '2026-06-06', [8, 8, 8, 8], false);
caso('3. Domingo sin registro, semana completa -> Descanso', '2026-06-07', [8.5, 8.5, 8.5, 8.5, 8.5], true);
caso('3b. Falta un día pero tiene permiso/vacaciones ese día -> Descanso', '2026-06-06', [8, 8, 8, 8], true, undefined, new Set(['2026-06-05']));
caso('3c. Semana sin ningún registro -> NO es descanso', '2026-06-06', [], false);
caso('4. Día laboral normal (martes) -> nunca es descanso', '2026-06-02', [999], false);

// Festivo entre semana: 2026-06-08 es Corpus Christi (lunes, verificado) -> SIEMPRE festivo remunerado, aunque no haya ningún registro esa semana.
caso('5. Festivo entre semana sin registro y semana en curso (sin registros todavía) -> Festivo remunerado', '2026-06-08', [], true);
caso('5b. Festivo anterior al primer registro de la persona (antes de su ingreso) -> NO se marca', '2026-06-08', [], false, '2026-06-10');
caso('5c. Festivo el mismo día o después del primer registro -> se marca', '2026-06-08', [], true, '2026-06-08');

// Caso Jhon Freddy: falta injustificada el viernes -> el sábado/domingo NO se infiere como descanso (sanción del Art. 173 CST).
{
  const registrosSemanaJhonFreddy = [
    { fecha: '2026-06-01', horas_ordinarias: 8 },
    { fecha: '2026-06-02', horas_ordinarias: 8 },
    { fecha: '2026-06-03', horas_ordinarias: 8 },
    { fecha: '2026-06-04', horas_ordinarias: 8 },
    { fecha: '2026-06-05', tipo_permiso: 'Ausencia injustificada' },
  ];
  const sab = esDiaDescansoInferido('2026-06-06', registrosSemanaJhonFreddy);
  const dom = esDiaDescansoInferido('2026-06-07', registrosSemanaJhonFreddy);
  const ok6 = sab === false && dom === false;
  results.push({ nombre: '6/7. Semana con falta injustificada -> sábado y domingo NO son descanso', ok: ok6 });
  console.log(`${ok6 ? '✅ PASS' : '❌ FAIL'} — 6/7. Semana con falta injustificada -> sábado y domingo NO son descanso${ok6 ? '' : `  (sábado ${sab}, domingo ${dom})`}`);
  const diasDescontados = diasADescontarPorSemana(registrosSemanaJhonFreddy);
  const ok7b = diasDescontados === 2;
  results.push({ nombre: '7b. Esa misma semana SÍ marca sanción (2 días descontados)', ok: ok7b });
  console.log(`${ok7b ? '✅ PASS' : '❌ FAIL'} — 7b. Esa misma semana SÍ marca sanción (2 días descontados)${ok7b ? '' : `  (esperado 2, obtuvo ${diasDescontados})`}`);
  const festConAusencia = esDiaDescansoInferido('2026-06-08', registrosSemanaJhonFreddy);
  results.push({ nombre: '7c. El festivo entre semana se sigue pagando aunque haya habido ausencia', ok: festConAusencia === true });
  console.log(`${festConAusencia === true ? '✅ PASS' : '❌ FAIL'} — 7c. El festivo entre semana se sigue pagando aunque haya habido ausencia`);
}

// ---------- FASE 1 (Ley 2101/2021, arts. 173, 174 y 177 CST): meta semanal con festivos ----------
// Horario pactado: lun-jue 8,5 h y vie 8,0 h (42 h). Lunes 12/oct/2026 es festivo (Día de la Raza).
function ig(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  results.push({ nombre, ok });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)})`}`);
}
const semanaFestivo = [
  { fecha: '2026-10-13', horas_ordinarias: 8, horas_extras_diurnas: 0.5 },
  { fecha: '2026-10-14', horas_ordinarias: 8, horas_extras_diurnas: 0.5 },
  { fecha: '2026-10-15', horas_ordinarias: 8, horas_extras_diurnas: 0.5 },
  { fecha: '2026-10-16', horas_ordinarias: 8 },
];
ig('8. Meta de la semana con lunes festivo sin trabajar = 33,5 h (no 35, no 42)', metaSemanalOrdinaria('2026-10-14'), 33.5);
ig('9. Semana normal (19-23 oct) = 42 h', metaSemanalOrdinaria('2026-10-21'), 42);
ig('10. Si se TRABAJÓ el festivo, no se descuenta de la meta', metaSemanalOrdinaria('2026-10-14', ['2026-10-12']), 42);
ig('11. Festivo en viernes (2026-12-25 es viernes) descuenta 8,0 h', metaSemanalOrdinaria('2026-12-23'), 34);
ig('12. Lunes festivo sin trabajar -> Festivo remunerado', esDiaDescansoInferido('2026-10-12', semanaFestivo), true);
ig('13. Sábado de esa semana festiva (Mar-Vie con registro) -> Descanso remunerado', esDiaDescansoInferido('2026-10-17', semanaFestivo), true);
ig('14. Semana festiva con el martes sin ningún registro -> NO es descanso', esDiaDescansoInferido('2026-10-17', semanaFestivo.slice(1)), false);
ig('15. Etiqueta del festivo: remunerado, no se repone, meta 33,5', etiquetaDescansoRemunerado('2026-10-12', semanaFestivo, true),
  'Festivo remunerado — no se repone ni se alarga la jornada (meta de la semana: 33,5 h)');
ig('16. Etiqueta del sábado en semana normal', etiquetaDescansoRemunerado('2026-10-24', [{ fecha: '2026-10-19', horas_ordinarias: 8, horas_extras_diurnas: 0.5 }], false).startsWith('Descanso remunerado — trabajó todos los días laborales'), true);

// ---------- Ajustes: la falta NO se tapa con extras; RRHH recibe aviso aunque las extras compensen ----------
const semanaConFaltaCompensada = [
  { fecha: '2026-10-20', tipo_permiso: 'Ausencia injustificada', horas_ordinarias: 0 },
  { fecha: '2026-10-21', horas_ordinarias: 8, horas_extras_diurnas: 2.5 },
  { fecha: '2026-10-22', horas_ordinarias: 8, horas_extras_diurnas: 2.5 },
  { fecha: '2026-10-23', horas_ordinarias: 8, horas_extras_diurnas: 2.5 },
  { fecha: '2026-10-24', horas_ordinarias: 8, horas_extras_diurnas: 2.5 },
];
ig('17. Falta injustificada compensada con extras (42 h en total): el sábado NO es descanso', esDiaDescansoInferido('2026-10-24', semanaConFaltaCompensada.slice(0, 4)), false);
ig('18. Mismo caso: el domingo tampoco es descanso (lo cubre la sanción del art. 173)', esDiaDescansoInferido('2026-10-25', semanaConFaltaCompensada), false);
ig('19. Aviso: ausencia compensada con extras (horas llegan a la meta) -> SÍ avisa', motivoAvisoSemanal(42, 42, 0, 1), { incompleta: false, asunto: 'ausencia o tardanza esta semana', detalle: '1 día(s) de ausencia injustificada' });
ig('20. Aviso: solo tardanza y horas completas -> NO avisa (ahorra correos)', motivoAvisoSemanal(42, 42, 2, 0), null);
ig('21. Aviso: tardanza y semana incompleta -> avisa como incompleta', motivoAvisoSemanal(38, 42, 1, 0).incompleta, true);
ig('22. Aviso: semana sin ausencia ni tardanza -> no avisa', motivoAvisoSemanal(41, 42, 0, 0), null);
ig('23. Aviso: ausencia injustificada y horas incompletas -> avisa', motivoAvisoSemanal(30, 42, 0, 1).incompleta, true);
// Caso real (Jhon Viasus, semana 5-9/oct/2026 en Cali): lun-vie con registro, descansa sábado 10, domingo 11 y lunes 12 (festivo).
const semanaCali = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((fecha) => ({ fecha, horas_ordinarias: 8, horas_extras_diurnas: 0.5 }));
ig('24. Cali: sábado 10/oct sin registro -> Descanso remunerado', esDiaDescansoInferido('2026-10-10', semanaCali, '2026-09-01'), true);
ig('25. Cali: domingo 11/oct sin registro -> Descanso remunerado', esDiaDescansoInferido('2026-10-11', semanaCali, '2026-09-01'), true);
ig('26. Cali: lunes festivo 12/oct, semana aún sin registros -> Festivo remunerado de inmediato', esDiaDescansoInferido('2026-10-12', [], '2026-09-01'), true);

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
