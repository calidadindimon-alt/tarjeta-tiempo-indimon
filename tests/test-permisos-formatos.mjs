// Prueba del Excel de permisos con los formatos oficiales (GH-F-011 diario y GH-F-012 de un día o más) y del
// PDF de la constancia. Usa el código REAL de index.html (extraído textualmente) y las plantillas reales de
// la carpeta formatos/. Necesita las librerías exceljs y jspdf (en GitHub Actions se instalan con
// "npm install --no-save exceljs@4.4.0 jspdf@2.5.2"; en local, lo mismo).
import fs from 'fs';
import zlib from 'zlib';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leerFuente } from './extraer-calculadora.mjs';
import { extraerPermisosFormatos } from './extraer-permisos-formatos.mjs';

const DIR_TESTS = dirname(fileURLToPath(import.meta.url));
const RUTA_INDEX = process.argv[2] || join(DIR_TESTS, '..', 'index.html');
const RUTA_EXTRAIDO = join(DIR_TESTS, '_extraido-permisos.cjs');

fs.writeFileSync(RUTA_EXTRAIDO, extraerPermisosFormatos(leerFuente(RUTA_INDEX)));
const require = createRequire(import.meta.url);
delete require.cache[RUTA_EXTRAIDO];
const api = require('./_extraido-permisos.cjs');
const ExcelJS = require('exceljs');
const { jsPDF: jsPDFReal } = require('jspdf');
// La app comprime el PDF; aquí se desactiva solo para poder buscar los textos dentro del archivo.
class jsPDF extends jsPDFReal { constructor(opciones) { super(Object.assign({}, opciones, { compress: false })); } }

const plantillas = {
  diario: fs.readFileSync(join(DIR_TESTS, '..', 'formatos', 'GH-F-011_PERMISO_DIARIO.xlsx')),
  multi: fs.readFileSync(join(DIR_TESTS, '..', 'formatos', 'GH-F-012_PERMISO_UN_DIA_O_MAS.xlsx')),
};

