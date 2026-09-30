import { bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html todo lo que esDiaDescansoInferido() necesita para correr
// aislada -el sábado/domingo/festivo sin registro que la app infiere como "Descanso remunerado"
// cuando la semana ya completó las 42 horas legales.
export function extraerDescansoInferido(fuente) {
  const piezas = [
    bloqueBalanceado(fuente, 'const LEY = {'),
    bloqueBalanceado(fuente, 'const FESTIVOS_COLOMBIA = ['),
    hastaPuntoYComa(fuente, 'const FESTIVOS_SET = new Set(FESTIVOS_COLOMBIA);'),
    bloqueBalanceado(fuente, 'function esDiaFestivo(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esDominicalOFestivo(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esFinDeSemanaOFestivo(fecha) {'),
    bloqueBalanceado(fuente, 'function esDiaDescansoInferido(fecha, registrosSemana) {'),
  ];

  const cuerpo = [
    '"use strict";',
    'let catalogosCache = { horarios_obra: {}, festivos: [] };',
    ...piezas,
    'module.exports = { esDiaDescansoInferido, setCatalogosCache: (c) => { catalogosCache = c; } };',
  ].join('\n\n');

  return cuerpo;
}
