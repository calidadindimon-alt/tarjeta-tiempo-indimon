// Prueba de qué recordatorios le tocan a un colaborador (scripts/recordatorios-logica.mjs): almuerzo ANTES de la hora
// de almuerzo de su obra, regreso del almuerzo a los 75 min, salida 30 min después de la salida pactada de su obra y segundo aviso a
// las 8:00 p. m. Cada uno una sola vez por día.
import { recordatoriosPendientes, salidaPactada, horaAlmuerzo } from '../scripts/recordatorios-logica.mjs';

let fallas = 0, total = 0;
const caso = (nombre, obtenido, esperado) => {
  total++;
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${nombre}${ok ? '' : `\n      esperado ${JSON.stringify(esperado)}\n      obtuvo   ${JSON.stringify(obtenido)}`}`);
};

const catalogos = {
  horarios_obra: { BODEGA: '07:30', 'ECLA-YUMBO': '07:00' },
  jornadas_obra: {
    BODEGA: { entrada: '07:30', salida_lj: '17:00', salida_v: '16:30', almuerzo: true, sabado: null },
    TEMPRANO: { entrada: '06:00', salida_lj: '15:30', salida_v: '15:00', almuerzo: true, hora_almuerzo: '11:30', sabado: { entrada: '06:00', salida: '12:00', almuerzo: false } },
    NOCHE: { entrada: '13:00', salida_lj: '21:30', salida_v: '21:30', almuerzo: false, sabado: null },
    CORRIDO: { entrada: '06:00', salida_lj: '14:00', salida_v: '14:00', almuerzo: false, sabado: { entrada: '07:00', salida: '12:00', almuerzo: false } },
  },
};
const festivos = new Set(['2026-11-02']);
const MIE = '2026-10-21', VIE = '2026-10-23', SAB = '2026-10-24', DOM = '2026-10-25';
const tipos = (args) => recordatoriosPendientes({ catalogos, festivos, nombre: 'WILLINTONG LERMA VALLECILLA', ...args }).map(r => r.tipo);
const turno = (extra = {}) => ({ obra: 'BODEGA', entrada: '07:28', estado: 'en_turno', ...extra });

caso('1. Salida pactada: L–J y viernes de la obra; sin jornada, entrada + 9,5 h; domingo y festivo sin salida',
  [salidaPactada(catalogos, 'BODEGA', MIE, festivos), salidaPactada(catalogos, 'BODEGA', VIE, festivos),
   salidaPactada(catalogos, 'ECLA-YUMBO', MIE, festivos), salidaPactada(catalogos, 'BODEGA', DOM, festivos),
   salidaPactada(catalogos, 'BODEGA', '2026-11-02', festivos), salidaPactada(catalogos, 'CORRIDO', SAB, festivos)],
  ['17:00', '16:30', '16:30', null, null, '12:00']);

caso('2. Hora del almuerzo: la de la obra, 12:00 si no tiene; sin almuerzo el domingo, festivo, sábado sin almuerzo u obra sin almuerzo',
  [horaAlmuerzo(catalogos, 'TEMPRANO', MIE, festivos), horaAlmuerzo(catalogos, 'BODEGA', MIE, festivos), horaAlmuerzo(catalogos, 'ECLA-YUMBO', MIE, festivos),
   horaAlmuerzo(catalogos, 'BODEGA', DOM, festivos), horaAlmuerzo(catalogos, 'BODEGA', '2026-11-02', festivos), horaAlmuerzo(catalogos, 'TEMPRANO', SAB, festivos),
   horaAlmuerzo(catalogos, 'CORRIDO', MIE, festivos)],
  ['11:30', '12:00', '12:00', null, null, null, null]);
caso('3. Almuerzo a las 12:00: a las 11:07 todavía nada; a las 11:37 llega el aviso (23 min antes)',
  [tipos({ ahora: '11:07', fecha: MIE, registro: turno() }), tipos({ ahora: '11:37', fecha: MIE, registro: turno() })], [[], ['almuerzo']]);
caso('4. … aunque GitHub se atrase 15 min (11:52), llega antes de las 12:00; y no se repite',
  [tipos({ ahora: '11:52', fecha: MIE, registro: turno() }), tipos({ ahora: '11:52', fecha: MIE, registro: turno(), enviados: ['almuerzo'] })], [['almuerzo'], []]);
caso('5. Ya es la hora del almuerzo o pasó: ya no se manda (no tiene sentido después)',
  [tipos({ ahora: '12:00', fecha: MIE, registro: turno() }), tipos({ ahora: '12:37', fecha: MIE, registro: turno() })], [[], []]);
caso('6. Obra con almuerzo a las 11:30: aviso a las 11:07; ya marcó el almuerzo o "no tomo almuerzo": nada',
  [tipos({ ahora: '11:07', fecha: MIE, registro: turno({ obra: 'TEMPRANO', entrada: '06:00' }) }),
   tipos({ ahora: '11:37', fecha: MIE, registro: turno({ almuerzo_omitido: true }) }),
   tipos({ ahora: '11:37', fecha: MIE, registro: turno({ almuerzo_inicio: '11:35' }) })], [['almuerzo'], [], []]);
caso('7. Salió a almorzar 12:00 y a la 1:07 p. m. no ha vuelto: todavía nada (67 min)',
  tipos({ ahora: '13:07', fecha: MIE, registro: turno({ almuerzo_inicio: '12:00' }) }), []);
caso('8. … a la 1:37 p. m. (97 min): aviso de regreso del almuerzo',
  tipos({ ahora: '13:37', fecha: MIE, registro: turno({ almuerzo_inicio: '12:00' }) }), ['regreso']);

const conAlmuerzo = turno({ almuerzo_inicio: '12:00', almuerzo_fin: '13:00' });
caso('9. Miércoles 5:07 p. m. (salida 5:00): todavía nada', tipos({ ahora: '17:07', fecha: MIE, registro: conAlmuerzo }), []);
caso('10. Miércoles 5:37 p. m.: primer aviso de salida', tipos({ ahora: '17:37', fecha: MIE, registro: conAlmuerzo }), ['salida1']);
caso('11. Viernes 5:07 p. m. (salida 4:30): primer aviso de salida', tipos({ ahora: '17:07', fecha: VIE, registro: conAlmuerzo }), ['salida1']);
caso('12. 8:07 p. m. con el primero ya enviado: segundo aviso', tipos({ ahora: '20:07', fecha: MIE, registro: conAlmuerzo, enviados: ['salida1'] }), ['salida2']);
caso('13. 8:07 p. m. sin el primero (GitHub se atrasó): solo el segundo, no los dos juntos',
  tipos({ ahora: '20:07', fecha: MIE, registro: conAlmuerzo }), ['salida2']);
caso('14. Domingo (sin salida pactada): solo el aviso de las 8:00 p. m.',
  [tipos({ ahora: '18:07', fecha: DOM, registro: conAlmuerzo }), tipos({ ahora: '20:07', fecha: DOM, registro: conAlmuerzo })], [[], ['salida2']]);
caso('15. Ya marcó la salida, o el día está completo: nada',
  [tipos({ ahora: '20:07', fecha: MIE, registro: turno({ salida: '17:02' }) }), tipos({ ahora: '20:07', fecha: MIE, registro: turno({ estado: 'completado' }) })], [[], []]);
caso('16. Sin registro hoy: nada', tipos({ ahora: '17:37', fecha: MIE, registro: null }), []);
caso('17. Turno de tarde que termina a las 21:30: el primer aviso es a las 22:00, sin aviso de las 8:00 p. m.',
  tipos({ ahora: '20:07', fecha: MIE, registro: turno({ obra: 'NOCHE', entrada: '13:00', almuerzo_omitido: true }) }).filter(t => t.startsWith('salida')), []);
const msg = recordatoriosPendientes({ ahora: '17:37', fecha: MIE, registro: conAlmuerzo, catalogos, festivos, nombre: 'WILLINTONG LERMA VALLECILLA' })[0];
caso('18. El mensaje saluda por el primer nombre y dice la obra y la hora de entrada',
  [msg.titulo, msg.cuerpo.startsWith('Tu turno en BODEGA sigue abierto desde las 07:28.')], ['¿Ya saliste, Willintong?', true]);

console.log(`\n${total - fallas} / ${total} casos correctos`);
process.exit(fallas ? 1 : 0);
