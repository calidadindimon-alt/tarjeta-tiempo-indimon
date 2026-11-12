// AUDITORÍA DE NÓMINA (nov-2026) — demuestra con números los hallazgos de docs/auditoria-nomina/INFORME.md.
//
// NO ES UNA PRUEBA DEL CI: no está en .github/workflows/test-jornada.yml y SIEMPRE termina sin error, para no romper
// nada. Saca las funciones reales de index.html (no copias) y, por cada hallazgo, muestra lo que la app da hoy frente
// a lo que debería dar. Cada caso dice "DEMUESTRA EL HALLAZGO N" mientras el problema exista y "YA CORREGIDO" cuando
// el resultado cambie al esperado: así sirve para confirmar cada corrección, una por una.
//
// Uso: node tests/auditoria-nomina-hallazgos.mjs
// (Los hallazgos 3 y 4, de reglas de Firestore, están en tests/auditoria-nomina-reglas.mjs y necesitan el emulador.)
import path from 'path';
import { fileURLToPath } from 'url';
import { leerFuente, hastaPuntoYComa, bloqueBalanceado, extraerCalculadora } from './extraer-calculadora.mjs';

const fuente = leerFuente(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'));
const piezas = [
  extraerCalculadora(fuente).replace(/module\.exports[^\n]*/, ''),
  bloqueBalanceado(fuente, 'function recargoDominicalFestivoPorFecha('),
  bloqueBalanceado(fuente, 'function getRangoSemana('),
  bloqueBalanceado(fuente, 'function horasTrabajadasRegistro('),
  bloqueBalanceado(fuente, 'function horasParaMetaSemana('),
  hastaPuntoYComa(fuente, 'const FECHA_INICIO_APROBACION_EXTRAS'),
  bloqueBalanceado(fuente, 'function estadoExtras('),
  bloqueBalanceado(fuente, 'const ESTADO_EXTRAS_LEGIBLE = {') + ';',
  bloqueBalanceado(fuente, 'function extrasPagables('),
  bloqueBalanceado(fuente, 'function horasOrdinariasEnDescanso('),
  bloqueBalanceado(fuente, 'function calcularPagoExtras('),
  bloqueBalanceado(fuente, 'function esAusenciaInjustificada('),
  bloqueBalanceado(fuente, 'function diasADescontarPorSemana('),
  bloqueBalanceado(fuente, 'function calcularDiasDescontadosPorAusenciasMes('),
  bloqueBalanceado(fuente, 'function duracionHorasEntre('),
  bloqueBalanceado(fuente, 'function horasDeSalidaPermiso('),
  bloqueBalanceado(fuente, 'function horasPermisoDescontadasMes('),
  bloqueBalanceado(fuente, 'const TIPOS_AUSENCIA = [') + ';',
  bloqueBalanceado(fuente, 'const PERMISOS_CATALOGO = [') + ';',
  bloqueBalanceado(fuente, 'function infoTipoPermiso('),
  bloqueBalanceado(fuente, 'function esTipoVariosDias('),
  bloqueBalanceado(fuente, 'const ESTADO_LEGIBLE_EXCEL = {') + ';',
  bloqueBalanceado(fuente, 'function construirFilasDetalleHoras('),
  'return { LEY, calcularJornadaDiaria, esDiaFestivo, recargoDominicalFestivoPorFecha, horasParaMetaSemana, estadoExtras, extrasPagables, horasOrdinariasEnDescanso, calcularPagoExtras, calcularDiasDescontadosPorAusenciasMes, horasDeSalidaPermiso, horasPermisoDescontadasMes, construirFilasDetalleHoras, setCat: (c) => { catalogosCache = c; } };',
];
const A = new Function(piezas.join('\n\n'))();

const SUELDO = 1750905;
const VH = SUELDO / A.LEY.FACTOR_MENSUAL; // valor de la hora = sueldo ÷ 210 = $8.337,64
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const BOGOTA = { horarios_obra: { BOGOTA: '07:30' } };

// Liquida un día con la función real y devuelve el registro como lo guarda la app.
function dia(reg, tope = 8, catalogos = BOGOTA) {
  A.setCat({ horarios_obra: {}, jornadas_obra: {}, festivos: [], ...catalogos });
  const c = A.calcularJornadaDiaria(reg, tope);
  return { ...reg, horas_ordinarias: c.ord, horas_extras_diurnas: c.extD, horas_extras_nocturnas: c.extN, horas_recargo_nocturno: c.recNoct,
    es_dominical_festivo: c.dominical, horas_dominicales: c.horas_dominicales, horas_permiso_turno: c.horasPermiso, minutos_tarde: c.minutosTarde };
}
// Pago adicional al sueldo por un día (extras y recargos), igual que Mi Tarjeta y el costo de mano de obra.
function pagoDia(r, sueldo = SUELDO) {
  const p = A.extrasPagables(r);
  return A.calcularPagoExtras(sueldo, p.extD, p.extN, r.horas_recargo_nocturno || 0, p.horasDom * A.recargoDominicalFestivoPorFecha(r.fecha))
    + A.horasOrdinariasEnDescanso(r) * (sueldo / A.LEY.FACTOR_MENSUAL);
}
const extras = (r) => (r.horas_extras_diurnas || 0) + (r.horas_extras_nocturnas || 0);

let demostrados = 0, corregidos = 0;
function hallazgo(n, titulo, sigueIgual, laAppDa, deberiaDar) {
  if (sigueIgual) demostrados++; else corregidos++;
  console.log(`\n${sigueIgual ? `⚠️  DEMUESTRA EL HALLAZGO ${n}` : `✅ YA CORREGIDO (hallazgo ${n})`} — ${titulo}`);
  console.log(`      La app da:    ${laAppDa}`);
  console.log(`      Debería dar:  ${deberiaDar}`);
}

// ------------------------------------------------------------------------------------------------------------------
// 1. El Excel para nómina deja por fuera las horas de un día que además tiene un permiso
// ------------------------------------------------------------------------------------------------------------------
{
  // Martes 10-nov-2026: cita médica aprobada de 2,5 h en la mañana; trabajó 10:00–19:00 (2 h extra que RRHH aprobó).
  const conCita = dia({ cedula: '1', empleado_nombre: 'ANA', fecha: '2026-11-10', obra: 'BOGOTA', entrada: '10:00', salida: '19:00',
    tipo_permiso: 'Cita médica (urgencia o especialista)', horas_permiso: 2.5, estado: 'completado', extras_estado: 'aprobada' });
  // Miércoles 11-nov: se devolvió a las 11:00 (trabajó 3,5 h). Jueves 12-nov: día normal.
  const seDevolvio = dia({ cedula: '1', empleado_nombre: 'ANA', fecha: '2026-11-11', obra: 'BOGOTA', entrada: '07:30', salida: '11:00', tipo_permiso: 'Se devolvió', horas_permiso: 5, estado: 'completado' });
  const normal = dia({ cedula: '1', empleado_nombre: 'ANA', fecha: '2026-11-12', obra: 'BOGOTA', entrada: '07:30', salida: '17:00', estado: 'completado' });
  const fechasEnDetalle = A.construirFilasDetalleHoras([conCita, seDevolvio, normal]).map(f => f[2]);
  hallazgo(1, 'Excel: el día con permiso + trabajo no sale en "Detalle de horas y extras"',
    !fechasEnDetalle.includes('2026-11-10') || !fechasEnDetalle.includes('2026-11-11'),
    `la tabla de horas solo trae ${JSON.stringify(fechasEnDetalle)}; faltan el 10-nov (${conCita.horas_ordinarias} h ord + ${extras(conCita)} h extra APROBADAS = ${pesos(pagoDia(conCita))}) y el 11-nov (${seDevolvio.horas_ordinarias} h trabajadas)`,
    'los 3 días en la tabla de horas, con sus horas y extras');
}

// ------------------------------------------------------------------------------------------------------------------
// 2. El Consolidado de Admin, el costo y "Extras por aprobar" solo ven los 500 registros más recientes
// ------------------------------------------------------------------------------------------------------------------
{
  const oyente = bloqueBalanceado(fuente, 'function startAdminTableListener() {');
  const exportar = fuente.slice(fuente.indexOf("document.getElementById('btn-export-excel').addEventListener"), fuente.indexOf('let nombreArchivo = "Tiempos_INDIMON"'));
  // La tabla sin filtros puede seguir mostrando los 500 más recientes; lo que no puede pasar es que el mes filtrado, el
  // Excel del mes o las listas de pendientes dependan de ese tope.
  const filtros = bloqueBalanceado(fuente, 'async function aplicarFiltrosYRenderizar() {');
  const mesCompleto = /asegurarFuenteConsolidado\(cedulaFiltro, mesFiltro\)/.test(filtros) &&
    /function asegurarFuenteConsolidado[\s\S]*?where\('fecha', '>=', `\$\{mes\}-01`\)/.test(fuente);
  const excelMesCompleto = /else if \(mesFiltro\) \{[\s\S]*?where\('fecha', '>=', `\$\{mesFiltro\}-01`\)/.test(exportar);
  const pendientesSinTope = /function startPendientesAdmin\(\)[\s\S]*?escuchar\('estado', 'requiere_revision_admin'[\s\S]*?escuchar\('extras_estado', 'por_aprobar'/.test(fuente) &&
    /startPendientesAdmin\(\)/.test(oyente);
  hallazgo(2, 'Admin: el costo del mes y las listas "por aprobar / por revisar" se arman con un tope de registros',
    !(mesCompleto && excelMesCompleto && pendientesSinTope),
    'la tabla de Admin lee los 500 registros más recientes de TODA la empresa y de ahí filtra el mes; el Excel sin colaborador lee los 2000 más recientes y DESPUÉS filtra el mes. Con 30 personas × 22 días = 660 registros al mes, 160 días quedan por fuera del costo sin ningún aviso',
    'consultar el mes pedido completo (por rango de fechas), como ya hace el "Resumen de nómina" por correo');
}

// ------------------------------------------------------------------------------------------------------------------
// 5. Festivo entre semana: se descuenta 1 h de almuerzo que nadie marcó (la regla dice que no se asume)
// ------------------------------------------------------------------------------------------------------------------
{
  const festivo = dia({ fecha: '2026-11-16', obra: 'BOGOTA', entrada: '07:30', salida: '16:30' }, 42); // lunes festivo
  const domingo = dia({ fecha: '2026-11-15', obra: 'BOGOTA', entrada: '07:30', salida: '16:30' }, 42); // mismo turno en domingo
  hallazgo(5, 'Festivo lunes 16-nov-2026, 7:30–16:30 sin marcar almuerzo',
    festivo.horas_ordinarias < domingo.horas_ordinarias,
    `${festivo.horas_ordinarias} h (${pesos(pagoDia(festivo))}); el mismo turno en domingo da ${domingo.horas_ordinarias} h (${pesos(pagoDia(domingo))})`,
    `9 h (${pesos(pagoDia(domingo))}) según la regla "domingo y festivo: no se asume almuerzo" — diferencia ${pesos(pagoDia(domingo) - pagoDia(festivo))} por persona y festivo`);
}

// ------------------------------------------------------------------------------------------------------------------
// 6. Obra sin horario configurado: el horario "se mueve" con la hora de llegada
// ------------------------------------------------------------------------------------------------------------------
{
  const temprano = dia({ fecha: '2026-11-10', obra: 'OBRA NUEVA', entrada: '06:00', salida: '17:00' }, 8, {});
  const tarde = dia({ fecha: '2026-11-10', obra: 'OBRA NUEVA', entrada: '09:00', salida: '18:30' }, 8, {});
  const tempranoOk = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '06:00', salida: '17:00' });
  const tardeOk = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '09:00', salida: '18:30' });
  hallazgo(6, 'Obra sin horario: llega 6:00 y sale 17:00 / llega 9:00 y sale 18:30 (martes)',
    extras(temprano) > 0 && extras(tarde) === 0,
    `6:00–17:00 → ${extras(temprano)} h extra (${pesos(extras(temprano) * VH * 1.25)}) y paga desde las 6:00; 9:00–18:30 → ${extras(tarde)} h extra y ${tarde.minutos_tarde} min de tardanza`,
    `con el horario por defecto 7:30–17:00 (el que la app muestra en pantalla): 6:00–17:00 → ${extras(tempranoOk)} h extra; 9:00–18:30 → ${extras(tardeOk)} h extra y ${tardeOk.minutos_tarde} min de tardanza`);
}

