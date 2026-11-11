// AUDITORÍA DE NÓMINA (nov-2026) — pruebas que DEMUESTRAN los hallazgos de docs/auditoria-nomina/INFORME-segunda-revision.md.
//
// OJO: este archivo NO forma parte del CI (.github/workflows/test-jornada.yml no lo corre) y NUNCA termina en error.
// Cada caso compara lo que la app calcula HOY con lo que debería calcular según el informe:
//   🔴 HALLAZGO VIGENTE  -> la app sigue dando el número señalado en el informe.
//   🟢 YA CORREGIDO      -> la app ya da el número esperado (cuando se corrija, pasar el caso a las pruebas normales).
//
// Igual que las demás pruebas, saca las funciones REALES de index.html (no copias). Uso:
//   node tests/auditoria-demuestra-hallazgos.mjs
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
  bloque('function estadoExtras('), bloque('function extrasPagables('), bloque('function horasOrdinariasEnDescanso('),
  bloque('function getHoraEsperadaObra('), bloque('function getJornadaObra('), bloque('function horasPactadasJornadaObra('),
  bloque('function fechaSiguiente('),
  bloque('function esAusenciaInjustificada('), bloque('function diasADescontarPorSemana('),
  bloque('function calcularDiasDescontadosPorAusenciasMes('),
  bloque('function calcularJornadaDiaria('), bloque('function calcularPagoExtras('),
  bloque('function duracionHorasEntre('), bloque('function horasDeSalidaPermiso('), bloque('function horasPermisoDescontadasMes('),
  linea('const TIPOS_AUSENCIA ='),
  linea('const PERMISOS_CATALOGO ='), bloque('function infoTipoPermiso('), bloque('function esTipoVariosDias('),
  bloque('const ESTADO_LEGIBLE_EXCEL = {') + ';', bloque('const ESTADO_EXTRAS_LEGIBLE = {') + ';',
  bloque('function construirFilasDetalleHoras('), bloque('function construirFilasPermisos('), bloque('function construirFilasAusencias('),
  `return { LEY, recargoDominicalFestivoPorFecha, esDiaFestivo, calcularJornadaDiaria, calcularPagoExtras, extrasPagables,
    horasOrdinariasEnDescanso, metaSemanalOrdinaria, horasPermisoDescontadasMes, calcularDiasDescontadosPorAusenciasMes,
    horasPactadasJornadaObra, construirFilasDetalleHoras, estadoExtras,
    setCatalogos: (c) => { catalogosCache = { horarios_obra: {}, jornadas_obra: {}, festivos: [], ...c }; } };`,
].join('\n');
const A = new Function(codigo)();

