// Pago del trabajo en domingo o festivo (art. 179 CST, mod. Ley 2466 de 2025) para salario mensual: el sueldo ya paga
// el día como descanso, así que las horas ORDINARIAS trabajadas ese día se pagan aparte al 100 % + el recargo
// (90 % entre jul-2026 y jun-2027). Las extras del día ya llevan su 100 % dentro del ×1,25 / ×1,75.
//
// Saca de index.html las funciones reales (no copias) y comprueba los casos. Uso: node tests/test-festivo-trabajado.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fuente = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const bloque = (inicio) => {
  const i = fuente.indexOf(inicio);
  if (i < 0) throw new Error('No se encontró: ' + inicio);
  let nivel = 0, j = fuente.indexOf('{', i);
  for (let k = j; k < fuente.length; k++) {
    if (fuente[k] === '{') nivel++;
    else if (fuente[k] === '}' && --nivel === 0) return fuente.slice(i, k + 1);
  }
};
const codigo = [
  bloque('const LEY = {') + ';',
  bloque('function recargoDominicalFestivoPorFecha('),
  bloque('function horasOrdinariasEnDescanso('),
  bloque('function calcularPagoExtras('),
  'return { LEY, recargoDominicalFestivoPorFecha, horasOrdinariasEnDescanso, calcularPagoExtras };',
].join('\n');
const { LEY, recargoDominicalFestivoPorFecha, horasOrdinariasEnDescanso, calcularPagoExtras } = new Function(codigo)();

const resultados = [];
const caso = (nombre, obtenido, esperado) => {
  const ok = Math.abs(obtenido - esperado) < 0.5;
  resultados.push(ok);
  console.log(`${ok ? '✅' : '❌'} ${nombre}: ${obtenido.toFixed(2)}${ok ? '' : ' (esperado ' + esperado.toFixed(2) + ')'}`);
};

// Pago adicional al sueldo de un día, igual que en Mi Tarjeta y en el costo de mano de obra.
const pagoDia = (base, r) => {
  const vh = base / LEY.FACTOR_MENSUAL;
  const dom = r.horas_dominicales != null ? r.horas_dominicales : (r.es_dominical_festivo ? (r.horas_ordinarias || 0) : 0);
  return calcularPagoExtras(base, r.horas_extras_diurnas || 0, r.horas_extras_nocturnas || 0, r.horas_recargo_nocturno || 0, dom * recargoDominicalFestivoPorFecha(r.fecha))
    + horasOrdinariasEnDescanso(r) * vh;
};
const BASE = 1750905, VH = BASE / 210;

// Lunes festivo 2-nov-2026, 7:00–20:10 con 1 h de almuerzo: 9 ord + 2 ED + 1,17 EN, todo en festivo.
const festivo = { fecha: '2026-11-02', es_dominical_festivo: true, horas_ordinarias: 9, horas_extras_diurnas: 2, horas_extras_nocturnas: 1.17, horas_dominicales: 12.17 };
caso('Festivo: horas ordinarias que suman el 100 %', horasOrdinariasEnDescanso(festivo), 9);
caso('Festivo: recargo de nov-2026 es 90 %', recargoDominicalFestivoPorFecha('2026-11-02') * 100, 90);
caso('Festivo: pago total = 9×1,90 + 2×(1,25+0,90) + 1,17×(1,75+0,90) horas',
  pagoDia(BASE, festivo), VH * (9 * 1.90 + 2 * 2.15 + 1.17 * 2.65));
caso('Festivo: con sueldo de $1.750.905 da $204.276', pagoDia(BASE, festivo), 204276);

// Día normal entre semana: nada de recargo ni del 100 % adicional (el sueldo ya lo paga).
const normal = { fecha: '2026-11-03', es_dominical_festivo: false, horas_ordinarias: 8.5, horas_extras_diurnas: 1, horas_dominicales: 0 };
caso('Día normal: 0 horas ordinarias en descanso', horasOrdinariasEnDescanso(normal), 0);
caso('Día normal: solo la extra diurna ×1,25', pagoDia(BASE, normal), VH * 1.25);

// Registro antiguo sin horas_dominicales: se toman las ordinarias del día festivo.
caso('Festivo antiguo (sin horas_dominicales)', horasOrdinariasEnDescanso({ es_dominical_festivo: true, horas_ordinarias: 8 }), 8);

// Turno de sábado 22:00 a domingo 6:00: solo las 6 h del domingo son de descanso.
caso('Turno que entra al domingo: solo las horas del domingo', horasOrdinariasEnDescanso({ es_dominical_festivo: false, horas_ordinarias: 8, horas_dominicales: 6 }), 6);

// Festivo con permiso o ausencia (0 horas trabajadas): no hay nada que pagar aparte.
caso('Festivo sin horas trabajadas', horasOrdinariasEnDescanso({ es_dominical_festivo: true, horas_ordinarias: 0, horas_dominicales: 0 }), 0);

const ok = resultados.filter(Boolean).length;
console.log(`\n${ok} / ${resultados.length} casos correctos`);
process.exit(ok === resultados.length ? 0 : 1);
