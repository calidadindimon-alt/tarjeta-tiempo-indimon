// AUDITORÍA DE NÓMINA (nov-2026) — COMPLEMENTO de tests/auditoria-nomina-hallazgos.mjs: demuestra con números los
// hallazgos 19 (turno de madrugada completo), 22, 23 y 24 de docs/auditoria-nomina/INFORME.md, que agregó la segunda
// revisión del mismo encargo.
//
// OJO: NO forma parte del CI (.github/workflows/test-jornada.yml no lo corre) y NUNCA termina en error.
//   🔴 HALLAZGO VIGENTE -> la app sigue dando el número señalado en el informe.
//   🟢 YA CORREGIDO     -> la app ya da el número esperado (entonces, pasar el caso a las pruebas normales).
//
// Saca las funciones REALES de index.html (no copias). Uso: node tests/auditoria-nomina-complemento.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fuente = fs.readFileSync(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const bloque = (inicio) => {
  const i = fuente.indexOf(inicio);
  if (i < 0) throw new Error('No se encontró: ' + inicio);
  let j = i;
  while (fuente[j] !== '{' && fuente[j] !== '[') j++;
  const abre = fuente[j], cierra = abre === '{' ? '}' : ']';
  let nivel = 0;
  for (let k = j; k < fuente.length; k++) {
    if (fuente[k] === abre) nivel++;
    else if (fuente[k] === cierra && --nivel === 0) return fuente.slice(i, k + 1);
  }
  throw new Error('Bloque sin cerrar: ' + inicio);
};
const linea = (marcador) => {
  const i = fuente.indexOf(marcador);
  if (i < 0) throw new Error('No se encontró: ' + marcador);
  return fuente.slice(i, fuente.indexOf(';', i) + 1);
};
const codigo = [
  'let catalogosCache = { horarios_obra: {}, jornadas_obra: {}, festivos: [] };',
  bloque('const LEY = {') + ';',
  bloque('function recargoDominicalFestivoPorFecha('),
  bloque('const FESTIVOS_COLOMBIA = [') + ';',
  linea('const FESTIVOS_SET ='),
  bloque('function timeStrToFloat(t) {'),
  linea('const overlap = ('),
  linea('const TOLERANCIA_TARDANZA_MIN ='), linea('const MAX_HORAS_DESFASE_TARDANZA ='), linea('const TOLERANCIA_SALIDA_MIN ='),
  linea('const ALMUERZO_LEGAL_HORAS ='), linea('const MIN_ALMUERZO_VALIDO_MIN ='), linea('const JORNADA_MIN_PARA_ALMUERZO_ASUMIDO ='),
  bloque('const HORARIO_PACTADO_HORAS = {') + ';',
  bloque('function calcularMinutosTardanza('),
  bloque('function esDiaFestivo('), bloque('function esDominicalOFestivo('), bloque('function getRangoSemana('),
  bloque('function metaSemanalOrdinaria('),
  linea('const FECHA_INICIO_APROBACION_EXTRAS ='),
  bloque('function estadoExtras('), bloque('function extrasPagables('),
  bloque('function getHoraEsperadaObra('), bloque('function getJornadaObra('), bloque('function horasPactadasJornadaObra('),
  bloque('function fechaSiguiente('),
  bloque('function calcularJornadaDiaria('),
  bloque('const ESTADO_LEGIBLE_EXCEL = {') + ';', bloque('const ESTADO_EXTRAS_LEGIBLE = {') + ';',
  bloque('function construirFilasDetalleHoras('),
  `return { LEY, recargoDominicalFestivoPorFecha, calcularJornadaDiaria, extrasPagables, metaSemanalOrdinaria,
    horasPactadasJornadaObra, construirFilasDetalleHoras,
    setCatalogos: (c) => { catalogosCache = { horarios_obra: {}, jornadas_obra: {}, festivos: [], ...c }; } };`,
].join('\n');
const A = new Function(codigo)();

