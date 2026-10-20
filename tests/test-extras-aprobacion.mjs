// Prueba de la aprobación de horas extra por RRHH: estadoExtras() y extrasPagables(), extraídas textualmente
// de index.html. Desde FECHA_INICIO_APROBACION_EXTRAS las extras no entran a la nómina hasta que RRHH las
// apruebe; "no autorizada" no borra las horas; los días anteriores se pagan como siempre.
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente, bloqueBalanceado, hastaPuntoYComa } from './extraer-calculadora.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const fuente = leerFuente(process.argv[2] || join(DIR, '..', 'index.html'));
const RUTA = join(DIR, '_extraido-extras.cjs');
fs.writeFileSync(RUTA, ['"use strict";',
  hastaPuntoYComa(fuente, 'const FECHA_INICIO_APROBACION_EXTRAS ='),
  bloqueBalanceado(fuente, 'function estadoExtras(r) {'),
  bloqueBalanceado(fuente, 'function extrasPagables(r) {'),
  'module.exports = { estadoExtras, extrasPagables, FECHA_INICIO_APROBACION_EXTRAS };'].join('\n\n'));
const require = createRequire(import.meta.url);
const { estadoExtras, extrasPagables, FECHA_INICIO_APROBACION_EXTRAS } = require('./_extraido-extras.cjs');

let fallas = 0, total = 0;
const caso = (nombre, obtenido, esperado) => {
  total++;
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `\n      esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)}`}`);
};
const r2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));

const DESPUES = '2026-10-22';
const ANTES = '2026-10-16';
caso('0. La aprobación empieza el 21 de octubre de 2026', FECHA_INICIO_APROBACION_EXTRAS, '2026-10-21');

caso('1. Día sin horas extra: no tiene estado de extras', estadoExtras({ fecha: DESPUES, horas_ordinarias: 8.5 }), null);
caso('2. Extras de un día anterior al inicio (sin campo): se pagan como siempre', estadoExtras({ fecha: ANTES, horas_extras_diurnas: 1 }), 'anterior');
caso('3. Extras de un día nuevo sin campo (p. ej. cargado por Admin): por aprobar', estadoExtras({ fecha: DESPUES, horas_extras_diurnas: 1 }), 'por_aprobar');
caso('4. El estado guardado manda', estadoExtras({ fecha: DESPUES, horas_extras_diurnas: 1, extras_estado: 'aprobada' }), 'aprobada');

caso('5. Por aprobar: no se pagan las extras y quedan como pendientes',
  r2(extrasPagables({ fecha: DESPUES, horas_ordinarias: 8, horas_extras_diurnas: 1.5, horas_extras_nocturnas: 0.5, extras_estado: 'por_aprobar' })),
  { extD: 0, extN: 0, horasDom: 0, pendientes: 2 });
caso('6. Aprobadas: se pagan completas',
  r2(extrasPagables({ fecha: DESPUES, horas_ordinarias: 8, horas_extras_diurnas: 1.5, horas_extras_nocturnas: 0.5, extras_estado: 'aprobada' })),
  { extD: 1.5, extN: 0.5, horasDom: 0, pendientes: 0 });
caso('7. No autorizadas: no se pagan, pero tampoco cuentan como pendientes (RRHH ya decidió)',
  r2(extrasPagables({ fecha: DESPUES, horas_ordinarias: 8, horas_extras_diurnas: 2, extras_estado: 'no_autorizada' })),
  { extD: 0, extN: 0, horasDom: 0, pendientes: 0 });
caso('8. Domingo con extras por aprobar: el recargo dominical solo se paga sobre la parte ordinaria',
  r2(extrasPagables({ fecha: '2026-10-25', es_dominical_festivo: true, horas_ordinarias: 8, horas_extras_diurnas: 3, horas_dominicales: 11, extras_estado: 'por_aprobar' })),
  { extD: 0, extN: 0, horasDom: 8, pendientes: 3 });
caso('9. Domingo con extras aprobadas: recargo dominical sobre todo el día',
  r2(extrasPagables({ fecha: '2026-10-25', es_dominical_festivo: true, horas_ordinarias: 8, horas_extras_diurnas: 3, horas_dominicales: 11, extras_estado: 'aprobada' })),
  { extD: 3, extN: 0, horasDom: 11, pendientes: 0 });
caso('10. Día anterior al inicio: se paga como siempre (sin cambios en la nómina ya liquidada)',
  r2(extrasPagables({ fecha: ANTES, horas_ordinarias: 8, horas_extras_diurnas: 1 })),
  { extD: 1, extN: 0, horasDom: 0, pendientes: 0 });

console.log(`\n${total - fallas} / ${total} casos correctos`);
process.exit(fallas ? 1 : 0);