// ------------------------------------------------------------------------------------------------------------------
// 7. Descuento de permiso personal: con dos salidas el mismo día se descuenta de más
// ------------------------------------------------------------------------------------------------------------------
{
  // Sale 9:00–10:00 (permiso personal) y a las 15:00 se va y no vuelve (permiso personal). Estuvo fuera 3 h del horario.
  const r = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '07:30', salida: '15:00', salidas_permiso: [
    { motivo: 'Permiso personal', sale: '09:00', vuelve: '10:00' }, { motivo: 'Permiso personal', sale: '15:00', sin_regreso: true }] });
  r.decisiones_permiso = { 0: { decision: 'descuenta' }, 1: { decision: 'descuenta' } };
  const horas = A.horasPermisoDescontadasMes([r], '2026-11');
  hallazgo(7, 'RRHH marca "se descuenta" en las dos salidas a permiso personal de un mismo día',
    horas > r.horas_permiso_turno + 0.01,
    `${horas} h descontadas = ${pesos(horas * VH)} (la salida "no volvió" cuenta el permiso de TODO el día, incluida la primera)`,
    `${r.horas_permiso_turno} h = ${pesos(r.horas_permiso_turno * VH)} (lo que la propia app calculó como permiso del día)`);
  // Otra forma del mismo problema: con dos salidas, cada una se mide "de reloj" (incluye la hora de almuerzo).
  const r2 = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '07:30', salida: '17:00', salidas_permiso: [
    { motivo: 'Permiso personal', sale: '11:30', vuelve: '14:30' }, { motivo: 'Cita médica', sale: '16:00', vuelve: '16:30' }] });
  const h0 = A.horasDeSalidaPermiso(r2, 0);
  hallazgo(7, 'Permiso personal 11:30–14:30 (cubre la hora de almuerzo) el mismo día de otra salida corta',
    h0 > 2.01,
    `${h0} h a descontar = ${pesos(h0 * VH)} (cuenta la hora de almuerzo como permiso)`,
    `2 h = ${pesos(2 * VH)} (3 h fuera menos 1 h de almuerzo, como cuando es la única salida del día)`);
}

