import fs from 'fs';

export function leerFuente(rutaIndexHtml) {
  return fs.readFileSync(rutaIndexHtml, 'utf8');
}

// Extrae desde el marcador hasta el ";" de nivel superior más cercano (para const de una sola línea).
export function hastaPuntoYComa(fuente, marcador) {
  const inicio = fuente.indexOf(marcador);
  if (inicio === -1) throw new Error(`No se encontró el marcador: "${marcador}"`);
  const fin = fuente.indexOf(';', inicio);
  if (fin === -1) throw new Error(`No se encontró ";" después de: "${marcador}"`);
  return fuente.slice(inicio, fin + 1);
}

// Extrae desde el marcador hasta que el primer "{" o "[" que aparezca quede balanceado con su cierre.
export function bloqueBalanceado(fuente, marcador) {
  const inicio = fuente.indexOf(marcador);
  if (inicio === -1) throw new Error(`No se encontró el marcador: "${marcador}"`);
  let i = inicio;
  while (fuente[i] !== '{' && fuente[i] !== '[') {
    i++;
    if (i > inicio + 500) throw new Error(`No se encontró "{" ni "[" cerca de: "${marcador}"`);
  }
  const apertura = fuente[i];
  const cierre = apertura === '{' ? '}' : ']';
  let nivel = 1;
  let j = i + 1;
  while (nivel > 0) {
    if (fuente[j] === apertura) nivel++;
    else if (fuente[j] === cierre) nivel--;
    j++;
    if (j > fuente.length) throw new Error(`Bloque sin cerrar para: "${marcador}"`);
  }
  return fuente.slice(inicio, j);
}

// Extrae del código real de index.html exactamente lo que calcularJornadaDiaria() necesita para
// correr de forma aislada — nada se reescribe a mano, todo es una copia textual literal del
// archivo real, así que si alguien cambia la función en el futuro, este test la sigue probando
// tal cual queda (o falla la extracción misma, avisando que algo estructural cambió).
export function extraerCalculadora(fuente) {
  const piezas = [
    bloqueBalanceado(fuente, 'const LEY = {'),
    bloqueBalanceado(fuente, 'const FESTIVOS_COLOMBIA = ['),
    hastaPuntoYComa(fuente, 'const FESTIVOS_SET = new Set(FESTIVOS_COLOMBIA);'),
    bloqueBalanceado(fuente, 'function timeStrToFloat(t) {'),
    hastaPuntoYComa(fuente, 'const overlap = (aStart, aEnd, bStart, bEnd) =>'),
    hastaPuntoYComa(fuente, 'const TOLERANCIA_TARDANZA_MIN ='),
    hastaPuntoYComa(fuente, 'const MAX_HORAS_DESFASE_TARDANZA ='),
    hastaPuntoYComa(fuente, 'const ALMUERZO_LEGAL_HORAS ='),
    hastaPuntoYComa(fuente, 'const MIN_ALMUERZO_VALIDO_MIN ='),
    hastaPuntoYComa(fuente, 'const JORNADA_MIN_PARA_ALMUERZO_ASUMIDO ='),
    bloqueBalanceado(fuente, 'function calcularMinutosTardanza(horaEntradaStr, horaEsperadaStr) {'),
    bloqueBalanceado(fuente, 'function esDiaFestivo(fechaStr) {'),
    bloqueBalanceado(fuente, 'function esDominicalOFestivo(fechaStr) {'),
    bloqueBalanceado(fuente, 'function getHoraEsperadaObra(obra) {'),
    bloqueBalanceado(fuente, 'function fechaSiguiente(fechaStr) {'),
    bloqueBalanceado(fuente, 'function calcularJornadaDiaria(reg, topeOrdinarioDia = LEY.JORNADA_ORDINARIA_DIARIA) {'),
  ];

  const cuerpo = [
    '"use strict";',
    'let catalogosCache = { horarios_obra: {}, festivos: [] };',
    ...piezas,
    'module.exports = { calcularJornadaDiaria, esDominicalOFestivo, esDiaFestivo, setCatalogosCache: (c) => { catalogosCache = c; } };',
  ].join('\n\n');

  return cuerpo;
}
