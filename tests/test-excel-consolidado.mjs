// Prueba de regresión de las 3 tablas del export a Excel (Detalle de horas y extras día por día,
// Permisos, Ausencias): confirma que la tabla de horas conserva el detalle diario (no lo resume en un
// total por colaborador — el usuario pidió explícitamente mantener el mismo nivel de detalle que el
// CSV anterior), que Permisos y Ausencias quedan separados correctamente, y que el descuento semanal
// del Art. 173 CST (caso Jhon Freddy) se calcula igual que en el resto de la app dentro de la tabla de
// Ausencias del Excel.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerExcelConsolidado } from './extraer-excel-consolidado.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-excel.cjs');

const fuente = leerFuente(RUTA_INDEX);
fs.writeFileSync(RUTA_EXTRAIDO, extraerExcelConsolidado(fuente));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const { construirFilasDetalleHoras, construirFilasPermisos, construirFilasAusencias } = require('./_extraido-excel.cjs');

const results = [];
function caso(nombre, fn) {
  try {
    fn();
    results.push({ nombre, ok: true });
    console.log(`✅ PASS — ${nombre}`);
  } catch (e) {
    results.push({ nombre, ok: false, error: e.message });
    console.log(`❌ FAIL — ${nombre}  (${e.message})`);
  }
}
function assertEqual(obtenido, esperado, msg) {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg}: esperado ${b}, obtuvo ${a}`);
}

// ---- Detalle de horas: una fila POR DÍA (no resume en un total por colaborador), con las mismas
// columnas que ya traía el CSV anterior, y EXCLUYE los días con tipo_permiso (van en otra tabla) ----
caso('1. Detalle de horas conserva una fila por día, con todas las columnas del CSV anterior', () => {
  const rows = [
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-06-01', estado: 'completado', es_dominical_festivo: false, cliente: 'INDIMON', obra: 'BOGOTA', autoriza: 'JEFE', entrada: '07:00', almuerzo_inicio: '12:00', almuerzo_fin: '13:00', salida: '17:00', horas_ordinarias: 8, horas_extras_diurnas: 2, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0, minutos_tarde: 0, almuerzo_omitido: false, tardanza_justificada: false },
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-06-02', estado: 'completado', horas_ordinarias: 8, horas_extras_diurnas: 1, horas_extras_nocturnas: 0, horas_recargo_nocturno: 0 },
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-06-03', tipo_permiso: 'Incapacidad', horas_permiso: 8 }, // NO debe aparecer aquí
    { cedula: '222', empleado_nombre: 'BEA', fecha: '2026-06-01', estado: 'completado', horas_ordinarias: 8 },
  ];
  const filas = construirFilasDetalleHoras(rows);
  // Orden alfabético por nombre y luego por fecha: ANA (2 días trabajados, sin el permiso) antes que BEA.
  assertEqual(filas.length, 3, 'cantidad de filas (2 días de ANA + 1 de BEA, sin el permiso)');
  assertEqual(filas[0], [
    '111', 'ANA', '2026-06-01', 'NO', 'INDIMON', 'BOGOTA', 'JEFE',
    '07:00', '12:00', '13:00', '17:00', 8, 2, 0, 0, 0, 0,
    'COMPLETADO', 'NO', '', 'NO', '', '',
    '', 'ANTERIOR A LA APROBACION', ''
  ], 'fila completa del día 1 de ANA (extras de antes de la aprobación de RRHH)');
  assertEqual(filas[1][2], '2026-06-02', 'fila del día 2 de ANA (segunda por orden de fecha)');
  assertEqual(filas[2], ['222', 'BEA', '2026-06-01', 'NO', '', '', '', '', '', '', '', 8, 0, 0, 0, 0, 0, 'COMPLETADO', 'NO', '', 'NO', '', '', '', '', ''], 'fila de BEA (sin extras: columnas de extras vacías)');
});

// ---- Permisos: incluye incapacidad/vacaciones pero EXCLUYE las ausencias (van en su propia tabla) ----
caso('2. Permisos excluye ausencias y muestra días para Vacaciones, horas para el resto', () => {
  const rows = [
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-06-03', tipo_permiso: 'Incapacidad', horas_permiso: 8, nota_permiso: 'Gripa' },
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-06-04', tipo_permiso: 'Vacaciones', dias_vacaciones_permiso: 5 },
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-06-05', tipo_permiso: 'Ausencia injustificada' },
  ];
  const filas = construirFilasPermisos(rows);
  assertEqual(filas.length, 2, 'cantidad de filas de permisos (sin la ausencia)');
  assertEqual(filas[0], ['111', 'ANA', '2026-06-03', 'Incapacidad', '8h', 'Gripa'], 'fila de incapacidad');
  assertEqual(filas[1], ['111', 'ANA', '2026-06-04', 'Vacaciones', '5 día(s)', ''], 'fila de vacaciones');
});

// ---- Ausencias: caso real Jhon Freddy — falta injustificada un viernes descuenta 2 días (el día + el domingo) ----
caso('3. Ausencias calcula el descuento semanal del Art. 173 CST (caso Jhon Freddy)', () => {
  // Semana lunes 2026-06-01 a domingo 2026-06-07 (verificada). Viernes = 2026-06-05.
  const rows = [
    { cedula: '333', empleado_nombre: 'JHON FREDDY', estado: 'completado', horas_ordinarias: 8, fecha: '2026-06-01' },
    { cedula: '333', empleado_nombre: 'JHON FREDDY', estado: 'completado', horas_ordinarias: 8, fecha: '2026-06-02' },
    { cedula: '333', empleado_nombre: 'JHON FREDDY', estado: 'completado', horas_ordinarias: 8, fecha: '2026-06-03' },
    { cedula: '333', empleado_nombre: 'JHON FREDDY', estado: 'completado', horas_ordinarias: 8, fecha: '2026-06-04' },
    { cedula: '333', empleado_nombre: 'JHON FREDDY', fecha: '2026-06-05', tipo_permiso: 'Ausencia injustificada' },
  ];
  const filas = construirFilasAusencias(rows);
  assertEqual(filas.length, 1, 'una sola fila de ausencia');
  assertEqual(filas[0], ['333', 'JHON FREDDY', '2026-06-05', 'Ausencia injustificada', '2 día(s) (incluye el domingo, Art. 173 CST)', ''], 'descuento de 2 días para Jhon Freddy');
});

// ---- Ausencia justificada NUNCA descuenta el domingo (conserva el derecho) ----
caso('4. Ausencia justificada no descuenta ningún día', () => {
  const rows = [
    { cedula: '444', empleado_nombre: 'CARLOS', fecha: '2026-06-05', tipo_permiso: 'Ausencia justificada', nota_permiso: 'Cita médica' },
  ];
  const filas = construirFilasAusencias(rows);
  assertEqual(filas[0], ['444', 'CARLOS', '2026-06-05', 'Ausencia justificada', '—', 'Cita médica'], 'sin descuento para ausencia justificada');
});

// Auditoría nov-2026, hallazgo 1: un día con permiso en el que SÍ se trabajó tiene que salir en el detalle de horas
// (con sus horas y extras), y además en su tabla de permisos o de ausencias. Un día 100 % permiso o ausencia no.
caso('5. Detalle de horas incluye los días con permiso que tienen horas trabajadas', () => {
  const rows = [
    // Cita médica de 2,5 h en la mañana; trabajó 10:00–19:00 con 2 h extra que RRHH aprobó.
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-11-10', estado: 'completado', entrada: '10:00', salida: '19:00', horas_ordinarias: 6, horas_extras_diurnas: 2, extras_estado: 'aprobada', tipo_permiso: 'Cita médica (urgencia o especialista)', horas_permiso: 2.5 },
    // Se devolvió a las 11:00: 3,5 h trabajadas.
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-11-11', estado: 'completado', entrada: '07:30', salida: '11:00', horas_ordinarias: 3.5, tipo_permiso: 'Se devolvió', horas_permiso: 5 },
    // Ausencia injustificada con un horario residual digitado: las horas quedaron en 0, no debe salir en el detalle.
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-11-12', estado: 'completado', entrada: '07:30', salida: '17:00', horas_ordinarias: 0, tipo_permiso: 'Ausencia injustificada' },
    // Vacaciones de día completo: tampoco.
    { cedula: '111', empleado_nombre: 'ANA', fecha: '2026-11-13', estado: 'completado', horas_ordinarias: 0, tipo_permiso: 'Vacaciones', dias_vacaciones_permiso: 1 },
  ];
  const filas = construirFilasDetalleHoras(rows);
  assertEqual(filas.map(f => f[2]), ['2026-11-10', '2026-11-11'], 'solo los dos días con horas trabajadas');
  assertEqual([filas[0][11], filas[0][12], filas[0][24]], [6, 2, 'APROBADA'], 'el día de la cita trae sus 6 h ordinarias y 2 h extra aprobadas');
  assertEqual(filas[1][11], 3.5, 'el día que se devolvió trae sus 3,5 h trabajadas');
  // Los permisos siguen saliendo en su tabla, con las horas del permiso.
  assertEqual(construirFilasPermisos(rows).map(f => f[2]), ['2026-11-10', '2026-11-13'], 'la cita y las vacaciones siguen en la tabla de permisos');
  assertEqual(construirFilasAusencias(rows).map(f => f[2]), ['2026-11-11', '2026-11-12'], 'el "se devolvió" y la ausencia siguen en la tabla de ausencias');
});

console.log('\n========== RESUMEN ==========');
const fails = results.filter((r) => !r.ok);
console.log(`${results.length - fails.length} / ${results.length} casos correctos`);
if (fails.length > 0) {
  console.log('\nFALLARON:');
  fails.forEach((f) => console.log(` - ${f.nombre}`));
  process.exit(1);
} else {
  console.log('\nLas 3 tablas del nuevo export a Excel calculan exactamente lo esperado en los casos probados.');
  process.exit(0);
}
