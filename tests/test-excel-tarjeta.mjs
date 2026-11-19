// Prueba de la hoja "Tarjeta de Tiempo" que se agrega al Excel del Consolidado (nov-2026): una hoja por colaborador,
// la tardanza solo como dato (no se descuenta dos veces), permisos y ausencias contados con números y las extras
// separadas por todos sus estados. Usa ExcelJS de verdad (npm install --no-save exceljs@4.4.0).
// Uso: node tests/test-excel-tarjeta.mjs [ruta/index.html] [ruta/salida.xlsx]
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerTarjetaTiempo } from './extraer-excel-consolidado.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const SALIDA = process.argv[3] || null;
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-tarjeta.cjs');
fs.writeFileSync(RUTA_EXTRAIDO, extraerTarjetaTiempo(leerFuente(RUTA_INDEX)));
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { datosTarjetaColaborador, construirLibroConsolidado, nombreHojaTarjeta } = require(RUTA_EXTRAIDO);

const res = [];
const caso = (nombre, cond, det = '') => { res.push(!!cond); console.log(`${cond ? '✅' : '❌'} ${nombre}${!cond && det ? ' — ' + det : ''}`); };

const base = { cliente: 'INDIMON S.A.S.', obra: 'BODEGA', autoriza: 'JLAF', estado: 'completado', horas_recargo_nocturno: 0, horas_dominicales: 0, horas_extras_nocturnas: 0 };
const ana = (o) => ({ ...base, cedula: '111', empleado_nombre: 'ANA PRUEBA', ...o });
const rows = [
  ana({ fecha: '2026-11-03', entrada: '07:00', salida: '18:30', almuerzo_inicio: '12:00', almuerzo_fin: '13:00', horas_ordinarias: 8.5, horas_extras_diurnas: 1.5, extras_estado: 'aprobada', extras_autoriza: 'JLAF' }),
  // Llega a las 9:00: la app ya le cuenta 7 h ordinarias (no 8,5). La hoja NO debe volver a restar los 90 minutos.
  ana({ fecha: '2026-11-04', entrada: '09:00', salida: '18:30', almuerzo_inicio: '12:00', almuerzo_fin: '13:00', horas_ordinarias: 7, horas_extras_diurnas: 1.5, minutos_tarde: 90, extras_estado: 'por_aprobar' }),
  ana({ fecha: '2026-11-05', entrada: '07:00', salida: '19:30', almuerzo_inicio: '12:00', almuerzo_fin: '13:00', horas_ordinarias: 8.5, horas_extras_diurnas: 2, horas_extras_nocturnas: 0.5, horas_recargo_nocturno: 0.5, extras_estado: 'por_compensar' }),
  ana({ fecha: '2026-11-06', entrada: '07:40', salida: '17:30', horas_ordinarias: 7.8, horas_extras_diurnas: 1, minutos_tarde: 10, tardanza_justificada: true, motivo_justificacion: 'Bus varado', extras_estado: 'no_autorizada' }),
  ana({ fecha: '2026-10-14', entrada: '07:00', salida: '18:00', almuerzo_inicio: '12:00', almuerzo_fin: '13:00', horas_ordinarias: 8.5, horas_extras_diurnas: 1 }), // antes del 21-oct: "anterior"
  ana({ fecha: '2026-11-09', tipo_permiso: 'Cita médica', horas_permiso: 2, entrada: '07:00', salida: '15:00', almuerzo_omitido: true, horas_ordinarias: 6.5, horas_extras_diurnas: 0 }),
  ana({ fecha: '2026-11-17', tipo_permiso: 'Vacaciones', dias_vacaciones_permiso: 5, horas_ordinarias: 0, horas_extras_diurnas: 0, entrada: null, salida: null }),
  ana({ fecha: '2026-11-10', tipo_permiso: 'Ausencia injustificada', horas_ordinarias: 0, horas_extras_diurnas: 0, entrada: null, salida: null }),
  ana({ fecha: '2026-11-11', tipo_permiso: 'Ausencia injustificada', horas_ordinarias: 0, horas_extras_diurnas: 0, entrada: null, salida: null }),
  ana({ fecha: '2026-11-12', entrada: '07:00', salida: '16:30', almuerzo_inicio: '12:00', almuerzo_fin: '13:00', horas_ordinarias: 6.5, horas_permiso_turno: 2, horas_extras_diurnas: 0,
    salidas_permiso: [{ motivo: 'Permiso personal', sale: '08:00', vuelve: '10:00' }], decisiones_permiso: { 0: { decision: 'descuenta' } } }),
  ana({ fecha: '2026-11-13', entrada: '07:00', salida: null, estado: 'requiere_revision_admin', horas_ordinarias: 0, horas_extras_diurnas: 0, nota_revision: 'Salida olvidada' }),
  { ...base, cedula: '222', empleado_nombre: 'BETO PRUEBA', fecha: '2026-11-03', entrada: '07:00', salida: '17:00', horas_ordinarias: 8.5, horas_extras_diurnas: 0 },
];

