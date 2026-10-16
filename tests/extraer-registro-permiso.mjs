import { bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html la regla que reconoce el "registro vacío" que deja un permiso por horas
// aprobado de antemano, y checkTodayState() (la pantalla de fichaje), para probar juntas que ese registro ya
// no bloquea la entrada.
export function extraerRegistroPermiso(fuente) {
  const piezas = [
    bloqueBalanceado(fuente, 'function esAusenciaSinHoras(tipoPermiso) {'),
    hastaPuntoYComa(fuente, 'const HORAS_PERMISO_DIA_COMPLETO ='),
    bloqueBalanceado(fuente, 'function esRegistroSoloPermisoParcial(d) {'),
    bloqueBalanceado(fuente, 'async function checkTodayState() {'),
  ];
  return [
    '"use strict";',
    // Simulación mínima de lo que checkTodayState() usa de la app.
    'let currentUserId = "39765659", fechaRegistroActivo = null; const db = {};',
    'const llamadas = []; const logError = () => {};',
    'let registroHoy = null; let registrosActivos = [];',
    'const getTodayStr = () => "2026-10-16";',
    'const doc = (...a) => ({ path: a.slice(1).join("/") });',
    'const collection = () => ({}); const where = () => ({}); const fsLimit = () => ({}); const query = (x) => x;',
    'const getDoc = async () => ({ exists: () => registroHoy !== null, data: () => registroHoy });',
    'const getDocs = async () => ({ docs: registrosActivos.map(d => ({ id: d.fecha, data: () => d })) });',
    'const setPunchUI = (estado, data) => { llamadas.push([estado, data]); };',
    ...piezas,
    'module.exports = { esRegistroSoloPermisoParcial, checkTodayState, llamadas,',
    '  poner: (hoy, activos) => { registroHoy = hoy; registrosActivos = activos || []; llamadas.length = 0; } };',
  ].join('\n\n');
}
