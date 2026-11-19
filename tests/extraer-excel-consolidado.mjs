import { bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html las funciones que arman las 3 tablas del nuevo export a Excel
// (Detalle de horas y extras día por día, Permisos, Ausencias) junto con TODO lo que necesitan para
// correr aisladas.
export function extraerExcelConsolidado(fuente) {
  const piezas = [
    hastaPuntoYComa(fuente, "const TIPOS_AUSENCIA = ["),
    hastaPuntoYComa(fuente, 'const PERMISOS_CATALOGO = ['),
    bloqueBalanceado(fuente, 'function infoTipoPermiso(tipo) {'),
    bloqueBalanceado(fuente, 'function esTipoVariosDias(tipo) {'),
    bloqueBalanceado(fuente, 'function getRangoSemana(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esAusenciaInjustificada(tipoPermiso) {'),
    bloqueBalanceado(fuente, 'function diasADescontarPorSemana(registrosSemana) {'),
    bloqueBalanceado(fuente, 'const ESTADO_LEGIBLE_EXCEL = {'),
    hastaPuntoYComa(fuente, "const FECHA_INICIO_APROBACION_EXTRAS ="),
    bloqueBalanceado(fuente, 'function estadoExtras(r) {'),
    bloqueBalanceado(fuente, 'function horasTrabajadasRegistro(r) {'),
    bloqueBalanceado(fuente, 'const ESTADO_EXTRAS_LEGIBLE = {'),
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

// Hoja "Tarjeta de Tiempo" por colaborador (nov-2026): las funciones que arman el libro completo con ExcelJS.
// getTodayStr se reemplaza por una fecha fija para que la prueba no dependa del día en que corre.
export function extraerTarjetaTiempo(fuente, hoy = '2026-11-19') {
  const piezas = [
    extraerExcelConsolidado(fuente).replace(/\nmodule\.exports = .*$/s, ''),
    `const getTodayStr = () => '${hoy}';`,
    bloqueBalanceado(fuente, 'function timeStrToFloat(t) {'),
    bloqueBalanceado(fuente, 'function duracionHorasEntre(desde, hasta) {'),
    bloqueBalanceado(fuente, 'function horasDeSalidaPermiso(r, i) {'),
    bloqueBalanceado(fuente, 'function armarHojaConsolidado(rows, filtroDescripcion) {'),
    hastaPuntoYComa(fuente, 'const DIAS_SEMANA_ES = ['),
    bloqueBalanceado(fuente, 'function datosTarjetaColaborador(rows) {'),
    bloqueBalanceado(fuente, 'function agregarHojaTarjeta(wb, datos, nombreHoja, filtroDescripcion) {'),
    bloqueBalanceado(fuente, 'function nombreHojaTarjeta(base, usados) {'),
    bloqueBalanceado(fuente, 'function construirLibroConsolidado(ExcelJS, rows, filtroDescripcion) {'),
  ];
  return [...piezas, 'module.exports = { datosTarjetaColaborador, construirLibroConsolidado, nombreHojaTarjeta };'].join('\n\n');
}
