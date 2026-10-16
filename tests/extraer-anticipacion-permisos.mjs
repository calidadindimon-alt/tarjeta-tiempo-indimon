import { bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html las reglas puras de la solicitud de permiso (horario obligatorio y
// anticipación de 24 horas) con lo mínimo que necesitan para correr aisladas.
export function extraerAnticipacionPermisos(fuente) {
  const piezas = [
    hastaPuntoYComa(fuente, 'const MESES_ES = ['),
    bloqueBalanceado(fuente, 'function partesFechaPermiso(valor) {'),
    bloqueBalanceado(fuente, 'function fechaDMAPermiso(valor) {'),
    bloqueBalanceado(fuente, 'function fechaHoraPermiso(isoDatetime) {'),
    hastaPuntoYComa(fuente, 'const HORAS_ANTICIPACION_PERMISO ='),
    bloqueBalanceado(fuente, 'function inicioPermisoBogota(fecha, hora) {'),
    hastaPuntoYComa(fuente, 'const PERMISOS_CATALOGO = ['),
    bloqueBalanceado(fuente, 'function infoTipoPermiso(tipo) {'),
    bloqueBalanceado(fuente, 'function esTipoVariosDias(tipo) {'),
    hastaPuntoYComa(fuente, 'const PLAZO_SOPORTE_PERMISO ='),
    bloqueBalanceado(fuente, 'function textoRecordatorioSoporte(tipo) {'),
    bloqueBalanceado(fuente, 'function clasificarPermiso(tipo, extra) {'),
    bloqueBalanceado(fuente, 'function validarDiasPermiso(tipo, dias) {'),
    bloqueBalanceado(fuente, 'function textoRemuneracionPermiso(p) {'),
    bloqueBalanceado(fuente, 'function validarHorarioPermiso(tipo, salida, entrada) {'),
    bloqueBalanceado(fuente, 'function validarAnticipacionPermiso(datos) {'),
  ];
  return [
    '"use strict";',
    ...piezas,
    'module.exports = { inicioPermisoBogota, validarHorarioPermiso, validarAnticipacionPermiso, esTipoVariosDias, infoTipoPermiso, clasificarPermiso, validarDiasPermiso, textoRemuneracionPermiso, textoRecordatorioSoporte };',
  ].join('\n\n');
}