// ---- Datos que calcula la app (no fórmulas) ----
const dA = datosTarjetaColaborador(rows.filter(r => r.cedula === '111'));
const nv = dA.novedades;
caso('Nombre, cédula y periodo del colaborador correcto', dA.nombre === 'ANA PRUEBA' && dA.cedula === '111' && dA.desde === '2026-10-14' && dA.hasta === '2026-11-17', JSON.stringify([dA.nombre, dA.desde, dA.hasta]));
caso('Permisos por horas: 2 h (cita médica), en número', nv.permisosHoras === 2, nv.permisosHoras);
caso('Permisos de varios días: 5 días (vacaciones), en número', nv.permisosDias === 5, nv.permisosDias);
caso('2 ausencias injustificadas en la misma semana = 3 días (con el domingo, una sola vez)', nv.ausencias === 2 && nv.diasArt173 === 3, `${nv.ausencias} / ${nv.diasArt173}`);
caso('Salida dentro del turno: 2 h, y RRHH decidió descontar 2 h', nv.salidasHoras === 2 && nv.salidasDescuentan === 2 && nv.salidasSinDecidir === 0, JSON.stringify(nv));
caso('Almuerzo omitido sin autorización: 1', nv.almuerzosSinAutorizar === 1);
caso('Días por revisar: 1', nv.diasPorRevisar === 1);
caso('Registro diario: solo días trabajados (sin vacaciones ni ausencias)', dA.dias.length === 8, dA.dias.length);

// ---- Libro completo ----
const wb = construirLibroConsolidado(ExcelJS, rows, 'Mes: 2026-11');
const nombres = wb.worksheets.map(w => w.name);
caso('Libro: Consolidado + una hoja por colaborador', JSON.stringify(nombres) === JSON.stringify(['Consolidado', 'ANA PRUEBA', 'BETO PRUEBA']), JSON.stringify(nombres));
const ws = wb.getWorksheet('ANA PRUEBA');
let filaTot = 0, celdas = {};
ws.eachRow((row, r) => row.eachCell((c, k) => { const t = typeof c.value === 'object' && c.value?.formula ? '=' + c.value.formula : c.value; celdas[`${String.fromCharCode(64 + k)}${r}`] = t; if (t === 'TOTALES') filaTot = r; }));
const buscar = (texto) => Object.entries(celdas).find(([, v]) => v === texto)?.[0];
const vecina = (texto, col) => { const d = buscar(texto); return d ? celdas[`${col}${d.slice(1)}`] : undefined; };
caso('Hoja con el nombre y la cédula reales (no los del primero de la lista)', celdas.C4 === 'ANA PRUEBA' && celdas.C5 === '111');
caso('Totales con fórmula SUM', filaTot > 0 && /^=SUM\(K10:K\d+\)$/.test(celdas[`K${filaTot}`]), celdas[`K${filaTot}`]);
caso('La tardanza NO se resta de las horas ordinarias', vecina('Horas ordinarias trabajadas', 'S') === `=K${filaTot}` && !Object.values(celdas).some(v => typeof v === 'string' && /NETAS/.test(v)));
caso('Minutos sin justificar = fórmula, solo como dato', vecina('   Sin justificar (RRHH decide si descuenta)', 'S') === `=U${filaTot}`);
for (const est of ['APROBADA', 'ANTERIOR A LA APROBACION', 'POR APROBAR', 'POR COMPENSAR (BOLSA DE HORAS)', 'NO AUTORIZADA']) {
  caso(`Resumen de extras cuenta el estado "${est}"`, Object.values(celdas).some(v => typeof v === 'string' && v.includes(`"${est}"`) && v.startsWith('=SUMIF')));
}
const filaPagar = buscar('EXTRAS A PAGAR (aprobadas + anteriores)');
caso('Extras a pagar = aprobadas + anteriores (igual que extrasPagables)', !!filaPagar && /^=G\d+\+G\d+$/.test(celdas[`G${filaPagar.slice(1)}`]));
caso('No hay "Total extras + recargos" (el recargo no es una hora extra)', !Object.values(celdas).some(v => typeof v === 'string' && /extras \+ recargos/i.test(v)));
caso('Fecha como fecha de Excel y hora como hora', celdas.A10 instanceof Date && ws.getCell('A10').numFmt === 'dd/mm/yyyy' && Math.abs(celdas.F10 - 7 / 24) < 1e-9 && ws.getCell('F10').numFmt === 'hh:mm', `${celdas.A10} ${celdas.F10}`);
caso('Día de la semana en español', celdas.B10 === 'Miércoles', celdas.B10);
caso('Consolidado conserva sus 3 tablas', ['DETALLE DE HORAS Y EXTRAS (día por día)', 'PERMISOS (incapacidades, citas médicas, vacaciones, etc.)'].every(t => { let hay = false; wb.getWorksheet('Consolidado').eachRow(r => { if (r.getCell(1).value === t) hay = true; }); return hay; }));
const usados = new Set(['consolidado']);
caso('Nombres de hoja: máximo 31 caracteres, sin repetir ni caracteres prohibidos',
  nombreHojaTarjeta('MARÍA FERNANDA DE LOS ÁNGELES RODRÍGUEZ / PÉREZ', usados).length <= 31 && nombreHojaTarjeta('ANA', usados) === 'ANA' && nombreHojaTarjeta('ana', usados) === 'ana (2)' && nombreHojaTarjeta('Consolidado', usados) === 'Consolidado (2)');

const buffer = await wb.xlsx.writeBuffer();
const vuelta = new ExcelJS.Workbook();
await vuelta.xlsx.load(buffer);
caso('El archivo se puede abrir otra vez sin errores', vuelta.worksheets.length === 3);
if (SALIDA) fs.writeFileSync(SALIDA, Buffer.from(buffer));
fs.unlinkSync(RUTA_EXTRAIDO);
console.log(`\n${res.filter(Boolean).length} / ${res.length} comprobaciones`);
process.exit(res.every(Boolean) ? 0 : 1);
