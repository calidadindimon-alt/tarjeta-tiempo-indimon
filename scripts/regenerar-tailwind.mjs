// Regenera el CSS de Tailwind que va EMBEBIDO dentro de index.html (<style id="tailwind-compiled">).
//
// Por qué existe: la app dejó de cargar Tailwind desde cdn.tailwindcss.com en cada visita (con señal débil
// fallaba y la página se veía "en crudo"). Ahora el CSS compilado viaja dentro del propio index.html. Eso
// significa que cada vez que se escribe una clase NUEVA de Tailwind en el HTML o en el JS (por ejemplo
// "bg-teal-50"), el bloque embebido tiene que regenerarse o esa clase simplemente no tendrá estilo.
//
// Uso:
//   node scripts/regenerar-tailwind.mjs          reescribe el bloque embebido en index.html
//   node scripts/regenerar-tailwind.mjs --check  no escribe nada; sale con error si le falta alguna clase al bloque
//                                                (es lo que corre GitHub Actions para no olvidarlo)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const VERSION_TAILWIND = '3.4.19';
const RUTA_INDEX = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
const SOLO_VERIFICAR = process.argv.includes('--check');
const BLOQUE = /(<style id="tailwind-compiled">)([\s\S]*?)(<\/style>)/;

const html = readFileSync(RUTA_INDEX, 'utf8');
const coincidencia = html.match(BLOQUE);
if (!coincidencia) {
  console.error('No se encontró <style id="tailwind-compiled"> en index.html.');
  process.exit(1);
}

const temporal = mkdtempSync(join(tmpdir(), 'tailwind-'));
try {
  // Se escanea el HTML SIN el CSS embebido, para que el CSS viejo no cuente como "clases usadas".
  writeFileSync(join(temporal, 'contenido.html'), html.replace(BLOQUE, '$1$3'));
  writeFileSync(join(temporal, 'entrada.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  execFileSync('npx', ['--yes', `tailwindcss@${VERSION_TAILWIND}`, '-i', join(temporal, 'entrada.css'), '-o', join(temporal, 'salida.css'),
    '--content', join(temporal, 'contenido.html'), '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const nuevo = readFileSync(join(temporal, 'salida.css'), 'utf8').trim();
  const actual = coincidencia[2].trim();

  // Clases CSS que define cada versión. Se comparan CLASES y no el texto completo: versiones distintas de la
  // base de navegadores de Tailwind pueden cambiar prefijos (-webkit-...) sin que cambie nada visible.
  const clasesDe = (css) => new Set([...css.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)].map(m => m[1]));
  const clasesActual = clasesDe(actual);
  const faltantes = [...clasesDe(nuevo)].filter(c => !clasesActual.has(c));

  if (SOLO_VERIFICAR) {
    if (faltantes.length === 0) {
      console.log('El CSS de Tailwind embebido en index.html está al día (no falta ninguna clase).');
    } else {
      console.error(`Al CSS de Tailwind embebido en index.html le FALTAN ${faltantes.length} clase(s) que el HTML/JS ya usa, así que no tendrán estilo:`);
      console.error('  ' + faltantes.slice(0, 25).join('\n  ') + (faltantes.length > 25 ? '\n  ...' : ''));
      console.error('Corre:  node scripts/regenerar-tailwind.mjs   y vuelve a subir index.html.');
      process.exit(1);
    }
  } else if (nuevo === actual) {
    console.log('El CSS de Tailwind embebido en index.html ya estaba al día.');
  } else {
    writeFileSync(RUTA_INDEX, html.replace(BLOQUE, (_, abre, __, cierra) => `${abre}${nuevo}${cierra}`));
    console.log('CSS de Tailwind regenerado dentro de index.html.');
  }
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