// ------------------------------------------------------------------------------------------------------------------
// 8. Contratista: la ausencia injustificada le resta 16 horas de lo que SÍ trabajó
// ------------------------------------------------------------------------------------------------------------------
{
  const mensual = bloqueBalanceado(fuente, 'async function calculateMonthlyAccumulated() {');
  const restaAlContratista = /valorDia = esContratista \? tarifaHora \* LEY\.JORNADA_ORDINARIA_DIARIA/.test(mensual)
    && /totalBruto = pagoOrdinarias \+ pagoExtras - montoDescuentoAusencias/.test(mensual);
  const tarifa = 10000;
  // Semana 9–15 nov: faltó el miércoles 11 (ausencia injustificada) y trabajó 4 días de 8 h.
  const semana = ['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'].map(f => ({ fecha: f, horas_ordinarias: 8 }))
    .concat([{ fecha: '2026-11-11', tipo_permiso: 'Ausencia injustificada', horas_ordinarias: 0 }]);
  const diasDesc = A.calcularDiasDescontadosPorAusenciasMes(semana, '2026-11');
  const trabajado = 32 * tarifa;
  hallazgo(8, 'Contratista a $10.000/hora que falta un día sin justificar y trabaja 32 h esa semana',
    restaAlContratista && diasDesc === 2,
    `${pesos(trabajado)} − ${diasDesc} días × 8 h × tarifa = ${pesos(trabajado - diasDesc * 8 * tarifa)} (le resta el día que faltó y el domingo, que nunca se le iban a pagar)`,
    `${pesos(trabajado)}: al contratista solo se le pagan las horas trabajadas; el día que faltó ya "se descontó" solo`);
}

