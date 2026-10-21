// Decide qué recordatorios le tocan a un colaborador en este momento. Función pura (sin Firestore ni red),
// para poder probarla con tests/test-recordatorios.mjs. La usa scripts/recordatorios-turno.mjs.
//
// Recordatorios (cada uno se manda una sola vez por día):
//   almuerzo        → lleva AVISO_ALMUERZO_TRAS_HORAS en turno y no ha marcado el almuerzo (ni "no tomo almuerzo").
//                     Mismo umbral que el aviso amarillo de la app (AVISO_ALMUERZO_TRAS_HORAS en index.html).
//   regreso         → marcó el inicio del almuerzo y pasaron MIN_REGRESO_ALMUERZO sin marcar el regreso.
//   salida1         → 30 min después de la salida pactada de su obra, sigue con el turno abierto.
//   salida2         → a las 20:00, si sigue abierto (solo si para entonces ya pasó la salida pactada + 30 min).
// Domingos, festivos y sábados sin jornada no tienen salida pactada: ahí solo aplica el aviso de las 20:00.

export const AVISO_ALMUERZO_TRAS_HORAS = 5;
export const MIN_REGRESO_ALMUERZO = 75;
export const MIN_DESPUES_DE_SALIDA = 30;
export const HORA_SEGUNDO_AVISO = '20:00';
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

function obraTieneAlmuerzo(catalogos, obra, fecha) {
  const j = buscar(catalogos.jornadas_obra, obra);
  if (!j) return true;
  const [y, m, d] = fecha.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (dow === 6 && j.sabado) return j.sabado.almuerzo !== false;
  return j.almuerzo !== false;
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
  } else if (!r.almuerzo_inicio && !r.almuerzo_omitido && obraTieneAlmuerzo(catalogos, r.obra, fecha)
    && t - entrada >= AVISO_ALMUERZO_TRAS_HORAS * 60) {
    agregar('almuerzo', `¿Ya almorzaste${saludo}?`, `No has marcado tu almuerzo. Si ya saliste a almorzar, toca aquí y márcalo (aunque sea tarde). Si hoy no tomas almuerzo, usa "Hoy no tomo almuerzo".`);
  }

  const pactada = salidaPactada(catalogos, r.obra, fecha, festivos);
  const primerAviso = pactada ? aMin(pactada) + MIN_DESPUES_DE_SALIDA : null;
  const cuerpoSalida = `Tu turno${obra} sigue abierto desde las ${r.entrada}. Si ya terminaste, toca aquí y marca tu salida. Si sigues trabajando, ignora este aviso.`;
  if (primerAviso !== null && primerAviso > entrada && t >= primerAviso && (t < aMin(HORA_SEGUNDO_AVISO) || primerAviso > aMin(HORA_SEGUNDO_AVISO))) {
    agregar('salida1', `¿Ya saliste${saludo}?`, cuerpoSalida);
  }
  if (t >= aMin(HORA_SEGUNDO_AVISO) && (primerAviso === null || primerAviso <= aMin(HORA_SEGUNDO_AVISO))) {
    agregar('salida2', `Tu turno sigue abierto${saludo}`, cuerpoSalida);
  }
  return out;
}
