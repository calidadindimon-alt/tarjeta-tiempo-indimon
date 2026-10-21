// Prueba del resumen de alertas por colaborador y mes (resumenAlertasMes), extraída textualmente de index.html.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente, bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const fuente = leerFuente(process.argv[2] || join(DIR, '..', 'index.html'));
const RUTA = join(DIR, '_extraido-alertas.cjs');
fs.writeFileSync(RUTA, ['"use strict";',
  hastaPuntoYComa(fuente, 'const TOLERANCIA_TARDANZA_MIN ='),
  bloqueBalanceado(fuente, 'function esAusenciaInjustificada(tipoPermiso) {'),
  hastaPuntoYComa(fuente, 'const FECHA_INICIO_APROBACION_EXTRAS ='),
  bloqueBalanceado(fuente, 'function estadoExtras(r) {'),
  bloqueBalanceado(fuente, 'const ALERTAS_COLUMNAS = ['),
  bloqueBalanceado(fuente, 'function resumenAlertasMes(regs, mes, obra) {'),
  'module.exports = { resumenAlertasMes };'].join('\n\n'));
const require = createRequire(import.meta.url);
const { resumenAlertasMes } = require('./_extraido-alertas.cjs');

let fallas = 0, total = 0;
const caso = (nombre, obtenido, esperado) => {
  total++;
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `\n      esperado ${JSON.stringify(esperado)}\n      obtuvo   ${JSON.stringify(obtenido)}`}`);
};

const regs = [
  // Willintong: GPS bloqueado en entrada y salida dos días, y solo en la salida otro día (5 fichajes)
  { cedula: 'W', empleado_nombre: 'WILLINTONG', fecha: '2026-10-05', obra: 'MYKW', gps_motivo_entrada: 'permiso_denegado', gps_motivo_salida: 'permiso_denegado' },
  { cedula: 'W', empleado_nombre: 'WILLINTONG', fecha: '2026-10-06', obra: 'MYKW', gps_motivo_entrada: 'permiso_denegado', gps_motivo_salida: 'permiso_denegado' },
  { cedula: 'W', empleado_nombre: 'WILLINTONG', fecha: '2026-10-03', obra: 'MYKW', gps_motivo_salida: 'permiso_denegado' },
  // Falta de señal: NO cuenta
  { cedula: 'W', empleado_nombre: 'WILLINTONG', fecha: '2026-10-01', obra: 'MYKW', gps_motivo_entrada: 'timeout', gps_motivo_salida: 'timeout' },
  // Doris: tardanza de 223 min (cuenta) y una de 10 min (dentro de la tolerancia, no cuenta)
  { cedula: 'D', empleado_nombre: 'DORIS', fecha: '2026-10-15', obra: 'BODEGA', minutos_tarde: 223 },
  { cedula: 'D', empleado_nombre: 'DORIS', fecha: '2026-10-16', obra: 'BODEGA', minutos_tarde: 10 },
  // Jhon: tardanza justificada (no cuenta como alerta) y jornada sin almuerzo
  { cedula: 'J', empleado_nombre: 'JHON', fecha: '2026-10-09', obra: 'BODEGA', minutos_tarde: 40, tardanza_justificada: true },
  { cedula: 'J', empleado_nombre: 'JHON', fecha: '2026-10-10', obra: 'BODEGA', almuerzo_omitido: true },
  // Pedro: fuera de geocerca, salida olvidada declarada, ausencia injustificada y extras no autorizadas
  { cedula: 'P', empleado_nombre: 'PEDRO', fecha: '2026-10-16', obra: 'BODEGA', nota_revision: 'Fuera de la geocerca (salida a 129m de la obra).' },
  { cedula: 'P', empleado_nombre: 'PEDRO', fecha: '2026-10-20', obra: 'BODEGA', salida_declarada_por_colaborador: true },
  { cedula: 'P', empleado_nombre: 'PEDRO', fecha: '2026-10-21', obra: 'BODEGA', tipo_permiso: 'Ausencia injustificada' },
  { cedula: 'P', empleado_nombre: 'PEDRO', fecha: '2026-10-22', obra: 'BODEGA', horas_extras_diurnas: 2, extras_estado: 'no_autorizada' },
  // Ana: sin alertas
  { cedula: 'A', empleado_nombre: 'ANA', fecha: '2026-10-15', obra: 'BODEGA', minutos_tarde: 0 },
  // Otro mes: no cuenta
  { cedula: 'W', empleado_nombre: 'WILLINTONG', fecha: '2026-09-30', obra: 'MYKW', gps_motivo_entrada: 'permiso_denegado' },
];

const oct = resumenAlertasMes(regs, '2026-10', '');
const por = Object.fromEntries(oct.map(p => [p.cedula, p]));
caso('1. Orden de más a menos alertas (Willintong 5, Pedro 4, Doris 1, Jhon 1, Ana 0)', oct.map(p => [p.nombre, p.total]),
  [['WILLINTONG', 5], ['PEDRO', 4], ['DORIS', 1], ['JHON', 1], ['ANA', 0]]);
caso('2. Sin GPS cuenta cada fichaje con permiso bloqueado; la falta de señal y otros meses no cuentan', por.W.sinGps, 5);
caso('3. Tardanza: solo desde 15 min, con los minutos sumados', [por.D.tardanzas, por.D.minutosTarde], [1, 223]);
caso('4. Tardanza justificada no es alerta, pero se informa aparte', [por.J.tardanzas, por.J.tardanzasJustificadas, por.J.sinAlmuerzo], [0, 1, 1]);
caso('5. Pedro: geocerca, salida olvidada, ausencia injustificada y extras no autorizadas',
  [por.P.geocerca, por.P.salidaOlvidada, por.P.ausencias, por.P.extrasNoAutorizadas], [1, 1, 1, 1]);
caso('6. Detalle día por día ordenado por fecha', por.W.detalle.map(d => d.fecha), ['2026-10-03', '2026-10-05', '2026-10-06']);
caso('7. El detalle dice si fue en la entrada, la salida o ambas', por.W.detalle.map(d => d.motivos[0]), [
  'Sin GPS (permiso de ubicación bloqueado) en la salida',
  'Sin GPS (permiso de ubicación bloqueado) en la entrada y la salida',
  'Sin GPS (permiso de ubicación bloqueado) en la entrada y la salida']);
caso('8. Filtro por obra (MYKW: solo Willintong)', resumenAlertasMes(regs, '2026-10', 'mykw').map(p => [p.nombre, p.total]), [['WILLINTONG', 5]]);
caso('9. Mes anterior: solo la alerta de septiembre', resumenAlertasMes(regs, '2026-09', '').map(p => [p.nombre, p.sinGps]), [['WILLINTONG', 1]]);

console.log(`\n${total - fallas} / ${total} casos correctos`);
process.exit(fallas ? 1 : 0);
