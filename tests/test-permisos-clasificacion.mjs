// Prueba de regresión de la clasificación de permisos: cuáles son remunerados por ley (no se descuentan ni
// se reponen), cuáles son voluntarios (se descuentan o se reponen), la licencia no remunerada del art. 51 CST
// (exige acuerdo escrito) y los permisos que se rigen por el Reglamento Interno (exigen sustento).
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerAnticipacionPermisos } from './extraer-anticipacion-permisos.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-clasificacion.cjs');
const fuente = leerFuente(RUTA_INDEX);
fs.writeFileSync(RUTA_EXTRAIDO, extraerAnticipacionPermisos(fuente));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const m = require('./_extraido-clasificacion.cjs');

const results = [];
function ig(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  results.push({ nombre, ok });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `  (esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)})`}`);
}

const LEY = ['Cita médica (urgencia o especialista)', 'Calamidad doméstica', 'Diligencia judicial/entidad pública', 'Obligación escolar (acudiente)',
  'Votación o jurado de votación', 'Comisión sindical o entierro de compañero', 'Licencia por luto (familiar cercano)', 'Licencia por matrimonio',
  'Día libre por ir en bicicleta (transporte sostenible)'];
const PERSONAL = 'Permiso personal (según política interna)';
const ART51 = 'Licencia no remunerada (art. 51 CST)';
const REGLAMENTO = 'Permiso no contemplado en la ley (Reglamento Interno)';

// --- Remunerados por ley ---
ig('1. Los 9 permisos obligatorios por ley salen remunerados, sin pedir datos extra',
  LEY.map(t => { const r = m.clasificarPermiso(t, {}); return r.ok && r.campos.remuneracion === 'remunerado' && r.campos.categoria_legal === 'ley'; }), LEY.map(() => true));
ig('2. Vacaciones: remunerado, categoría vacaciones', m.clasificarPermiso('Vacaciones', {}).campos.categoria_legal, 'vacaciones');

// --- Voluntario ---
ig('3. Permiso personal sin elegir descuento o reposición -> se rechaza', m.clasificarPermiso(PERSONAL, {}).ok, false);
ig('4. Permiso personal "se descuenta" -> remuneracion=descuento', m.clasificarPermiso(PERSONAL, { compensacion: 'descuento' }).campos.remuneracion, 'descuento');
ig('5. Permiso personal "se repone" -> remuneracion=reposicion', m.clasificarPermiso(PERSONAL, { compensacion: 'reposicion' }).campos.remuneracion, 'reposicion');
ig('6. Permiso personal NO puede quedar como "remunerado"', m.clasificarPermiso(PERSONAL, { compensacion: 'remunerado' }).ok, false);

// --- Art. 51 ---
ig('7. Licencia no remunerada sin acuerdo escrito -> se rechaza', m.clasificarPermiso(ART51, {}).ok, false);
ig('8. Licencia no remunerada con acuerdo escrito -> no_remunerado y acuerdo guardado',
  (() => { const r = m.clasificarPermiso(ART51, { acuerdo: true }); return [r.ok, r.campos.remuneracion, r.campos.acuerdo_escrito]; })(), [true, 'no_remunerado', true]);

// --- Reglamento Interno ---
ig('9. Permiso no contemplado sin artículo del Reglamento -> se rechaza', m.clasificarPermiso(REGLAMENTO, { compensacion: 'remunerado' }).ok, false);
ig('10. Permiso no contemplado con artículo pero sin definir el pago -> se rechaza', m.clasificarPermiso(REGLAMENTO, { sustento: 'Art. 32' }).ok, false);
ig('11. Permiso no contemplado completo -> guarda el sustento y el pago',
  (() => { const r = m.clasificarPermiso(REGLAMENTO, { sustento: ' Art. 32 num. 4 ', compensacion: 'reposicion' }); return [r.ok, r.campos.remuneracion, r.campos.sustento_reglamento]; })(), [true, 'reposicion', 'Art. 32 num. 4']);
ig('12. Sin tipo o tipo desconocido -> se rechaza', [m.clasificarPermiso('', {}).ok, m.clasificarPermiso('Otro', {}).ok], [false, false]);

// --- Licencias en días ---
ig('13. Se piden en días: luto, matrimonio, bicicleta, licencia no remunerada y vacaciones; las citas y diligencias no',
  [ 'Licencia por luto (familiar cercano)', 'Licencia por matrimonio', LEY[8], ART51, 'Vacaciones', LEY[0], PERSONAL ].map(m.esTipoVariosDias), [true, true, true, true, true, false, false]);
ig('14. Luto: 5 días sí, 6 no', [m.validarDiasPermiso('Licencia por luto (familiar cercano)', 5).ok, m.validarDiasPermiso('Licencia por luto (familiar cercano)', 6).ok], [true, false]);
ig('15. Matrimonio: 3 días sí, 4 no', [m.validarDiasPermiso('Licencia por matrimonio', 3).ok, m.validarDiasPermiso('Licencia por matrimonio', 4).ok], [true, false]);
ig('16. Bicicleta: 1 día sí, 2 no', [m.validarDiasPermiso(LEY[8], 1).ok, m.validarDiasPermiso(LEY[8], 2).ok], [true, false]);
ig('17. Vacaciones sin tope (10 días sí) pero 0 días no', [m.validarDiasPermiso('Vacaciones', 10).ok, m.validarDiasPermiso('Vacaciones', 0).ok], [true, false]);
ig('18. Un permiso por horas no se valida por días', m.validarDiasPermiso(LEY[0], '').ok, true);
ig('19. Una licencia en días no pide hora de salida ni de regreso', m.validarHorarioPermiso('Licencia por luto (familiar cercano)', '', '').ok, true);
const ahora = new Date('2026-10-16T15:00:00-05:00');
ig('20. Licencia (luto) para hoy sin marcar emergencia -> se rechaza por la regla de anticipación',
  m.validarAnticipacionPermiso({ tipo: 'Licencia por luto (familiar cercano)', fecha: '2026-10-16', horaSalida: '', esEmergencia: false, ahora }).ok, false);
ig('21. Licencia (luto) para hoy marcando emergencia -> pasa',
  m.validarAnticipacionPermiso({ tipo: 'Licencia por luto (familiar cercano)', fecha: '2026-10-16', horaSalida: '', esEmergencia: true, ahora }).ok, true);

// --- Textos que se muestran ---
ig('22. Permiso antiguo (sin clasificación) de cita médica -> se muestra remunerado por ley', /obligatorio por ley/.test(m.textoRemuneracionPermiso({ tipo: 'Cita médica (urgencia o especialista)' })), true);
ig('23. Permiso personal antiguo (sin decisión guardada) -> no se inventa un texto', m.textoRemuneracionPermiso({ tipo: PERSONAL }), '');
ig('24. Se descuenta / se repone / no remunerado',
  [ 'descuento', 'reposicion', 'no_remunerado' ].map(r => m.textoRemuneracionPermiso({ tipo: PERSONAL, remuneracion: r })),
  ['Se descuenta del salario', 'El trabajador repone las horas', 'No remunerado (licencia art. 51 CST: contrato suspendido, sin pago de salario)']);
ig('25. El sustento del Reglamento se agrega al texto', m.textoRemuneracionPermiso({ tipo: REGLAMENTO, remuneracion: 'remunerado', sustento_reglamento: 'Art. 32' }), 'Remunerado — Reglamento Interno: Art. 32');

// --- El desplegable del formulario y el catálogo deben decir lo mismo ---
{
  const sel = fuente.slice(fuente.indexOf('id="permiso-tipo"'), fuente.indexOf('</select>', fuente.indexOf('id="permiso-tipo"')));
  const enHtml = [...sel.matchAll(/<option>([^<]+)<\/option>/g)].map(x => x[1]).sort();
  const enCatalogo = [...LEY, PERSONAL, ART51, REGLAMENTO, 'Vacaciones'].sort();
  ig('26. Las opciones del formulario coinciden exactamente con el catálogo de tipos', enHtml, enCatalogo);
}

console.log('\n========== RESUMEN ==========');
const fails = results.filter((r) => !r.ok);
console.log(`${results.length - fails.length} / ${results.length} casos correctos`);
if (fails.length > 0) { fails.forEach((f) => console.log(` - ${f.nombre}`)); process.exit(1); }
process.exit(0);