const SUELDO = 1750905;
const VH = SUELDO / A.LEY.FACTOR_MENSUAL; // valor hora = sueldo ÷ 210
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO');
let vigentes = 0, corregidos = 0;
function hallazgo(n, titulo, vigente, detalle) {
  if (vigente) vigentes++; else corregidos++;
  console.log(`${vigente ? '🔴 HALLAZGO VIGENTE' : '🟢 YA CORREGIDO   '} — demuestra el hallazgo ${n}: ${titulo}`);
  console.log(`      ${detalle}`);
}
const calc = (reg, tope = 8, catalogos = {}) => { A.setCatalogos(catalogos); return A.calcularJornadaDiaria(reg, tope); };

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 19 (turno de madrugada) — un turno ENTERO de noche, no solo un llamado: martes 10-nov-2026, entra 00:30 y
// sale 08:30 (8 h, 5,5 nocturnas) en una obra con entrada 07:30. Se compara con lo que da la misma app si la obra no
// tiene horario.
{
  const con = calc({ fecha: '2026-11-10', entrada: '00:30', salida: '08:30', obra: 'OBRA X' }, 8, { horarios_obra: { 'OBRA X': '07:30' } });
  const sin = calc({ fecha: '2026-11-10', entrada: '00:30', salida: '08:30' });
  hallazgo(19, 'turno de madrugada recortado a la hora de entrada de la obra', con.ord < sin.ord - 0.01,
    `App: ${con.ord} h ordinarias y ${con.recNoct} h de recargo nocturno. Sin horario de obra da: ${sin.ord} h y ${sin.recNoct} h. ` +
    `Recargo nocturno que no se paga: ${pesos((sin.recNoct - con.recNoct) * VH * A.LEY.RECARGO_NOCTURNO_ORDINARIO)} por turno; a un contratista le faltan ${(sin.ord - con.ord).toFixed(2)} h de pago.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 22 — El Excel trae las extras "no autorizadas" en las mismas columnas que las aprobadas.
{
  const dia = { cedula: '1', empleado_nombre: 'ANA', fecha: '2026-11-10', entrada: '07:30', salida: '19:00', horas_ordinarias: 8.5, horas_extras_diurnas: 2, extras_estado: 'no_autorizada', estado: 'completado' };
  const fila = A.construirFilasDetalleHoras([dia])[0];
  const pagables = A.extrasPagables(dia).extD;
  hallazgo(22, 'el Excel muestra horas extra que la app no paga, en la misma columna que las aprobadas', fila[12] > pagables,
    `Columna "EXTRAS DIURNAS" del Excel: ${fila[12]} h. Extras que Mi Tarjeta y el costo de Admin pagan: ${pagables} h. Quien sume la columna paga ${pesos((fila[12] - pagables) * VH * 1.25)} que RRHH no autorizó (el estado va en otra columna, al final).`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 23 — Domingo que termina el lunes, con extras todavía sin aprobar: se deja de pagar parte del recargo
// dominical de las horas ORDINARIAS. Domingo 22-nov-2026 de 14:00 a 02:00 del lunes.
{
  const c = calc({ fecha: '2026-11-22', entrada: '14:00', salida: '02:00' }, 9);
  const r = { fecha: '2026-11-22', horas_ordinarias: c.ord, horas_extras_diurnas: c.extD, horas_extras_nocturnas: c.extN, horas_dominicales: c.horas_dominicales, extras_estado: 'por_aprobar' };
  const pag = A.extrasPagables(r);
  const ordEnDomingo = Math.min(c.ord, c.horas_dominicales); // 9 h ordinarias, todas en domingo (14:00–23:00)
  hallazgo(23, 'recargo dominical de horas ordinarias retenido mientras las extras están por aprobar', pag.horasDom < ordEnDomingo - 0.01,
    `Ordinarias en domingo: ${ordEnDomingo} h. Mientras RRHH no aprueba las ${c.extD + c.extN} h extra, la app solo paga recargo dominical sobre ${pag.horasDom} h: faltan ${pesos((ordEnDomingo - pag.horasDom) * VH * A.recargoDominicalFestivoPorFecha(r.fecha))} (2 de las 3 h extra fueron ya el lunes).`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 24 — La meta de una semana con festivo siempre resta 8,5 h (8 h el viernes), aunque la obra tenga otra
// jornada. Obra con L–V 07:00–15:30 (7,5 h netas) y sábado 07:00–11:30 (4,5 h): total 42 h. Festivo lunes 16-nov-2026.
{
  const jornada = { entrada: '07:00', salida_lj: '15:30', salida_v: '15:30', almuerzo: true, sabado: { entrada: '07:00', salida: '11:30', almuerzo: false } };
  A.setCatalogos({ jornadas_obra: { 'OBRA S': jornada } });
  const hp = A.horasPactadasJornadaObra(jornada);
  const meta = A.metaSemanalOrdinaria('2026-11-16', []);
  const deberia = hp.total - hp.lj;
  hallazgo(24, 'la meta semanal con festivo no usa la jornada de la obra', Math.abs(meta - deberia) > 0.01,
    `Jornada de la obra: ${hp.total} h a la semana, ${hp.lj} h el lunes. Meta que da la app: ${meta} h. Debería: ${deberia} h. Diferencia de ${Math.abs(deberia - meta).toFixed(1)} h en "Mi semana", en el aviso de semana incompleta y en el tope del domingo.`);
}

console.log(`\n${vigentes} hallazgo(s) vigentes, ${corregidos} ya corregido(s). Detalle en docs/auditoria-nomina/INFORME.md. Este archivo es informativo: no falla el CI.`);
process.exit(0);