const SUELDO = 1750905;
const VH = SUELDO / A.LEY.FACTOR_MENSUAL; // valor hora = sueldo ÷ 210
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO');
let vigentes = 0, corregidos = 0;
// vigente: true si la app sigue mostrando el problema.
function hallazgo(n, titulo, vigente, detalle) {
  if (vigente) vigentes++; else corregidos++;
  console.log(`${vigente ? '🔴 HALLAZGO VIGENTE' : '🟢 YA CORREGIDO   '} — demuestra el hallazgo ${n}: ${titulo}`);
  console.log(`      ${detalle}`);
}
const OBRA_730 = { horarios_obra: { 'OBRA X': '07:30' } };
const calc = (reg, tope = 8, catalogos = {}) => { A.setCatalogos(catalogos); return A.calcularJornadaDiaria(reg, tope); };

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 1 — Turno de madrugada en una obra con hora de entrada 07:30: se paga solo desde las 07:30.
// Martes 10-nov-2026, entra 00:30 y sale 08:30 (8 h, 5,5 de ellas nocturnas). Sin obra configurada la app da 7 h
// ordinarias (descuenta 1 h de almuerzo) y 4,5 h de recargo nocturno. Con la obra a las 07:30 da 1 h y 0 de recargo.
{
  const con = calc({ fecha: '2026-11-10', entrada: '00:30', salida: '08:30', obra: 'OBRA X' }, 8, OBRA_730);
  const sin = calc({ fecha: '2026-11-10', entrada: '00:30', salida: '08:30' });
  hallazgo(1, 'turno de madrugada recortado a la hora de entrada de la obra', con.ord < sin.ord - 0.01,
    `App: ${con.ord} h ordinarias y ${con.recNoct} h de recargo nocturno. Debería (como sin horario de obra): ${sin.ord} h y ${sin.recNoct} h. ` +
    `Recargo nocturno que no se paga: ${pesos((sin.recNoct - con.recNoct) * VH * A.LEY.RECARGO_NOCTURNO_ORDINARIO)}; a un contratista le faltan ${(sin.ord - con.ord).toFixed(2)} h de pago.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 2 — El Excel para nómina omite los días TRABAJADOS que además tienen un tipo de permiso.
{
  const filas = [
    { cedula: '1', empleado_nombre: 'ANA', fecha: '2026-11-11', entrada: '10:00', salida: '19:00', horas_ordinarias: 6, horas_extras_diurnas: 2, extras_estado: 'aprobada', tipo_permiso: 'Cita médica (urgencia o especialista)', horas_permiso: 2.5, estado: 'completado' },
    { cedula: '1', empleado_nombre: 'ANA', fecha: '2026-11-12', entrada: '07:30', salida: '12:00', horas_ordinarias: 4.5, tipo_permiso: 'Se devolvió', horas_permiso: 4, estado: 'completado' },
    { cedula: '1', empleado_nombre: 'ANA', fecha: '2026-11-15', entrada: '07:00', salida: '15:00', horas_ordinarias: 8, horas_dominicales: 8, es_dominical_festivo: true, tipo_permiso: 'Personal', horas_permiso: 1, estado: 'completado' },
  ];
  const enDetalle = A.construirFilasDetalleHoras(filas).length;
  const valor = 2 * VH * 1.25 + 8 * VH * (1 + A.recargoDominicalFestivoPorFecha('2026-11-15'));
  hallazgo(2, 'el Excel deja por fuera los días trabajados que tienen permiso', enDetalle < 3,
    `De 3 días con horas trabajadas, la tabla "Detalle de horas y extras" trae ${enDetalle}. Faltan 18,5 h ordinarias, 2 h extra aprobadas y 8 h de domingo: ${pesos(valor)} que Mi Tarjeta sí muestra y el Excel no.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 5 — Contratista con una ausencia injustificada: se le descuentan 2 días (16 h) aunque cobra por hora.
// (La resta está en calculateMonthlyAccumulated: valorDia = tarifa_hora × 8; aquí se reproduce con la función real
// que cuenta los días.)
{
  const regs = [
    { fecha: '2026-11-09', horas_ordinarias: 8.5, estado: 'completado' },
    { fecha: '2026-11-10', tipo_permiso: 'Ausencia injustificada', horas_ordinarias: 0, estado: 'completado' },
    { fecha: '2026-11-11', horas_ordinarias: 8.5, estado: 'completado' },
    { fecha: '2026-11-12', horas_ordinarias: 8.5, estado: 'completado' },
    { fecha: '2026-11-13', horas_ordinarias: 8, estado: 'completado' },
  ];
  const dias = A.calcularDiasDescontadosPorAusenciasMes(regs, '2026-11');
  const tarifa = 10000;
  const trabajado = 33.5 * tarifa, descuento = dias * tarifa * A.LEY.JORNADA_ORDINARIA_DIARIA;
  hallazgo(5, 'al contratista se le descuenta el día y el domingo aunque solo cobra las horas trabajadas', dias === 2 && /esContratista \? tarifaHora \* LEY\.JORNADA_ORDINARIA_DIARIA : base \/ 30/.test(fuente),
    `Trabajó 33,5 h a ${pesos(tarifa)} = ${pesos(trabajado)}. La app le resta ${dias} días × 8 h = ${pesos(descuento)} y muestra ${pesos(trabajado - descuento)}. El día que faltó ya no se le paga (no tiene horas): debería mostrar ${pesos(trabajado)}.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 8 — Dos salidas a permiso el mismo día: el descuento usa el tiempo total fuera (incluida la hora de
// almuerzo y lo que pasa de la salida pactada), no las horas de permiso que calculó la jornada.
{
  const reg = { fecha: '2026-11-10', entrada: '07:30', salida: '17:00', estado: 'completado',
    salidas_permiso: [{ motivo: 'Permiso personal', sale: '09:00', vuelve: '10:00' }, { motivo: 'Permiso personal', sale: '11:45', vuelve: '13:30' }],
    decisiones_permiso: { 0: { decision: 'descuenta' }, 1: { decision: 'descuenta' } } };
  const c = calc(reg);
  reg.horas_permiso_turno = c.horasPermiso;
  const descontadas = A.horasPermisoDescontadasMes([reg], '2026-11');
  hallazgo(8, 'con dos salidas a permiso se descuentan más horas de las que la jornada contó como permiso', descontadas > c.horasPermiso + 0.01,
    `La jornada contó ${c.horasPermiso} h de permiso (sin la hora de almuerzo). El descuento usa ${descontadas} h: ${pesos((descontadas - c.horasPermiso) * VH)} de más. Con UNA sola salida sí usa las horas de la jornada.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 9 — Domingo que termina el lunes, con extras todavía sin aprobar: se deja de pagar parte del recargo
// dominical de las horas ORDINARIAS. Domingo 22-nov-2026 de 14:00 a 02:00 del lunes.
{
  const c = calc({ fecha: '2026-11-22', entrada: '14:00', salida: '02:00' }, 9);
  const r = { fecha: '2026-11-22', horas_ordinarias: c.ord, horas_extras_diurnas: c.extD, horas_extras_nocturnas: c.extN, horas_dominicales: c.horas_dominicales, extras_estado: 'por_aprobar' };
  const pag = A.extrasPagables(r);
  const ordEnDomingo = Math.min(c.ord, c.horas_dominicales); // 9 h ordinarias, todas en domingo (14:00–23:00)
  hallazgo(9, 'recargo dominical de horas ordinarias retenido mientras las extras están por aprobar', pag.horasDom < ordEnDomingo - 0.01,
    `Ordinarias en domingo: ${ordEnDomingo} h. Mientras RRHH no aprueba las ${c.extD + c.extN} h extra, la app solo paga recargo dominical sobre ${pag.horasDom} h: faltan ${pesos((ordEnDomingo - pag.horasDom) * VH * A.recargoDominicalFestivoPorFecha(r.fecha))} (2 de las 3 h extra fueron ya el lunes).`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 10 — La meta de una semana con festivo siempre resta 8,5 h (8 h el viernes), aunque la obra tenga otra
// jornada. Obra con L–V 07:00–15:30 (7,5 h netas) y sábado 07:00–11:30 (4,5 h): total 42 h. Festivo lunes 16-nov-2026.
{
  const jornada = { entrada: '07:00', salida_lj: '15:30', salida_v: '15:30', almuerzo: true, sabado: { entrada: '07:00', salida: '11:30', almuerzo: false } };
  A.setCatalogos({ jornadas_obra: { 'OBRA S': jornada } });
  const hp = A.horasPactadasJornadaObra(jornada);
  const meta = A.metaSemanalOrdinaria('2026-11-16', []);
  const deberia = hp.total - hp.lj;
  hallazgo(10, 'la meta semanal con festivo no usa la jornada de la obra', Math.abs(meta - deberia) > 0.01,
    `Jornada de la obra: ${hp.total} h a la semana, ${hp.lj} h el lunes. Meta que da la app: ${meta} h. Debería: ${deberia} h. Diferencia de ${Math.abs(deberia - meta).toFixed(1)} h en "Mi semana", en el aviso de semana incompleta y en el tope del domingo.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Hallazgo 13 — Los festivos llegan hasta dic-2028: el 1-ene-2029 se liquidaría como día normal.
{
  hallazgo(13, 'no hay festivos cargados desde 2029', A.esDiaFestivo('2028-12-25') && !A.esDiaFestivo('2029-01-01'),
    `1-ene-2029 festivo en la app: ${A.esDiaFestivo('2029-01-01')}. Un turno de 8 h ese día dejaría de pagar ${pesos(8 * VH * (1 + A.recargoDominicalFestivoPorFecha('2029-01-01')))}.`);
}

// ---------------------------------------------------------------------------------------------------------------
// PREGUNTAS PARA RRHH (decisiones de INDIMON con efecto en pesos; no son errores de cálculo).
console.log('\n--- Decisiones de INDIMON con su efecto en pesos (preguntas para RRHH, no errores) ---');
{
  // P1: llega 4,5 h tarde y se queda: 8 h trabajadas dan 4 h ordinarias + 4 h extra.
  const c = calc({ fecha: '2026-11-10', entrada: '12:00', salida: '21:00', obra: 'OBRA X' }, 8, OBRA_730);
  console.log(`P1 (decisión 1) Entra 12:00, sale 21:00 (obra 07:30): ${c.ord} h ordinarias + ${c.extD} h extra diurna + ${c.extN} h extra nocturna = ${pesos(A.calcularPagoExtras(SUELDO, c.extD, c.extN, c.recNoct, 0))} en extras, con 4,5 h de tardanza sin descontar.`);
  // P2: tolerancia de salida: 14 minutos diarios no se pagan.
  const t = calc({ fecha: '2026-11-10', entrada: '07:30', salida: '17:14' });
  console.log(`P2 (decisión 1) Sale 17:14 todos los días: ${t.extD} h extra. 14 min × 21 días = 4,9 h al mes sin pagar = ${pesos(4.9 * VH * 1.25)}.`);
  // P3: almuerzo de 46 min: 14 minutos más de trabajo que quedan como "ordinarios" (no suman pago en salario mensual).
  const a = calc({ fecha: '2026-11-10', entrada: '07:30', salida: '17:00', almuerzo_inicio: '12:00', almuerzo_fin: '12:46' });
  console.log(`P3 Almuerza 46 min: ${a.ord} h ordinarias (pactadas 8,5) y ${a.extD} h extra: esos 14 min no generan pago.`);
  // P4: se fue 2 h a una cita y se quedó 2 h después de la salida: esas 2 h son extra.
  const p = calc({ fecha: '2026-11-10', entrada: '07:30', salida: '19:00', salidas_permiso: [{ sale: '08:00', vuelve: '10:00' }] });
  console.log(`P4 (decisión 11) Cita 08:00–10:00 y sale 19:00: ${p.ord} h ordinarias + ${p.horasPermiso} h de permiso pagado + ${p.extD} h extra (${pesos(p.extD * VH * 1.25)}). Si RRHH decide "se repone", ¿esas 2 h siguen siendo extra?`);
  // P5: horas extra de días anteriores al 21-oct-2026 se pagan sin aprobación.
  console.log(`P5 (decisión 6) Estado de las extras de un día del 20-oct-2026 sin revisar: "${A.estadoExtras({ fecha: '2026-10-20', horas_extras_diurnas: 3 })}" (se pagan sin aprobación de RRHH).`);
}

console.log(`\n${vigentes} hallazgo(s) vigentes, ${corregidos} ya corregido(s). Este archivo es informativo: no falla el CI.`);
process.exit(0);
