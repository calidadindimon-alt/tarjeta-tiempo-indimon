import { bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html las funciones que arman las 3 tablas del nuevo export a Excel
// (Detalle de horas y extras día por día, Permisos, Ausencias) junto con TODO lo que necesitan para
// correr aisladas.
export function extraerExcelConsolidado(fuente) {
  const piezas = [
    hastaPuntoYComa(fuente, "const TIPOS_AUSENCIA = ["),
    bloqueBalanceado(fuente, 'function getRangoSemana(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esAusenciaInjustificada(tipoPermiso) {'),
    bloqueBalanceado(fuente, 'function diasADescontarPorSemana(registrosSemana) {'),
    bloqueBalanceado(fuente, 'const ESTADO_LEGIBLE_EXCEL = {'),
    bloqueBalanceado(fuente, 'function construirFilasDetalleHoras(rows) {'),
    bloqueBalanceado(fuente, 'function construirFilasPermisos(rows) {'),
    bloqueBalanceado(fuente, 'function construirFilasAusencias(rows) {'),
  ];

  const cuerpo = [
    '"use strict";',
    ...piezas,
    'module.exports = { construirFilasDetalleHoras, construirFilasPermisos, construirFilasAusencias };',
  ].join('\n\n');

  return cuerpo;
}
