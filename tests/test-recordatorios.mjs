// Prueba de qué recordatorios le tocan a un colaborador (scripts/recordatorios-logica.mjs): 5 min antes del almuerzo y
// de la salida de su obra, regreso del almuerzo a los 75 min y, si olvidó marcar la salida, a las 5:30 p. m. y 7:30 p. m.
// Cada uno una sola vez por día.
import { recordatoriosPendientes, salidaPactada, horaAlmuerzo, dentroDelHorarioDeEnvio } from '../scripts/recordatorios-logica.mjs';

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
caso('3. Almuerzo a las 12:00 (corridas cada 5 min): 11:50 todavía nada; 11:55 llega el aviso; 12:00 ya no',
  ['11:50', '11:55', '12:00'].map(ahora => tipos({ ahora, fecha: MIE, registro: turno() })), [[], ['almuerzo'], []]);
caso('4. … si la corrida se atrasa 2 min (11:57) igual llega antes de las 12:00; y no se repite',
  [tipos({ ahora: '11:57', fecha: MIE, registro: turno() }), tipos({ ahora: '11:57', fecha: MIE, registro: turno(), enviados: ['almuerzo'] })], [['almuerzo'], []]);
caso('5. Ya es la hora del almuerzo o pasó: ya no se manda (no tiene sentido después)',
  [tipos({ ahora: '12:00', fecha: MIE, registro: turno() }), tipos({ ahora: '12:35', fecha: MIE, registro: turno() })], [[], []]);
caso('6. Obra con almuerzo a las 11:30: aviso a las 11:25; ya marcó el almuerzo o "no tomo almuerzo": nada',
  [tipos({ ahora: '11:25', fecha: MIE, registro: turno({ obra: 'TEMPRANO', entrada: '06:00' }) }),
   tipos({ ahora: '11:55', fecha: MIE, registro: turno({ almuerzo_omitido: true }) }),
   tipos({ ahora: '11:55', fecha: MIE, registro: turno({ almuerzo_inicio: '11:50' }) })], [['almuerzo'], [], []]);
caso('7. Salió a almorzar 12:00 y a la 1:07 p. m. no ha vuelto: todavía nada (67 min)',
  tipos({ ahora: '13:07', fecha: MIE, registro: turno({ almuerzo_inicio: '12:00' }) }), []);
caso('8. … a la 1:37 p. m. (97 min): aviso de regreso del almuerzo',
  tipos({ ahora: '13:37', fecha: MIE, registro: turno({ almuerzo_inicio: '12:00' }) }), ['regreso']);

const conAlmuerzo = turno({ almuerzo_inicio: '12:00', almuerzo_fin: '13:00' });
caso('9. Miércoles (salida 5:00): 4:50 nada; 4:55 aviso de salida; 5:00 y 5:25 nada',
  ['16:50', '16:55', '17:00', '17:25'].map(ahora => tipos({ ahora, fecha: MIE, registro: conAlmuerzo, enviados: ahora > '16:55' ? ['salida0'] : [] })), [[], ['salida0'], [], []]);
caso('10. Olvidó marcar la salida: aviso a las 5:30 p. m. y otro a las 7:30 p. m.',
  [tipos({ ahora: '17:30', fecha: MIE, registro: conAlmuerzo, enviados: ['salida0'] }),
   tipos({ ahora: '19:25', fecha: MIE, registro: conAlmuerzo, enviados: ['salida0', 'salida1'] }),
   tipos({ ahora: '19:30', fecha: MIE, registro: conAlmuerzo, enviados: ['salida0', 'salida1'] })], [['salida1'], [], ['salida2']]);
caso('11. Viernes (salida 4:30): aviso a las 4:25 y, si lo olvida, a las 5:30 y 7:30',
  [tipos({ ahora: '16:25', fecha: VIE, registro: conAlmuerzo }), tipos({ ahora: '17:30', fecha: VIE, registro: conAlmuerzo, enviados: ['salida0'] })], [['salida0'], ['salida1']]);
caso('12. Obra que sale a las 3:30 p. m.: aviso a las 3:25 y el de olvido a las 5:30 (no antes)',
  [tipos({ ahora: '15:25', fecha: MIE, registro: turno({ obra: 'TEMPRANO', entrada: '06:00', almuerzo_omitido: true }) }),
   tipos({ ahora: '16:00', fecha: MIE, registro: turno({ obra: 'TEMPRANO', entrada: '06:00', almuerzo_omitido: true }), enviados: ['salida0'] }),
   tipos({ ahora: '17:30', fecha: MIE, registro: turno({ obra: 'TEMPRANO', entrada: '06:00', almuerzo_omitido: true }), enviados: ['salida0'] })], [['salida0'], [], ['salida1']]);
caso('13. 7:35 p. m. sin el de las 5:30 (la tarea no corrió): solo el de las 7:30, no los dos juntos',
  tipos({ ahora: '19:35', fecha: MIE, registro: conAlmuerzo, enviados: ['salida0'] }), ['salida2']);
caso('14. Domingo (sin salida pactada): nada a las 4:55 ni a las 5:30; solo el aviso de las 7:30 p. m.',
  ['16:55', '17:30', '19:30'].map(ahora => tipos({ ahora, fecha: DOM, registro: conAlmuerzo })), [[], [], ['salida2']]);
caso('15. Ya marcó la salida, o el día está completo: nada',
  [tipos({ ahora: '20:07', fecha: MIE, registro: turno({ salida: '17:02' }) }), tipos({ ahora: '20:07', fecha: MIE, registro: turno({ estado: 'completado' }) })], [[], []]);
caso('16. Sin registro hoy: nada', tipos({ ahora: '17:37', fecha: MIE, registro: null }), []);
caso('17. Turno de tarde que termina a las 9:30 p. m.: aviso a las 9:25 y ninguno de olvido a las 5:30 ni 7:30',
  ['17:30', '19:30', '21:25'].map(ahora => tipos({ ahora, fecha: MIE, registro: turno({ obra: 'NOCHE', entrada: '13:00', almuerzo_omitido: true }) })), [[], [], ['salida0']]);
const msg = recordatoriosPendientes({ ahora: '17:30', enviados: ['salida0'], fecha: MIE, registro: conAlmuerzo, catalogos, festivos, nombre: 'WILLINTONG LERMA VALLECILLA' })[0];
const previo = recordatoriosPendientes({ ahora: '16:55', fecha: MIE, registro: conAlmuerzo, catalogos, festivos, nombre: 'WILLINTONG LERMA VALLECILLA' })[0];
caso('18. Los mensajes saludan por el primer nombre y dicen la hora de salida, o la obra y la hora de entrada',
  [previo.titulo, previo.cuerpo.startsWith('Tu salida es a las 17:00.'), msg.titulo, msg.cuerpo.startsWith('Tu turno en BODEGA sigue abierto desde las 07:28.')],
  ['En 5 minutos es tu salida, Willintong', true, '¿Ya saliste, Willintong?', true]);
caso('19. Si GitHub corre la tarea tarde (11:09 p. m. o 2:25 a. m.), no se manda nada; de 10:00 a 21:30 sí',
  ['09:59', '10:00', '20:07', '21:30', '23:09', '02:25'].map(dentroDelHorarioDeEnvio), [false, true, true, true, false, false]);

console.log(`\n${total - fallas} / ${total} casos correctos`);
process.exit(fallas ? 1 : 0);