// ------------------------------------------------------------------------------------------------------------------
// 9. "Editar registro" (Admin) no vuelve las extras a "por aprobar" ni recalcula la semana; "Guardar registro pasado"
//    reemplaza el día entero (se pierden salidas a permiso y decisiones de RRHH)
// ------------------------------------------------------------------------------------------------------------------
{
  const editar = fuente.slice(fuente.indexOf("document.getElementById('btn-editar-registro-guardar').addEventListener"), fuente.indexOf('function borrarRegistro('));
  const manual = fuente.slice(fuente.indexOf("document.getElementById('btn-save-manual').addEventListener"), fuente.indexOf('async function calcularRecalculoSemana('));
  const recalculo = bloqueBalanceado(fuente, 'async function calcularRecalculoSemana(');
  const antes = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '07:30', salida: '18:00', extras_estado: 'aprobada' });
  const despues = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '07:30', salida: '21:00', extras_estado: 'aprobada' });
  hallazgo(9, 'Admin edita la salida de 18:00 a 21:00 en un día cuyas extras RRHH ya aprobó',
    !editar.includes('extras_estado') && !editar.includes('recalcularSemana(') && recalculo.includes("extras_estado = 'por_aprobar'"),
    `las extras pasan de ${extras(antes)} h (${pesos(pagoDia(antes))}) a ${extras(despues)} h (${pesos(pagoDia(despues))}) y siguen "APROBADAS"; tampoco se recalcula la semana`,
    'igual que "Recalcular semana": si cambian las extras de un día aprobado, vuelven a "por aprobar"');
  hallazgo(9, '"Guardar registro pasado" sobre un día que ya tenía salidas a permiso',
    /await setDoc\(doc\(db, 'empleados', cedula, 'registros', fecha\), data\);/.test(manual) && !manual.includes('salidas_permiso'),
    'el día se reemplaza completo: se pierden salidas_permiso, la decisión de RRHH (decisiones_permiso) y quién autorizó las extras',
    'conservar esos campos (o avisar que se van a borrar)');
}

