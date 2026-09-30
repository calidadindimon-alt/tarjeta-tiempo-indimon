// Backup semanal automático de Firestore.
//
// Corre solo, disparado por .github/workflows/backup-semanal.yml (cron), y hace exactamente
// lo mismo que el botón "Descargar copia completa" del panel Admin (ver index.html,
// btn-descargar-backup) — misma estructura de archivo — pero sin que nadie tenga que acordarse
// de darle clic. Guarda el resultado en dos lugares independientes (backups/ en este repo, y
// una carpeta de OneDrive) para que si uno falla, el otro sigue sirviendo.
//
// Requiere el secreto de GitHub FIREBASE_SERVICE_ACCOUNT_JSON (el JSON completo de una cuenta
// de servicio de Firebase, con permiso de solo lectura sobre Firestore). Nunca se imprime ni se
// guarda en el repo — solo vive como secreto encriptado en GitHub Actions.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const CARPETA_BACKUPS = 'backups';
const MAX_BACKUPS_EN_REPO = 12; // ~3 meses de historial semanal, para no inflar el repo sin control

function hoyBogota() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const val = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${val('year')}-${val('month')}-${val('day')}`;
}

async function main() {
  const credencialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!credencialJson) {
    throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT_JSON en el entorno.');
  }

  const app = initializeApp({ credential: cert(JSON.parse(credencialJson)) });
  const db = getFirestore(app);

  const backup = {
    generado_en: new Date().toISOString(),
    empleados: [],
    permisos: [],
    desprendibles: [],
    incapacidades: [],
    catalogos: null,
    auditoria: [],
  };

  const empleadosSnap = await db.collection('empleados').get();
  for (const empDoc of empleadosSnap.docs) {
    const registrosSnap = await db.collection('empleados').doc(empDoc.id).collection('registros').get();
    backup.empleados.push({
      cedula: empDoc.id,
      datos: empDoc.data(),
      registros: registrosSnap.docs.map((r) => ({ fecha: r.id, ...r.data() })),
    });
  }

  const permisosSnap = await db.collection('permisos').get();
  backup.permisos = permisosSnap.docs.map((p) => ({ id: p.id, ...p.data() }));

  const desprendiblesSnap = await db.collection('desprendibles').get();
  backup.desprendibles = desprendiblesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const incapacidadesSnap = await db.collection('incapacidades').get();
  backup.incapacidades = incapacidadesSnap.docs.map((i) => ({ id: i.id, ...i.data() }));

  const catalogosSnap = await db.collection('catalogos').doc('listas').get();
  backup.catalogos = catalogosSnap.exists ? catalogosSnap.data() : null;

  const auditoriaSnap = await db.collection('auditoria').get();
  backup.auditoria = auditoriaSnap.docs.map((a) => a.data());

  mkdirSync(CARPETA_BACKUPS, { recursive: true });
  const nombreArchivo = `Backup_INDIMON_${hoyBogota()}.json`;
  const rutaArchivo = join(CARPETA_BACKUPS, nombreArchivo);
  writeFileSync(rutaArchivo, JSON.stringify(backup, null, 2));

  // Poda backups viejos en el repo para no crecer sin límite (OneDrive se poda aparte, en el workflow)
  const archivos = readdirSync(CARPETA_BACKUPS)
    .filter((f) => f.startsWith('Backup_INDIMON_') && f.endsWith('.json'))
    .sort();
  const sobrantes = archivos.length - MAX_BACKUPS_EN_REPO;
  if (sobrantes > 0) {
    for (const viejo of archivos.slice(0, sobrantes)) {
      unlinkSync(join(CARPETA_BACKUPS, viejo));
    }
  }

  console.log(`Backup generado: ${rutaArchivo}`);
  console.log(`${backup.empleados.length} colaboradores, ${backup.permisos.length} permisos, ${backup.desprendibles.length} desprendibles, ${backup.incapacidades.length} incapacidades.`);

  // Para que el workflow sepa el nombre del archivo sin tener que adivinarlo
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `archivo=${rutaArchivo}\n`, { flag: 'a' });
  }
}

main().catch((e) => {
  console.error('Backup FALLIDO:', e);
  process.exit(1);
});
