# Encargo: auditoría completa del cálculo de nómina — Tarjeta de Tiempo INDIMON

## Para qué

La app calcula las horas y el pago estimado de los colaboradores de INDIMON S.A.S. (Colombia). Un error en ese cálculo
le cuesta dinero a la empresa o al colaborador, y puede terminar en un reclamo laboral. Queremos una revisión profunda,
de punta a punta, que encuentre errores escondidos, sobre todo donde dos reglas se cruzan (por ejemplo: festivo + permiso
dentro del turno + almuerzo + turno que pasa la medianoche).

La revisión es **de solo lectura**: no cambies `index.html`, `firestore.rules` ni nada de producción. Entrega un informe y,
si sirve para demostrar un hallazgo, pruebas nuevas en `tests/`. Las correcciones se deciden después, una por una, con la
persona responsable (quien lee el informe no es programadora: explícale en español simple).

## La app en una página

- PWA de un solo archivo: `index.html` (≈13.000 líneas, JavaScript dentro de `<script type="module">`), Firebase 10.13
  (Firestore + Auth), publicada en GitHub Pages. Cada día de cada colaborador es un documento
  `empleados/{cedula}/registros/{AAAA-MM-DD}`.
- El colaborador marca entrada, almuerzo, salidas a cita o permiso dentro del turno, y salida. Al cerrar el día se
  calculan y guardan las horas; Admin puede corregir días y RRHH aprueba horas extra y decide permisos.
- No hay servidor propio: todo el cálculo corre en el navegador. `scripts/` tiene tareas programadas (recordatorios,
  respaldo) que no calculan nómina.

## Dónde está el cálculo (búscalo por nombre; los números de línea cambian)

| Tema | Funciones y constantes en `index.html` |
|---|---|
| Constantes legales | `const LEY = {`, `recargoDominicalFestivoPorFecha`, `FESTIVOS_COLOMBIA`, `HORARIO_PACTADO_HORAS`, `LIMITE_HORAS_TURNO_REVISION`, tolerancias (`TOLERANCIA_TARDANZA_MIN`, `TOLERANCIA_SALIDA_MIN`, `MIN_ALMUERZO_VALIDO_MIN`, `JORNADA_MIN_PARA_ALMUERZO_ASUMIDO`, `ALMUERZO_LEGAL_HORAS`) |
| Liquidación de un día | `calcularJornadaDiaria` (el corazón), `getJornadaObra`, `horasPactadasJornadaObra`, `jornadaEfectivaObra`, `calcularMinutosTardanza`, `evaluarTardanza` |
| La semana | `metaSemanalOrdinaria`, `horasParaMetaSemana`, `getResumenSemana`, `getTopeOrdinarioDia`, `calcularRecalculoSemana`, `recalcularSemana`, `verificarCumplimientoSemanal`, `esDiaDescansoInferido` |
| Extras y recargos | `estadoExtras`, `extrasPagables`, `horasOrdinariasEnDescanso`, `calcularPagoExtras` |
| Ausencias y permisos | `esAusenciaSinHoras`, `esAusenciaInjustificada`, `diasADescontarPorSemana`, `calcularDiasDescontadosPorAusenciasMes`, `PERMISOS_CATALOGO`, `infoTipoPermiso`, `esTipoVariosDias`, `sincronizarPermisoConNomina`, `aplicarPermisoAprobado` |
| Salidas a cita o permiso dentro del turno | `salidas_permiso` / `horas_permiso_turno` en `calcularJornadaDiaria`, `horasDeSalidaPermiso`, `horasPermisoDescontadasMes`, `decidirPermiso` |
| Nómina del mes (colaborador) | `calculateMonthlyAccumulated` |
| Costo de mano de obra (Admin) | `calcularCostoManoDeObra` |
| Excel para nómina | `construirFilasDetalleHoras`, `construirFilasPermisos`, `construirFilasAusencias` |
| Guardar un día | `registrarEvento` (entrada/salida del colaborador), el botón `btn-save-manual` (Admin carga un día), `btn-editar-registro-guardar` (Admin edita), la "salida olvidada" declarada por el colaborador |

## Decisiones que ya tomó INDIMON (no son errores; sí puedes decir si alguna choca con la ley)

1. **Horario fijo pactado.** De lunes a viernes las horas son ordinarias hasta la salida pactada de la obra y extras lo que
   pase de ella, aunque la persona haya llegado tarde. Por defecto L-J 7:30–17:00 (8,5 h netas) y V 7:30–16:30 (8 h), o la
   jornada propia de cada obra (Admin → Horarios por obra). Tolerancia de 15 min a la salida.
2. **Meta semanal de 42 h**, menos las horas pactadas de cada festivo entre semana (descanso remunerado, no se repone).
3. **Entrar antes de la hora oficial no se paga**, salvo que Admin marque "entrada temprana autorizada".
4. **Tardanza:** no se descuenta sola; queda como dato y RRHH decide.
5. **Almuerzo:** si se marca, se descuenta lo real; si no, de lunes a viernes se asume 1 h, de forma gradual pasadas 5 h de
   turno; "sin almuerzo" exige quién lo autorizó. Domingo, festivo y sábado sin almuerzo pactado: no se asume.