// ------------------------------------------------------------------------------------------------------------------
// 10. Cambiar el horario de una obra reclasifica los días ya trabajados
// ------------------------------------------------------------------------------------------------------------------
{
  const reg = { fecha: '2026-11-09', obra: 'BOGOTA', entrada: '07:30', salida: '17:00' };
  const conHorarioViejo = dia(reg);
  const conHorarioNuevo = dia(reg, 8, { horarios_obra: { BOGOTA: '07:00' }, jornadas_obra: { BOGOTA: { entrada: '07:00', salida_lj: '16:30', salida_v: '16:00', almuerzo: true, sabado: null } } });
  hallazgo(10, 'Lunes trabajado 7:30–17:00; el miércoles Admin cambia el horario de la obra a 7:00–16:30',
    conHorarioNuevo.minutos_tarde > 0 || extras(conHorarioNuevo) > 0,
    `al recalcular la semana, ese lunes queda con ${conHorarioNuevo.minutos_tarde} min de tardanza, ${conHorarioNuevo.horas_ordinarias} h ord y ${extras(conHorarioNuevo)} h extra por aprobar`,
    `${conHorarioViejo.horas_ordinarias} h ord, sin tardanza ni extras (el horario que regía ese lunes)`);
}

// ------------------------------------------------------------------------------------------------------------------
// 11. No hay control del tope legal de horas extra (2 al día, 12 a la semana)
// ------------------------------------------------------------------------------------------------------------------
{
  const largo = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '07:30', salida: '23:30' });
  const hayControl = /(tope|l[ií]mite|m[aá]ximo)[^\n]{0,60}(2 horas extra|12 horas extra|extras? (diarias|semanales))/i.test(fuente);
  hallazgo(11, 'Martes 7:30–23:30',
    !hayControl && extras(largo) > 2,
    `${extras(largo)} h extra en un día, sin ningún aviso; RRHH las puede aprobar con un clic`,
    'un aviso a RRHH cuando un día pasa de 2 h extra o la semana de 12 h (art. 22 Ley 50 de 1990)');
}

// ------------------------------------------------------------------------------------------------------------------
// 12. El auxilio de transporte no aparece en el neto estimado ni en el costo
// ------------------------------------------------------------------------------------------------------------------
{
  const AUXILIO_2026 = 249095; // confirmar con el decreto vigente
  hallazgo(12, 'Neto estimado de un mes sin novedades con el salario mínimo',
    !/auxilio de transporte/i.test(fuente),
    `${pesos(SUELDO)} − 8 % = ${pesos(SUELDO * 0.92)}`,
    `${pesos(SUELDO * 0.92 + AUXILIO_2026)} (más el auxilio de transporte de ${pesos(AUXILIO_2026)}, que no lleva el 8 %)`);
}

// ------------------------------------------------------------------------------------------------------------------
// 14. Un permiso de día completo no cuenta para las 42 h: la semana sale "incompleta"
// ------------------------------------------------------------------------------------------------------------------
{
  const luto = { fecha: '2026-11-09', estado: 'completado', tipo_permiso: 'Licencia por luto (familiar cercano)', horas_permiso: 8.5, horas_ordinarias: 0 };
  hallazgo(14, 'Lunes con licencia por luto (día completo, remunerada) y martes a viernes trabajados',
    A.horasParaMetaSemana(luto) === 0,
    `la semana suma ${33.5 + A.horasParaMetaSemana(luto)} de 42 h → "semana incompleta"`,
    '42 de 42 h (el permiso remunerado de día completo cuenta, igual que la salida a cita dentro del turno)');
}

