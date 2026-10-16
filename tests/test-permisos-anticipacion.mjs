// Prueba de las reglas de la solicitud de permiso: (1) hora de salida y de regreso obligatorias en permisos por
// horas, y (2) anticipación de 24 horas contadas desde la hora de salida (hora de Bogotá), salvo calamidad o
// emergencia. Usa el código REAL de index.html.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerAnticipacionPermisos } from './extraer-anticipacion-permisos.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-anticipacion.cjs');

fs.writeFileSync(RUTA_EXTRAIDO, extraerAnticipacionPermisos(leerFuente(RUTA_INDEX)));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const { inicioPermisoBogota, validarHorarioPermiso, validarAnticipacionPermiso } = require('./_extraido-anticipacion.cjs');

const results = [];
function caso(nombre, fn) {
  try { fn(); results.push({ nombre, ok: true }); console.log(`✅ PASS — ${nombre}`); }
  catch (e) { results.push({ nombre, ok: false, error: e.message }); console.log(`❌ FAIL — ${nombre}  (${e.message})`); }
}
function assertEqual(obtenido, esperado, msg) {
  const a = JSON.stringify(obtenido), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg}: esperado ${b}, obtuvo ${a}`);
}
// Hora de Bogotá (UTC-5) -> instante
const bogota = (texto) => new Date(`${texto}:00-05:00`);
const TIPO = 'Cita médica (urgencia o especialista)';
const pide = (ahora, fecha, hora, extra = {}) => validarAnticipacionPermiso(Object.assign({ tipo: TIPO, fecha, horaSalida: hora, esEmergencia: false, ahora: bogota(ahora) }, extra));

caso('1. Para mañana a las 8:00 pedido hoy a las 9:00: se bloquea (solo 23 horas)', () => {
  const r = pide('2026-10-15T09:00', '2026-10-16', '08:00');
  assertEqual(r.ok, false, 'debe bloquear');
  assertEqual(r.razon.includes('16/10/2026 8:00 a. m.') && r.razon.includes('16/10/2026 9:00 a. m.'), true, 'el mensaje dice cuándo empieza y cuál es lo más pronto que se puede pedir');
});

caso('2. El caso que antes pasaba: mañana a las 7:00 pedido hoy a las 3 p. m. (16 horas) ahora se bloquea', () => {
  assertEqual(pide('2026-10-15T15:00', '2026-10-16', '07:00').ok, false, '16 horas de anticipación');
});

caso('3. Exactamente 24 horas se permite; un minuto menos, no', () => {
  assertEqual(pide('2026-10-15T08:00', '2026-10-16', '08:00').ok, true, '24 h exactas');
  assertEqual(pide('2026-10-15T08:01', '2026-10-16', '08:00').ok, false, '23 h 59 min');
});

caso('4. El mismo día y fechas pasadas se bloquean', () => {
  assertEqual(pide('2026-10-15T07:00', '2026-10-15', '15:00').ok, false, 'mismo día');
  assertEqual(pide('2026-10-15T07:00', '2026-10-10', '15:00').ok, false, 'fecha pasada');
});

caso('5. Calamidad doméstica o emergencia: se salta la regla', () => {
  assertEqual(pide('2026-10-15T15:00', '2026-10-15', '16:00', { esEmergencia: true }).ok, true, 'emergencia el mismo día');
});

caso('6. Con más de 24 horas de margen se permite', () => {
  assertEqual(pide('2026-10-15T09:00', '2026-10-17', '07:00').ok, true, 'en dos días');
});

caso('7. Usa la hora de Bogotá (UTC-5), no la del servidor', () => {
  // 07:00 en Bogotá del 16/10 = 12:00 UTC. Pedido a las 12:00 UTC del 15/10 -> 24 h exactas.
  assertEqual(inicioPermisoBogota('2026-10-16', '07:00').toISOString(), '2026-10-16T12:00:00.000Z', 'instante de inicio');
  const ahora = (iso) => validarAnticipacionPermiso({ tipo: TIPO, fecha: '2026-10-16', horaSalida: '07:00', esEmergencia: false, ahora: new Date(iso) });
  assertEqual(ahora('2026-10-15T12:00:00.000Z').ok, true, 'justo 24 h');
  assertEqual(ahora('2026-10-15T12:00:01.000Z').ok, false, '1 segundo menos');
});

caso('8. Vacaciones: la fecha de inicio debe ser posterior a hoy (día de Bogotá)', () => {
  const vac = (ahora, fecha, extra = {}) => validarAnticipacionPermiso(Object.assign({ tipo: 'Vacaciones', fecha, horaSalida: '', esEmergencia: false, ahora: new Date(ahora) }, extra));
  assertEqual(vac('2026-10-15T15:00:00.000Z', '2026-10-16').ok, true, 'mañana');
  assertEqual(vac('2026-10-15T15:00:00.000Z', '2026-10-15').ok, false, 'hoy');
  // 23:30 del 15/10 en Bogotá ya es 16/10 en UTC: "mañana" sigue siendo el 16, y el 15 sigue siendo "hoy"
  assertEqual(vac('2026-10-16T04:30:00.000Z', '2026-10-16').ok, true, 'mañana, aunque en UTC ya sea el 16');
  assertEqual(vac('2026-10-16T04:30:00.000Z', '2026-10-15').ok, false, 'hoy en Bogotá');
  assertEqual(vac('2026-10-15T15:00:00.000Z', '2026-10-15', { esEmergencia: true }).ok, true, 'emergencia');
});

caso('9. Todavía sin datos suficientes no se avisa nada (lo piden las otras validaciones)', () => {
  assertEqual(pide('2026-10-15T09:00', '2026-10-15', '').ok, true, 'sin hora de salida');
  assertEqual(pide('2026-10-15T09:00', '', '08:00').ok, true, 'sin fecha');
});

caso('10. Horario obligatorio: sin hora de salida o de regreso no pasa', () => {
  assertEqual(validarHorarioPermiso(TIPO, '', '16:00').ok, false, 'sin salida');
  assertEqual(validarHorarioPermiso(TIPO, '14:00', '').ok, false, 'sin regreso');
  assertEqual(validarHorarioPermiso(TIPO, '', '').vacio, true, 'vacío (no se muestra error rojo mientras escribe)');
});

caso('11. El regreso debe ser después de la salida', () => {
  assertEqual(validarHorarioPermiso(TIPO, '16:00', '14:00').ok, false, 'regreso antes de la salida');
  assertEqual(validarHorarioPermiso(TIPO, '14:00', '14:00').ok, false, 'misma hora');
});

caso('12. Las horas se calculan solas con la salida y el regreso', () => {
  assertEqual(validarHorarioPermiso(TIPO, '14:00', '16:00'), { ok: true, horas: 2 }, '2 horas');
  assertEqual(validarHorarioPermiso(TIPO, '14:00', '16:30').horas, 2.5, '2 h 30 min');
  assertEqual(validarHorarioPermiso(TIPO, '14:10', '16:00').horas, 1.83, '1 h 50 min redondeado a 2 decimales');
});

caso('13. Vacaciones no usa horario', () => {
  assertEqual(validarHorarioPermiso('Vacaciones', '', '').ok, true, 'vacaciones sin horas');
});

const fallidos = results.filter(r => !r.ok);
console.log('');
console.log(`${results.length - fallidos.length} / ${results.length} casos correctos`);
if (fallidos.length) process.exit(1);
console.log('');
console.log('La regla de 24 horas y el horario obligatorio de los permisos calculan exactamente lo esperado en los casos probados.');