const results = [];
async function caso(nombre, fn) {
  try {
    await fn();
    results.push({ nombre, ok: true });
    console.log(`✅ PASS — ${nombre}`);
  } catch (e) {
    results.push({ nombre, ok: false, error: e.message });
    console.log(`❌ FAIL — ${nombre}  (${e.message})`);
  }
}
function assertEqual(obtenido, esperado, msg) {
  const a = JSON.stringify(obtenido), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg}: esperado ${b}, obtuvo ${a}`);
}
function assertTrue(cond, msg) { if (!cond) throw new Error(msg); }

// PNG válido de 1 píxel de un color dado (para probar que cada firma se incrusta como una imagen distinta).
function pngDeUnPixel(r, g, b) {
  const crcTabla = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTabla[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const trozo = (tipo, datos) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4); suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const datos = zlib.deflateSync(Buffer.from([0, r, g, b]));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', datos), trozo('IEND', Buffer.alloc(0))]);
  return 'data:image/png;base64,' + png.toString('base64');
}
const PNGS = [pngDeUnPixel(10, 20, 30), pngDeUnPixel(40, 50, 60), pngDeUnPixel(70, 80, 90), pngDeUnPixel(100, 110, 120)];
const textoCelda = (c) => (c && c.value && c.value.richText) ? c.value.richText.map(t => t.text).join('') : String(c.value == null ? '' : c.value);

function firmantes(nombres, todos = true) {
  const roles = ['trabajador', 'jefe', 'supervisor', 'rrhh'];
  const out = {};
  roles.forEach((r, i) => {
    const firmado = todos || i < 2;
    out[r] = { nombre: nombres[i], firma: firmado ? PNGS[i] : null, firmado, firmado_en: firmado ? `2026-10-1${i + 1}T15:${10 + i}:00.000Z` : null };
  });
  return out;
}
const NOMBRES = ['Doris Amanda Cruz Romero', 'Ana Bohorquez', 'Ana Bohorquez', 'Ana Bohorquez'];
const permisos = [
  { id: 'a', trabajador: 'Doris Amanda Cruz Romero', trabajador_cedula: '111', tipo: 'Cita médica (urgencia o especialista)', fecha: '2026-10-16', horas: '2', hora_salida: '14:00', hora_entrada: '16:00', nota: 'Cita de odontología', estado: 'aprobado', creado_en: '2026-10-15T14:00:00.000Z', firmantes: firmantes(NOMBRES) },
  { id: 'b', trabajador: 'Jhon Viasus', trabajador_cedula: '222', tipo: 'Calamidad doméstica', fecha: '2026-10-08', horas: '4', estado: 'aprobado', creado_en: '2026-10-07T14:00:00.000Z', firmantes: firmantes(['Jhon Viasus', 'X', 'Y', 'Z']) },
  { id: 'c', trabajador: 'Luis Garcia', trabajador_cedula: '333', tipo: 'Vacaciones', fecha: '2026-11-03', fecha_fin: '2026-11-14', dias_vacaciones: 10, nota: 'Vacaciones anuales', estado: 'aprobado', creado_en: '2026-10-12T15:10:00.000Z', firmantes: firmantes(['Luis Garcia', 'Jefe', 'Sup', 'RRHH']) },
  { id: 'd', trabajador: 'Pedro Buitrago', trabajador_cedula: '444', tipo: 'Permiso personal (según política interna)', fecha: '2026-10-22', horas: '2', estado: 'pendiente', creado_en: '2026-10-19T14:00:00.000Z', firmantes: firmantes(['Pedro', 'J', 'S', 'R'], false) },
];
const perfiles = new Map([['111', { cargo: 'Asistente administrativo' }], ['333', { cargo: 'Aprendiz SENA' }]]);
const obraPorPermiso = new Map([['a', 'MYKW'], ['b', 'BOGOTA'], ['c', 'MYKW'], ['d', 'MYKW']]);

(async () => {
  await caso('1. Fechas: usa la hora de Bogotá y devuelve dd/mm/aaaa', () => {
    assertEqual(api.fechaDMAPermiso('2026-10-16'), '16/10/2026', 'fecha simple');
    // 03:30 UTC del 16/10 = 22:30 del 15/10 en Bogotá (UTC-5)
    assertEqual(api.fechaDMAPermiso('2026-10-16T03:30:00.000Z'), '15/10/2026', 'ISO con hora, convertido a Bogotá');
    assertEqual(api.partesFechaPermiso('2026-11-03').mes, 'noviembre', 'nombre del mes');
    assertEqual(api.partesFechaPermiso(''), null, 'vacío');
    assertEqual(api.fechaHoraPermiso('2026-10-15T20:31:00.000Z'), '15/10/2026 3:31 p. m.', 'fecha y hora legible, con espacios normales');
  });

  await caso('2. Solo Vacaciones va al formato de "un día o más"; lo demás al diario', () => {
    assertEqual(api.esPermisoVariosDias(permisos[2]), true, 'Vacaciones');
    assertEqual(api.esPermisoVariosDias(permisos[0]), false, 'cita médica');
  });

  await caso('3. Hojas del formato diario: una por mes+obra, partidas de a 11 filas, sin vacaciones', () => {
    const muchos = [];
    for (let i = 0; i < 12; i++) muchos.push({ id: 'm' + i, trabajador: 'Persona ' + String(i).padStart(2, '0'), tipo: 'Permiso personal', fecha: `2026-10-${String(1 + i).padStart(2, '0')}`, horas: '2', estado: 'aprobado' });
    const obras = new Map(muchos.map(p => [p.id, 'mykw']));
    const hojas = api.armarHojasPermisoDiario([...muchos, permisos[2], permisos[1]], new Map([...obras, ['b', 'Bogota']]));
    assertEqual(hojas.map(h => [h.obra, h.pagina, h.paginas, h.permisos.length]), [['BOGOTA', 1, 1, 1], ['MYKW', 1, 2, 11], ['MYKW', 2, 2, 1]], 'hojas por obra y página (vacaciones excluidas, obra en mayúsculas)');
    assertEqual(hojas[1].permisos[0].fecha, '2026-10-01', 'ordenadas por fecha dentro de la hoja');
  });

  await caso('4. Nombres de hoja de Excel: máx. 31 caracteres, sin caracteres prohibidos y sin repetirse', () => {
    const usados = new Set();
    const a = api.nombreHojaUnico('Varios días 03-11 [Luis]: Enrique/Garcia*Hurtado?Largo muy largo', usados);
    const b = api.nombreHojaUnico('Varios días 03-11 [Luis]: Enrique/Garcia*Hurtado?Largo muy largo', usados);
    assertTrue(a.length <= 31 && b.length <= 31, 'longitud');
    assertTrue(!/[\[\]:*?\/\\]/.test(a + b), 'sin caracteres prohibidos');
    assertTrue(a.toLowerCase() !== b.toLowerCase(), 'dos nombres iguales deben diferenciarse');
  });

  await caso('5. Lee el tamaño de una firma PNG sin necesitar <canvas>', () => {
    const cab = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(cab);
    cab.writeUInt32BE(640, 16); cab.writeUInt32BE(210, 20);
    assertEqual(api.dimensionesPngDataUrl('data:image/png;base64,' + cab.toString('base64')), { w: 640, h: 210 }, 'ancho x alto');
    assertEqual(api.dimensionesPngDataUrl('basura'), null, 'dato inválido');
  });

  const libro = await api.generarLibroPermisosExcel(ExcelJS, plantillas, { permisos, perfiles, obraPorPermiso, esVencido: () => false, tituloMes: 'octubre de 2026' });

  await caso('6. El libro trae Resumen + hojas del formato diario por obra + una hoja por vacaciones', () => {
    assertEqual(libro.worksheets.map(w => w.name), ['Resumen', 'Diario 10-2026 BOGOTA', 'Diario 10-2026 MYKW', 'Varios días 03-11 Luis Garcia'], 'hojas');
  });

  await caso('7. Resumen: una fila por permiso (incluye el pendiente) con su estado', () => {
    const ws = libro.getWorksheet('Resumen');
    assertEqual([4, 5, 6, 7].map(r => ws.getCell(r, 1).value), ['Doris Amanda Cruz Romero', 'Jhon Viasus', 'Luis Garcia', 'Pedro Buitrago'], 'trabajadores');
    assertEqual([4, 5, 6, 7].map(r => ws.getCell(r, 11).value), ['Aprobado', 'Aprobado', 'Aprobado', 'Pendiente'], 'estados');
    assertEqual(ws.getCell(4, 3).value, 'Asistente administrativo', 'cargo tomado del perfil');
  });

  await caso('8. Formato diario (GH-F-011): encabezado, fila del permiso y las 4 firmas', () => {
    const ws = libro.getWorksheet('Diario 10-2026 MYKW');
    assertEqual(textoCelda(ws.getCell('A7')), 'OBRA: MYKW', 'obra');
    assertEqual(textoCelda(ws.getCell('D7')), 'MES: OCTUBRE', 'mes');
    assertEqual(textoCelda(ws.getCell('F7')), 'AÑO: 2026', 'año');
    assertEqual(ws.getCell('K1').value, 'Página 1 de 1', 'paginación en la caja del código');
    assertEqual(ws.getCell('K3').value, 'Código: GH-F-011', 'caja de código movida a la última columna');
    assertEqual(ws.getCell('J9').value, 'FIRMA DEL SUPERVISOR', 'columna extra de supervisor');
    assertEqual(ws.getCell('K9').value, 'FIRMA DEL ENCARGADO DE RRHH', 'columna extra de RRHH');
    assertEqual([ws.getCell('A10').value, ws.getCell('B10').value, ws.getCell('C10').value, ws.getCell('E10').value, ws.getCell('F10').value, ws.getCell('G10').value],
      ['16/10/2026', 'DORIS AMANDA CRUZ ROMERO', 'ASISTENTE ADMINISTRATIVO', '14:00', '16:00', 2], 'datos de la fila');
    assertTrue(String(ws.getCell('D10').value).includes('Cita de odontología'), 'motivo incluye la nota');
    assertEqual(ws.getImages().length, 1 + 4, 'logo + 4 firmas');
  });

  await caso('9. Formato de un día o más (GH-F-012): datos, período, estado aprobado y las 4 firmas', () => {
    const ws = libro.getWorksheet('Varios días 03-11 Luis Garcia');
    assertEqual(ws.getCell('C12').value, 'LUIS GARCIA', 'nombre');
    assertEqual(ws.getCell('B14').value, 'APRENDIZ SENA', 'cargo');
    assertEqual(ws.getCell('B16').value, 'MYKW', 'obra');
    assertTrue(textoCelda(ws.getCell('A8')).startsWith('✔ PERMISO APROBADO'), 'sello de aprobado');
    const periodo = textoCelda(ws.getCell('A23')) + ' ' + textoCelda(ws.getCell('A24'));
    ['03', 'noviembre', '2026', '14'].forEach(t => assertTrue(periodo.includes(t), `período incluye "${t}": ${periodo}`));
    assertTrue(textoCelda(ws.getCell('A26')).includes('10'), 'días de ausencia');
    assertTrue(textoCelda(ws.getCell('A18')).includes('Vacaciones anuales'), 'motivo');
    assertEqual(ws.getImages().length, 1 + 4, 'logo + 4 firmas');
    assertTrue(textoCelda(ws.getCell('B31')).includes('(Solicitante)') && textoCelda(ws.getCell('F37')).includes('(Encargado de RRHH)'), 'nombre y fecha bajo cada firma');
  });

  await caso('10. Un permiso pendiente NUNCA se vuelca a los formatos oficiales', () => {
    const nombres = libro.worksheets.map(w => w.name).join('|');
    assertTrue(!nombres.includes('Pedro'), 'no debe haber hoja de Pedro (pendiente)');
    const diario = libro.getWorksheet('Diario 10-2026 MYKW');
    const nombresDiario = [10, 11, 12, 13].map(r => diario.getCell(r, 2).value);
    assertTrue(!nombresDiario.includes('PEDRO BUITRAGO'), 'Pedro no debe estar en el formato diario');
  });

  await caso('11. El libro se puede escribir y volver a abrir (archivo .xlsx válido)', async () => {
    const buffer = await libro.xlsx.writeBuffer();
    const otro = new ExcelJS.Workbook();
    await otro.xlsx.load(buffer);
    assertEqual(otro.worksheets.length, 4, 'hojas tras releer');
  });

  await caso('12. PDF de la constancia: 1 página, con datos y firmas; no falla si faltan datos', () => {
    const pdf = api.construirPdfPermiso(jsPDF, permisos[0], { cargo: 'Asistente administrativo' }, null);
    const bytes = Buffer.from(pdf.output('arraybuffer'));
    assertEqual(bytes.slice(0, 5).toString(), '%PDF-', 'cabecera PDF');
    assertEqual(pdf.getNumberOfPages(), 1, 'páginas');
    const texto = bytes.toString('latin1');
    ['CONSTANCIA DE PERMISO', 'APROBADO', 'DORIS AMANDA CRUZ ROMERO', 'ASISTENTE ADMINISTRATIVO', 'ID de la solicitud: a'].forEach(t => assertTrue(texto.includes(t), `el PDF debe incluir "${t}"`));
    assertEqual((texto.match(/\/Subtype\s*\/Image/g) || []).length, 4, 'las 4 firmas como imagen');
    assertTrue(texto.includes('obligatorio por ley entregar a RRHH el soporte'), 'el PDF recuerda entregar el soporte (2 a 5 dias)');
    // Pendiente, sin cargo y sin ninguna firma: debe generarse igual
    const vacio = api.construirPdfPermiso(jsPDF, { id: 'z', trabajador: 'X', tipo: 'Vacaciones', fecha: '2026-11-03', dias_vacaciones: 3, estado: 'pendiente', firmantes: {} }, {}, null);
    assertEqual(Buffer.from(vacio.output('arraybuffer')).toString('latin1').includes('PENDIENTE'), true, 'estado pendiente');
    assertEqual(Buffer.from(vacio.output('arraybuffer')).toString('latin1').includes('soporte del permiso'), false, 'vacaciones no llevan recordatorio de soporte');
  });

  await caso('13. Nombre del archivo PDF sin tildes ni caracteres raros', () => {
    assertEqual(api.nombreArchivoPdfPermiso(permisos[0]), 'Permiso_Doris_Amanda_Cruz_Romero_2026-10-16.pdf', 'nombre');
    assertEqual(api.nombreArchivoPdfPermiso({ trabajador: 'Ñandú Pérez / Gómez', fecha: '2026-01-02' }), 'Permiso_Nandu_Perez_Gomez_2026-01-02.pdf', 'sin tildes ni barras');
  });

  const fallidos = results.filter(r => !r.ok);
  console.log('');
  console.log(`${results.length - fallidos.length} / ${results.length} casos correctos`);
  if (fallidos.length) process.exit(1);
  console.log('');
  console.log('El Excel de permisos con los formatos oficiales y el PDF de la constancia calculan exactamente lo esperado en los casos probados.');
})().catch(e => { console.error(e); process.exit(1); });