// ------------------------------------------------------------------------------------------------------------------
// 16. Días anteriores al 15-jul-2026 se liquidan con las reglas de hoy (÷210 y nocturno desde las 19:00)
// ------------------------------------------------------------------------------------------------------------------
{
  const junio = dia({ fecha: '2026-06-02', obra: 'BOGOTA', entrada: '07:30', salida: '19:00' }); // martes, 2 h extra diurnas
  hallazgo(16, '2 h extra diurnas del 2-jun-2026 (antes de bajar a 42 h semanales)',
    Math.abs(pagoDia(junio) - extras(junio) * 1.25 * SUELDO / 210) < 1,
    `${pesos(pagoDia(junio))} (hora = sueldo ÷ 210)`,
    `${pesos(extras(junio) * 1.25 * SUELDO / 220)} (hasta el 14-jul-2026 la jornada era de 44 h: hora = sueldo ÷ 220)`);
  const viejo = dia({ fecha: '2025-12-02', obra: 'BOGOTA', entrada: '12:31', salida: '21:30' });
  hallazgo(16, 'Turno 12:31–21:30 del 2-dic-2025 (antes del 25-dic-2025 la noche empezaba a las 21:00)',
    viejo.horas_recargo_nocturno > 0.6,
    `${viejo.horas_recargo_nocturno} h de recargo nocturno (cuenta desde las 19:00)`,
    '0,5 h (de 21:00 a 21:30)');
}

// ------------------------------------------------------------------------------------------------------------------
// 17. El calendario de festivos se acaba y nadie avisa
// ------------------------------------------------------------------------------------------------------------------
{
  A.setCat({ festivos: [] });
  hallazgo(17, '1 de enero de 2029 (Año Nuevo)',
    A.esDiaFestivo('2028-12-25') && !A.esDiaFestivo('2029-01-01'),
    'no es festivo: trabajar ese día se pagaría como un lunes normal, sin recargo',
    'festivo (la lista del código llega hasta el 25-dic-2028 y la app no avisa cuando se acerca el final)');
}

// ------------------------------------------------------------------------------------------------------------------
// 18. Un almuerzo de exactamente 20 minutos a veces se toma como "no marcado"
// ------------------------------------------------------------------------------------------------------------------
{
  const a = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '07:30', salida: '17:00', almuerzo_inicio: '12:00', almuerzo_fin: '12:20' });
  const b = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '07:30', salida: '17:00', almuerzo_inicio: '11:50', almuerzo_fin: '12:10' });
  hallazgo(18, 'Mismo día, mismo almuerzo de 20 minutos, marcado a horas distintas',
    Math.abs(extras(a) - extras(b)) > 0.01,
    `almuerzo 12:00–12:20 → ${extras(a)} h extra; almuerzo 11:50–12:10 → ${extras(b)} h extra (lo trata como si no hubiera marcado y descuenta 1 h)`,
    'el mismo resultado en los dos casos');
}

// ------------------------------------------------------------------------------------------------------------------
// 19. Casos de borde de turnos
// ------------------------------------------------------------------------------------------------------------------
{
  const a = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '12:29', salida: '21:30' });
  const b = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '12:31', salida: '21:30' });
  hallazgo(19, 'Llegar a las 12:29 o a las 12:31 (obra con entrada 7:30), saliendo a las 21:30',
    extras(a) - extras(b) > 3,
    `12:29 → ${a.horas_ordinarias} h ord + ${extras(a)} h extra (${pesos(pagoDia({ ...a, extras_estado: 'aprobada' }))} si RRHH las aprueba); 12:31 → ${b.horas_ordinarias} h ord + ${extras(b)} h extra (${pesos(pagoDia(b))} de recargo nocturno)`,
    'dos minutos de diferencia no deberían cambiar el día de "tardanza con 4 h extra" a "otro turno sin extras"');
  const madrugada = dia({ fecha: '2026-11-10', obra: 'BOGOTA', entrada: '00:30', salida: '08:00' });
  hallazgo(19, 'Llamado de emergencia: entra 00:30 y sale 8:00 en una obra con entrada 7:30',
    madrugada.horas_ordinarias < 1,
    `${madrugada.horas_ordinarias} h pagadas (todo lo anterior a las 7:30 se toma como "llegó temprano")`,
    '6,5 h con recargo nocturno hasta las 6:00 — o al menos un aviso a Admin para que marque "entrada temprana autorizada"');
}

console.log(`\n${demostrados} caso(s) demuestran un hallazgo abierto · ${corregidos} ya corregido(s). Detalle en docs/auditoria-nomina/INFORME.md`);
process.exit(0);
