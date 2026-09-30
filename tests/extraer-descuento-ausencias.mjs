import { bloqueBalanceado } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html todo lo que calcularDiasDescontadosPorAusenciasMes() necesita
// para correr aislada — el descuento legal por ausencia injustificada (Art. 173 CST). Igual que
// extraerCalculadora(), nunca reescribe la lógica a mano.
export function extraerDescuentoAusencias(fuente) {
  const piezas = [
    bloqueBalanceado(fuente, 'function getRangoSemana(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esAusenciaInjustificada(tipoPermiso) {'),
    bloqueBalanceado(fuente, 'function diasADescontarPorSemana(registrosSemana) {'),
    bloqueBalanceado(fuente, 'function calcularDiasDescontadosPorAusenciasMes(todosLosRegistros, mesPrefix) {'),
  ];

  const cuerpo = [
    '"use strict";',
    ...piezas,
    'module.exports = { getRangoSemana, esAusenciaInjustificada, diasADescontarPorSemana, calcularDiasDescontadosPorAusenciasMes };',
  ].join('\n\n');

  return cuerpo;
}
