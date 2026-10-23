// Decide qué recordatorios le tocan a un colaborador en este momento. Función pura (sin Firestore ni red),
// para poder probarla con tests/test-recordatorios.mjs. La usa scripts/recordatorios-turno.mjs.
//
// Recordatorios (cada uno se manda una sola vez por día). La tarea corre cada 5 minutos (cron-job.org), así que un
// aviso "5 minutos antes" se manda en la corrida que cae dentro de los MIN_ANTES previos a la hora:
//   almuerzo        → 5 min antes de la hora del almuerzo de su obra, para que lo marque al salir. La hora se configura
//                     en Horarios por Obra; si no, HORA_ALMUERZO_POR_DEFECTO.
//   regreso         → marcó el inicio del almuerzo y pasaron MIN_REGRESO_ALMUERZO sin marcar el regreso.
//   salida0         → 5 min antes de la salida pactada de su obra, para que la marque al irse.
//   salida1         → a las 17:30 si olvidó marcar la salida (o 30 min después de la salida, si su obra sale más tarde).
//   salida2         → a las 19:30 si sigue abierto.
// Domingos, festivos y sábados sin jornada no tienen salida pactada: ahí solo aplica el aviso de las 19:30.

export const MIN_ANTES = 5;
// Ventana para el aviso "5 min antes": con corridas cada 5 min siempre cae una, aunque la hora no sea múltiplo de 5.
const VENTANA_ANTES = MIN_ANTES + 1;
export const HORA_ALMUERZO_POR_DEFECTO = '12:00';
export const MIN_REGRESO_ALMUERZO = 75;
export const HORA_PRIMER_OLVIDO = '17:30';
export const MIN_DESPUES_DE_SALIDA = 30;
export const HORA_SEGUNDO_AVISO = '19:30';
// Fuera de este horario no se manda nada, aunque GitHub corra la tarea tarde (a veces la atrasa horas):
// nadie debe recibir un "¿ya saliste?" a las 11 de la noche.
export const HORARIO_ENVIO = { desde: '10:00', hasta: '21:30' };
export function dentroDelHorarioDeEnvio(hora) {
  return aMin(hora) >= aMin(HORARIO_ENVIO.desde) && aMin(hora) <= aMin(HORARIO_ENVIO.hasta);
}
const HORARIO_PACTADO_HORAS = { 1: 8.5, 2: 8.5, 3: 8.5, 4: 8.5, 5: 8.0 };

const aMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const aHHMM = (min) => { const t = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const buscar = (mapa, obra) => {
  const clave = String(obra || '').trim().toUpperCase();
  for (const k in mapa || {}) if (k.trim().toUpperCase() === clave) return mapa[k];
  return null;
};

// Igual que jornadaEfectivaObra() + salidaPactadaDe() de index.html.
export function salidaPactada(catalogos, obra, fecha, festivos) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (dow === 0 || festivos.has(fecha)) return null;
  let j = buscar(catalogos.jornadas_obra, obra);
  if (!j) {
    const e = buscar(catalogos.horarios_obra, obra) || '07:30';
    j = { entrada: e, salida_lj: aHHMM(aMin(e) + (HORARIO_PACTADO_HORAS[1] + 1) * 60), salida_v: aHHMM(aMin(e) + (HORARIO_PACTADO_HORAS[5] + 1) * 60), almuerzo: true, sabado: null };
  }
  if (dow === 6) return j.sabado ? j.sabado.salida : null;
  return dow === 5 ? j.salida_v : j.salida_lj;
}

// Hora del almuerzo de la obra ese día, o null si ese día no hay almuerzo pactado (domingo, festivo, sábado sin
// jornada u obra sin almuerzo).
export function horaAlmuerzo(catalogos, obra, fecha, festivos) {
  const j = buscar(catalogos.jornadas_obra, obra);
  const [y, m, d] = fecha.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (dow === 0 || festivos.has(fecha)) return null;
  if (dow === 6) { if (!j || !j.sabado || !j.sabado.almuerzo) return null; }
  else if (j && j.almuerzo === false) return null;
  return (j && j.hora_almuerzo) || HORA_ALMUERZO_POR_DEFECTO;
}

