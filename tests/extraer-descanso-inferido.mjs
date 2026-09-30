import { bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html todo lo que esDiaDescansoInferido() y diasADescontarPorSemana()
// necesitan para correr aisladas -el sábado/domingo/festivo sin registro que la app infiere como
// "Descanso remunerado" cuando la semana ya completó las 42 horas legales, y el domingo que en vez de
// eso se marca como "sanción" (Art. 173 CST) cuando la semana tuvo una falta injustificada.
export function extraerDescansoInferido(fuente) {
  const piezas = [
    bloqueBalanceado(fuente, 'const LEY = {'),
    bloqueBalanceado(fuente, 'const FESTIVOS_COLOMBIA = ['),
    hastaPuntoYComa(fuente, 'const FESTIVOS_SET = new Set(FESTIVOS_COLOMBIA);'),
    bloqueBalanceado(fuente, 'function esDiaFestivo(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esDominicalOFestivo(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esAusenciaInjustificada(tipoPermiso) {'),
    bloqueBalanceado(fuente, 'function diasADescontarPorSemana(registrosSemana) {'),
    bloqueBalanceado(fuente, 'function esFinDeSemanaOFestivo(fecha) {'),
    bloqueBalanceado(fuente, 'function esDiaDescansoInferido(fecha, registrosSemana) {'),
  ];

  const cuerpo = [
    '"use strict";',
    'let catalogosCache = { horarios_obra: {}, festivos: [] };',
    ...piezas,
    'module.exports = { esDiaDescansoInferido, diasADescontarPorSemana, setCatalogosCache: (c) => { catalogosCache = c; } };',
  ].join('\n\n');

  return cuerpo;
}
