import { bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

// Extrae textualmente de index.html el código que arma el Excel de permisos con los formatos oficiales
// (GH-F-011 diario y GH-F-012 de un día o más) y el PDF de la constancia de permiso aprobado. Son copias
// literales del archivo real: si alguien cambia esas funciones, la prueba las sigue probando tal cual.
export function extraerPermisosFormatos(fuente) {
  const piezas = [
    bloqueBalanceado(fuente, 'const SIGNANTES = ['),
    hastaPuntoYComa(fuente, "const MESES_ES = ["),
    hastaPuntoYComa(fuente, 'const PERMISO_DIARIO_FILAS_POR_HOJA ='),
    bloqueBalanceado(fuente, 'function partesFechaPermiso(valor) {'),
    bloqueBalanceado(fuente, 'function fechaDMAPermiso(valor) {'),
    bloqueBalanceado(fuente, 'function fechaHoraPermiso(isoDatetime) {'),
    hastaPuntoYComa(fuente, 'const PERMISOS_CATALOGO = ['),
    bloqueBalanceado(fuente, 'function infoTipoPermiso(tipo) {'),
    bloqueBalanceado(fuente, 'function esTipoVariosDias(tipo) {'),
    hastaPuntoYComa(fuente, 'const PLAZO_SOPORTE_PERMISO ='),
    bloqueBalanceado(fuente, 'function textoRecordatorioSoporte(tipo) {'),
    bloqueBalanceado(fuente, 'function textoRemuneracionPermiso(p) {'),
    bloqueBalanceado(fuente, 'function esPermisoVariosDias(p) {'),
    bloqueBalanceado(fuente, 'function motivoPermiso(p) {'),
    bloqueBalanceado(fuente, 'function estadoPermisoLegible(p, vencido) {'),
    bloqueBalanceado(fuente, 'function dividirEnBloques(lista, tamano) {'),
    bloqueBalanceado(fuente, 'function armarHojasPermisoDiario(permisosAprobados, obraPorPermiso) {'),
    bloqueBalanceado(fuente, 'function nombreHojaUnico(base, usados) {'),
    bloqueBalanceado(fuente, 'function dimensionesPngDataUrl(dataUrl) {'),
    bloqueBalanceado(fuente, 'function copiarEstiloCelda(origen, destino) {'),
    bloqueBalanceado(fuente, 'function clonarHojaPlantilla(wbSalida, wbPlantilla, wsPlantilla, nombre) {'),
    bloqueBalanceado(fuente, 'function ponerFirmaEnHoja(wbSalida, ws, dataUrl, colIni, filaIni, anchoPx, altoPx, margenPx = 4) {'),
    hastaPuntoYComa(fuente, 'const px_ancho ='),
    hastaPuntoYComa(fuente, 'const px_alto ='),
    bloqueBalanceado(fuente, 'function textoRico(partes, fuenteBase) {'),
    bloqueBalanceado(fuente, 'function llenarHojaPermisoDiario(wbSalida, wbPlantilla, wsPlantilla, nombreHoja, hoja, perfiles) {'),
    bloqueBalanceado(fuente, 'function llenarHojaPermisoVariosDias(wbSalida, wbPlantilla, wsPlantilla, nombreHoja, p, perfil, obra, pagina, paginas) {'),
    bloqueBalanceado(fuente, 'function llenarHojaResumenPermisos(wbSalida, permisos, perfiles, obraPorPermiso, esVencido, tituloMes) {'),
    bloqueBalanceado(fuente, 'async function generarLibroPermisosExcel(ExcelJS, plantillas, datos) {'),
    bloqueBalanceado(fuente, 'function nombreArchivoPdfPermiso(p) {'),
    bloqueBalanceado(fuente, 'function fechaAprobacionPermiso(p) {'),
    bloqueBalanceado(fuente, 'function construirPdfPermiso(jsPDFClase, p, perfil, logoDataUrl) {'),
  ];

  return [
    '"use strict";',
    ...piezas,
    `module.exports = { SIGNANTES, partesFechaPermiso, fechaDMAPermiso, fechaHoraPermiso, esPermisoVariosDias, motivoPermiso,
      armarHojasPermisoDiario, nombreHojaUnico, dimensionesPngDataUrl, generarLibroPermisosExcel, construirPdfPermiso,
      nombreArchivoPdfPermiso, fechaAprobacionPermiso };`,
  ].join('\n\n');
}