// registro: el documento de hoy (entrada, almuerzo_inicio, almuerzo_fin, salida, almuerzo_omitido, obra, estado).
// enviados: lista de recordatorios ya mandados hoy. Devuelve [{ tipo, titulo, cuerpo }].
export function recordatoriosPendientes({ ahora, fecha, registro, catalogos, festivos, enviados = [], nombre = '' }) {
  const r = registro;
  if (!r || !r.entrada || r.salida || r.estado === 'completado' || r.estado === 'requiere_revision_admin') return [];
  const t = aMin(ahora);
  const entrada = aMin(r.entrada);
  if (t < entrada) return []; // turno que viene de ayer o reloj raro: no se adivina
  const quien = String(nombre).trim().split(/\s+/)[0];
  const saludo = quien ? `, ${quien.charAt(0).toUpperCase()}${quien.slice(1).toLowerCase()}` : '';
  const obra = r.obra ? ` en ${r.obra}` : '';
  const out = [];
  const agregar = (tipo, titulo, cuerpo) => { if (!enviados.includes(tipo)) out.push({ tipo, titulo, cuerpo }); };

  if (r.almuerzo_inicio && !r.almuerzo_fin) {
    if (t - aMin(r.almuerzo_inicio) >= MIN_REGRESO_ALMUERZO) {
      agregar('regreso', `¿Ya volviste del almuerzo${saludo}?`, `Saliste a almorzar a las ${r.almuerzo_inicio} y no has marcado el regreso. Si ya volviste, toca aquí y márcalo.`);
    }
  } else if (!r.almuerzo_inicio && !r.almuerzo_omitido) {
    const hora = horaAlmuerzo(catalogos, r.obra, fecha, festivos);
    if (hora && aMin(hora) > entrada && t >= aMin(hora) - VENTANA_ANTES && t < aMin(hora)) {
      agregar('almuerzo', `En 5 minutos es tu almuerzo${saludo}`, `Tu almuerzo es a las ${hora}. Cuando salgas a almorzar, abre la app y marca "Iniciar Almuerzo". Si hoy no tomas almuerzo, usa "Hoy no tomo almuerzo".`);
    }
  }

  const pactada = salidaPactada(catalogos, r.obra, fecha, festivos);
  if (pactada && aMin(pactada) > entrada && t >= aMin(pactada) - VENTANA_ANTES && t < aMin(pactada)) {
    agregar('salida0', `En 5 minutos es tu salida${saludo}`, `Tu salida es a las ${pactada}. Antes de irte, abre la app y marca "Fin de Jornada". Si te quedas trabajando, ignora este aviso.`);
  }
  const primerAviso = pactada ? Math.max(aMin(HORA_PRIMER_OLVIDO), aMin(pactada) + MIN_DESPUES_DE_SALIDA) : null;
  const cuerpoSalida = `Tu turno${obra} sigue abierto desde las ${r.entrada}. Si ya terminaste, toca aquí y marca tu salida. Si sigues trabajando, ignora este aviso.`;
  if (primerAviso !== null && primerAviso > entrada && t >= primerAviso && (t < aMin(HORA_SEGUNDO_AVISO) || primerAviso > aMin(HORA_SEGUNDO_AVISO))) {
    agregar('salida1', `¿Ya saliste${saludo}?`, cuerpoSalida);
  }
  if (t >= aMin(HORA_SEGUNDO_AVISO) && (primerAviso === null || primerAviso <= aMin(HORA_SEGUNDO_AVISO))) {
    agregar('salida2', `Tu turno sigue abierto${saludo}`, cuerpoSalida);
  }
  return out;
}
