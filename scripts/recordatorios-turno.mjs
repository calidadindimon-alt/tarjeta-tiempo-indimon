// Recordatorios al celular (notificaciones push) para quien olvida marcar el almuerzo o la salida.
//
// Corre sola cada 30 minutos (ver .github/workflows/recordatorios.yml). Revisa a los colaboradores que
// aceptaron los recordatorios en la app (colección push_tokens), mira su registro de HOY y les manda por
// Firebase Cloud Messaging lo que les toque según scripts/recordatorios-logica.mjs. Cada recordatorio se
// manda una sola vez por día (se anota en push_tokens/{cedula}.enviados).
//
// Uso:
//   node scripts/recordatorios-turno.mjs               → manda los recordatorios que toquen ahora
//   node scripts/recordatorios-turno.mjs --simular     → solo muestra qué mandaría, sin mandar ni guardar
//   node scripts/recordatorios-turno.mjs --probar 123  → manda una notificación de prueba a la cédula 123
//
// Requiere el secreto FIREBASE_SERVICE_ACCOUNT_JSON (el mismo del backup semanal).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { recordatoriosPendientes } from './recordatorios-logica.mjs';

const URL_APP = 'https://calidadindimon-alt.github.io/tarjeta-tiempo-indimon/';
const args = process.argv.slice(2);
const SIMULAR = args.includes('--simular');
const PROBAR = args.includes('--probar') ? args[args.indexOf('--probar') + 1] : null;

function ahoraBogota() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = (t) => partes.find((p) => p.type === t).value;
  return { fecha: `${v('year')}-${v('month')}-${v('day')}`, hora: `${v('hour') === '24' ? '00' : v('hour')}:${v('minute')}` };
}

// Los festivos nacionales se leen de index.html (FESTIVOS_COLOMBIA), para no mantener dos listas.
function festivosDeLaApp() {
  const fuente = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const inicio = fuente.indexOf('const FESTIVOS_COLOMBIA = [');
  const bloque = fuente.slice(inicio, fuente.indexOf('];', inicio));
  return new Set(bloque.match(/\d{4}-\d{2}-\d{2}/g) || []);
}

const ERRORES_TOKEN_MUERTO = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

async function enviar(messaging, ref, tokens, { titulo, cuerpo, tag }) {
  const resp = await messaging.sendEachForMulticast({
    tokens,
    data: { title: titulo, body: cuerpo, url: URL_APP, tag },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
  });
  const muertos = tokens.filter((_, i) => !resp.responses[i].success && ERRORES_TOKEN_MUERTO.includes(resp.responses[i].error?.code));
  if (muertos.length) await ref.update({ tokens: FieldValue.arrayRemove(...muertos) });
  return { ok: resp.successCount, fallos: resp.failureCount, muertos: muertos.length };
}

async function main() {
  const credencial = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!credencial) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT_JSON en el entorno.');
  const app = initializeApp({ credential: cert(JSON.parse(credencial)) });
  const db = getFirestore(app);
  const messaging = getMessaging(app);
  const { fecha, hora } = ahoraBogota();

  if (PROBAR) {
    const ref = db.collection('push_tokens').doc(PROBAR);
    const snap = await ref.get();
    const tokens = (snap.exists && snap.data().tokens) || [];
    if (!tokens.length) { console.log(`La cédula ${PROBAR} no tiene los recordatorios activados.`); return; }
    const r = await enviar(messaging, ref, tokens, { titulo: 'Prueba de recordatorio', cuerpo: 'Si ves esto, los recordatorios de la Tarjeta de Tiempo funcionan en este celular.', tag: 'prueba' });
    console.log(`Prueba a ${PROBAR}: ${r.ok} enviada(s), ${r.fallos} fallida(s), ${r.muertos} celular(es) dado(s) de baja.`);
    return;
  }

  const catalogos = (await db.collection('catalogos').doc('listas').get()).data() || {};
  const festivos = new Set([...festivosDeLaApp(), ...(catalogos.festivos || [])]);
  const suscritos = await db.collection('push_tokens').get();
  console.log(`${fecha} ${hora} (Bogotá) · ${suscritos.size} colaborador(es) con recordatorios activados${SIMULAR ? ' · SIMULACIÓN' : ''}`);

  let enviados = 0;
  for (const s of suscritos.docs) {
    const tokens = s.data().tokens || [];
    if (!tokens.length) continue;
    const [emp, reg] = await Promise.all([
      db.collection('empleados').doc(s.id).get(),
      db.collection('empleados').doc(s.id).collection('registros').doc(fecha).get(),
    ]);
    if (!emp.exists || emp.data().activo === false) continue;
    const yaEnviados = s.data().enviados?.fecha === fecha ? (s.data().enviados.tipos || []) : [];
    const pendientes = recordatoriosPendientes({
      ahora: hora, fecha, registro: reg.exists ? reg.data() : null, catalogos, festivos, enviados: yaEnviados, nombre: emp.data().nombre,
    });
    for (const p of pendientes) {
      console.log(`  → ${emp.data().nombre}: ${p.tipo} · "${p.titulo}"`);
      if (SIMULAR) continue;
      const r = await enviar(messaging, s.ref, tokens, { ...p, tag: `${p.tipo}-${fecha}` });
      console.log(`    ${r.ok} enviada(s), ${r.fallos} fallida(s)${r.muertos ? `, ${r.muertos} celular(es) dado(s) de baja` : ''}`);
      yaEnviados.push(p.tipo);
      await s.ref.update({ enviados: { fecha, tipos: yaEnviados } });
      enviados += r.ok ? 1 : 0;
    }
  }
  console.log(`Listo: ${enviados} recordatorio(s) enviado(s).`);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