6. **Horas extra:** desde el 21-oct-2026 no se pagan hasta que RRHH las aprueba.
7. **Domingo y festivo trabajado (salario mensual):** las horas ordinarias se pagan aparte al 100 % + el recargo, y las
   extras de ese día llevan además el recargo dominical. Recargo escalonado por fecha (art. 179 CST, Ley 2466 de 2025):
   75 % hasta 30-jun-2025, 80 % hasta 30-jun-2026, 90 % hasta 30-jun-2027, 100 % desde 1-jul-2027.
8. **Nocturno** desde las 19:00 (35 %); extra diurna 25 %, extra nocturna 75 %. Valor hora = sueldo ÷ 210.
9. **Ausencia injustificada:** se pierde el día y el domingo de esa semana (art. 173 CST), una sola vez por semana.
10. **Turno de más de 16 h o abierto varios días:** no se liquida solo; queda para revisión de Admin.
11. **Salida a cita o permiso dentro del turno (nov-2026):** el tiempo fuera no es trabajado (no puede volverse extra);
    dentro del horario pactado y sin la hora de almuerzo cuenta como permiso pagado y suma para las 42 h. Cita médica,
    diligencia, calamidad doméstica y obligación escolar no se descuentan (art. 57 CST, mod. Ley 2466); en "Permiso
    personal" RRHH decide: no se descuenta, se descuenta (horas × sueldo ÷ 210) o se repone.
12. **Neto estimado** = sueldo + extras/recargos − 8 % (salud y pensión) − descuentos. Es informativo, no la liquidación
    oficial. Los contratistas cobran por hora (`tarifa_hora`) en vez de sueldo.

## Qué queremos que revises

Empieza por lo que más dinero mueve y por los cruces entre reglas. Como mínimo:

- **Cada regla contra la ley vigente en Colombia**, con atención a las fechas de transición: recargo dominical (Ley 2466),
  jornada máxima (Ley 2101: la app usa 42 h fijas; ¿qué pasa al recalcular semanas anteriores a jul-2026?), inicio del
  nocturno a las 19:00 (¿desde cuándo aplica?), límite diario y semanal de horas extra.
- **Cosas que la app quizá no calcula y debería, o al menos avisar:** por ejemplo el auxilio de transporte (el sueldo de
  ejemplo, $1.750.905, es el salario mínimo de 2026), el descanso compensatorio por domingos habituales, y los festivos
  desde 2028 (`FESTIVOS_COLOMBIA` llega hasta dic-2027).
- **Que todos los caminos que guardan un día calculen igual:** entrada/salida del colaborador, salida olvidada, Admin
  carga un día, Admin edita, recálculo de la semana, permiso aprobado por firmas. Busca campos que un camino escribe y
  otro olvida (por ejemplo `horas_permiso_turno`, `salidas_permiso`, `extras_estado`).
- **Que el mismo dato dé el mismo número en todas partes:** nómina del colaborador (`calculateMonthlyAccumulated`),
  costo de mano de obra de Admin, Excel para nómina, la semana de Mi Tarjeta y el aviso de "semana incompleta".
- **Casos límite:** turnos que pasan la medianoche (y de sábado a domingo, o de domingo a lunes festivo), meses que
  cruzan un cambio de recargo, semanas que cruzan dos meses, días con almuerzo + salida a permiso + extras, contratistas,
  redondeos (dos decimales por día sumados en el mes).
- **Lo que un colaborador podría manipular** desde su celular para cobrar de más, sabiendo que las reglas de Firestore
  (`firestore.rules`) solo limitan algunas cosas (horas coherentes, estado de extras, decisión de RRHH).

## Cómo probar

- No uses datos reales de producción; no hay credenciales en este repositorio y no las pidas.
- Las pruebas existentes extraen las funciones reales de `index.html` y las corren aisladas, sin Firebase:
  `node tests/test-jornada-diaria.mjs` (52 casos de `calcularJornadaDiaria`), `test-festivo-trabajado`,
  `test-extras-aprobacion`, `test-descuento-ausencias`, `test-descanso-inferido`, `test-excel-consolidado`,
  `test-permisos-clasificacion` y las demás de `.github/workflows/test-jornada.yml`. `tests/extraer-calculadora.mjs`
  muestra cómo extraer funciones para probarlas.
- Para demostrar un hallazgo, escribe un caso nuevo con los números concretos (entrada, salida, almuerzo, fecha, obra) y
  el resultado que da la app frente al que debería dar. Si la prueba nueva falla a propósito, márcala claramente como
  "demuestra el hallazgo N" para que no rompa el CI sin querer (puede ir en un archivo aparte que el CI no corre).

## Qué entregar

Un archivo `docs/auditoria-nomina/INFORME.md`, en español simple, con:

1. **Resumen de una página:** cuántos hallazgos por gravedad y los 3 que hay que corregir primero.
2. **Cada hallazgo:** gravedad (crítico / alto / medio / bajo / pregunta para RRHH), qué pasa en palabras simples, un
   ejemplo con números y pesos (con sueldo de $1.750.905 si no se indica otro), dónde está en el código (función y
   archivo), qué dice la ley (artículo), la corrección propuesta y la prueba que lo demuestra.
3. **Lo que está bien:** las reglas que revisaste y que calculan correctamente, para saber qué no hay que tocar.
4. **Preguntas para RRHH o para un abogado laboral** donde la ley deja margen o la decisión es de la empresa.

Las conclusiones legales son orientativas: el informe debe recordar que un abogado laboral o RRHH tiene la última palabra.
