# Informe: auditoría del cálculo de nómina — Tarjeta de Tiempo INDIMON

Fecha: 11 de noviembre de 2026 · Revisión de solo lectura: **no se cambió `index.html` ni `firestore.rules`.**

> **Importante.** Las conclusiones legales de este informe son orientativas. Un abogado laboral o RRHH tiene la última
> palabra, sobre todo en los puntos marcados como "pregunta". Los ejemplos en pesos usan un sueldo de $1.750.905
> (hora = sueldo ÷ 210 = $8.338).

> **Informe unido.** Este encargo lo hicieron dos revisiones por separado, sin verse entre sí. Coincidieron en los
> hallazgos principales (1, 2, 3, 4, 7, 8, 9, 11, 12, 13 y 17), lo que da más confianza en ellos. Este archivo une las
> dos: los hallazgos 21 a 24, los puntos 8 y 9 del hallazgo 3, la ampliación del turno de madrugada en el hallazgo 19
> y las preguntas P9 a P11 vienen de la segunda revisión.

---

## 1. Resumen de una página

Se revisó de punta a punta cómo la app calcula un día, una semana y un mes; los seis caminos que guardan un día; lo
que muestran Mi Tarjeta, el costo de Admin y el Excel; y lo que un colaborador podría cambiar por fuera de la app.

**El corazón del cálculo está bien.** La función que liquida un día (`calcularJornadaDiaria`) reparte correctamente
ordinarias, extras, nocturnas y dominicales, también cuando el turno pasa la medianoche. Los recargos y sus fechas
coinciden con la ley, y el calendario de festivos 2026–2028 está correcto (54 fechas verificadas una por una).

**Los problemas están alrededor del cálculo:** en lo que llega al Excel, en lo que Admin alcanza a ver, en las reglas
de seguridad de la base de datos y en algunos cruces entre reglas.

| Gravedad | Cuántos | Qué significa |
|---|---|---|
| Crítico | 1 | Se deja de pagar dinero que la app sí calculó |
| Alto | 3 | Puede costar dinero o un reclamo; hay que corregirlo pronto |
| Medio | 10 | Paga o descuenta mal en casos concretos, o falla un control |
| Bajo | 10 | Casos raros, o cifras solo informativas |
| Preguntas para RRHH o abogado | 11 | La ley deja margen o la decisión es de la empresa |

Las dos revisiones calificaron distinto dos puntos. Las reglas de la base de datos (hallazgo 3) quedaron aquí como
"alto"; la segunda revisión las puso como "crítico". Y el turno de madrugada (dentro del hallazgo 19, "bajo") sube a
"alto" si INDIMON tiene turnos que empiezan después de medianoche: RRHH sabe si es el caso.

### Los 3 que hay que corregir primero

1. **Hallazgo 1 — El Excel para nómina deja por fuera las horas de los días que tienen un permiso.** Si alguien tuvo
   una cita médica en la mañana y trabajó el resto del día (incluso con horas extra ya aprobadas), ese día **no sale
   en la tabla de horas** del Excel. Quien liquida con ese archivo no le paga esas extras.
2. **Hallazgos 3 y 4 — Las reglas de la base de datos dejan escribir cosas que cambian el pago.** Un colaborador con
   conocimientos técnicos puede subirse las horas de un día que RRHH ya aprobó, o inventarse horas dominicales que se
   pagan sin aprobación. Y cualquier persona, sin iniciar sesión, puede fabricar un permiso "aprobado" y ponerle una
   "ausencia injustificada" a otro colaborador. Se corrigen juntos, en `firestore.rules`.
3. **Hallazgo 2 — Admin solo ve los 500 registros más recientes de toda la empresa.** El costo de mano de obra del mes
   y las listas de "extras por aprobar" y "por revisar" se arman con ese tope. Con muchas personas, parte del mes
   queda por fuera sin ningún aviso, y unas extras viejas sin aprobar pueden desaparecer de la lista y no pagarse nunca.

### Cómo se demostró

- `node tests/auditoria-nomina-hallazgos.mjs` — saca las funciones reales de `index.html` y muestra, hallazgo por
  hallazgo, lo que la app da y lo que debería dar (19 casos).
- `tests/auditoria-nomina-reglas.mjs` — prueba las reglas reales de `firestore.rules` en el emulador de Firebase (nunca
  la base real): 11 escrituras indebidas que hoy se aceptan. Las instrucciones están al inicio del archivo.
- `node tests/auditoria-nomina-complemento.mjs` — lo mismo para los hallazgos 22, 23 y 24 y el turno de madrugada
  completo del 19 (4 casos, ejecutados).
- `tests/auditoria-nomina-reglas-complemento.mjs` — tres casos más de reglas (hallazgo 3, puntos 8 y 9, y hallazgo
  21). **No se ejecutó**: el equipo de la segunda revisión no tenía Java. Salen de leer `firestore.rules`.
- Ninguna de las cuatro está en el CI y todas terminan siempre sin error. Cada caso dice "DEMUESTRA EL HALLAZGO N"
  mientras el problema exista y "YA CORREGIDO" cuando se arregle: sirven para confirmar cada corrección.
- Las pruebas que ya existían siguen pasando. No se usaron datos reales ni credenciales.

---

## 2. Hallazgos

### Hallazgo 1 — CRÍTICO — El Excel para nómina omite las horas de los días con permiso

- **Qué pasa.** La tabla "Detalle de horas y extras" del Excel solo incluye los días que **no** tienen tipo de
  permiso. Pero un día puede tener permiso **y** horas trabajadas: una cita médica por horas aprobada con firmas, un
  permiso cargado por Admin junto con el horario, o "Se devolvió sin completar la jornada". Ese día aparece solo en la
  tabla de permisos (por ejemplo "2,5 h") o en la de ausencias, sin sus horas trabajadas ni sus extras.
- **Ejemplo.** Martes 10-nov-2026, obra con entrada 7:30. Cita médica de 2,5 h en la mañana; trabaja de 10:00 a 19:00.
  La app calcula 6 h ordinarias y 2 h extra diurnas, y RRHH las aprueba: **$20.844**. Mi Tarjeta y el costo de Admin
  sí las cuentan; el Excel no las muestra. Lo mismo con quien "se devolvió" a las 11:00: sus 3,5 h trabajadas no salen.
- **Dónde.** `construirFilasDetalleHoras` en `index.html` (`rows.filter(r => !r.tipo_permiso)`).
- **Ley.** Las horas extra trabajadas se pagan con su recargo (arts. 159 y 168 CST).
- **Corrección propuesta.** Incluir en el detalle todo día que tenga entrada y salida u horas mayores que cero, aunque
  tenga permiso. El permiso puede seguir saliendo también en su tabla.
- **Prueba.** `tests/auditoria-nomina-hallazgos.mjs`, hallazgo 1.
- **Estado: CORREGIDO (12-nov-2026).** La tabla de horas ahora incluye todo día sin permiso y todo día con permiso que
  tenga horas trabajadas. Un día 100 % permiso o ausencia sigue saliendo solo en su tabla. Queda cubierto por el caso
  5 de `tests/test-excel-consolidado.mjs`, que corre en el CI.

### Hallazgo 2 — ALTO — Admin solo ve los 500 registros más recientes (costo, extras por aprobar, por revisar)

- **Qué pasa.** La pantalla de Admin carga los 500 registros más recientes de **toda** la empresa y sobre esos aplica
  los filtros. De ahí salen el Consolidado, el "Costo de mano de obra", "Extras por aprobar" y "Por revisar".
  El Excel sin colaborador elegido lee los 2000 más recientes y **después** filtra el mes; el aviso que muestra
  recomienda "filtrar por mes", que en ese caso no ayuda.
- **Ejemplo.** 30 personas × 22 días = 660 registros al mes: 160 días quedan fuera del costo del mes, sin aviso. Si la
  persona no tiene ningún registro dentro de los 500, tampoco se suma su sueldo base. Y un día con extras "por
  aprobar" que ya salió de los 500 más recientes deja de aparecer en la lista de RRHH: nunca se aprueba y nunca se
  paga. Con pocas personas (menos de unas 20) hoy puede no notarse en el mes en curso, pero sí al consultar meses
  anteriores.
- **Dónde.** `startAdminTableListener` (`fsLimit(500)`), `aplicarFiltrosYRenderizar`, `calcularCostoManoDeObra`,
  `extrasPorAprobar`, `pendientesDeRevision` y el botón `btn-export-excel` (`fsLimit(2000)`).
- **Ley.** No es un tema de ley, sino de control: el costo sale más bajo y hay extras que no se pagan.
- **Corrección propuesta.** Cuando hay filtro de mes, consultar ese mes completo por rango de fechas (como ya hace el
  "Resumen de nómina" por correo). Para "por aprobar" y "por revisar", consultar por estado y no por "los más
  recientes".
- **Prueba.** Hallazgo 2 del archivo de pruebas (comprueba el tope en el código; no se puede simular sin la base).
- **Estado: CORREGIDO en la app (12-nov-2026). Falta crear dos índices en Firestore.**
  - **Mes completo.** Con filtro de mes o de colaborador, el Consolidado y el costo de mano de obra leen ese mes (o esa
    persona) completo. Mientras llega se ve "Cargando…", nunca un número a medias.
  - **Excel.** Con filtro de mes lee el mes completo. Antes leía los 2000 registros más recientes y después filtraba.
  - **Pendientes.** "Por revisar" y "Extras por aprobar" se consultan aparte, por estado, sin tope. "Permisos por
    decidir" usa todo lo que el panel tiene cargado. Los días que Admin carga a mano con extras ahora guardan
    `extras_estado: 'por_aprobar'`, para que esa consulta los encuentre.
  - **Sin filtros.** La tabla sigue mostrando los 500 más recientes, y ahora lo dice en pantalla.
  - **Índices.** Las dos consultas de pendientes necesitan dos índices nuevos, definidos en `firestore.indexes.json`:
    `estado` y `extras_estado` del grupo de colecciones `registros`. Mientras no existan, la app usa la lista de
    siempre y muestra un aviso de "lista incompleta". Nada se rompe.
  - **Sigue pendiente.** Un día con extras cargado a mano antes de este cambio, sin `extras_estado`, solo aparece en
    "Extras por aprobar" si está en el mes filtrado o entre los recientes.

### Hallazgo 3 — ALTO — Un colaborador puede subirse el pago escribiendo directo en la base de datos

- **Qué pasa.** Las reglas de seguridad solo le exigen al colaborador que las horas de su día sean "posibles" (no
  negativas, máximo 24) y que no ponga el estado de extras en "aprobada". No revisan lo demás. Con la consola del
  navegador, sobre **sus propios** registros, puede:
  1. Subir las horas extra de un día que RRHH **ya aprobó** (el estado sigue "aprobada"). De 1 h a 15 h nocturnas:
     el pago pasa de $10.422 a **$218.863**.
  2. Marcar como "dominicales" y "nocturnas" las horas de un martes normal. Esas horas no pasan por aprobación:
     **$159.457** de más en un solo día.
  3. Crear un día con fecha anterior al 21-oct-2026 con horas extra: la app las toma como "anteriores a la
     aprobación" y las da por pagables (**$145.909** por 10 h nocturnas).
  4. Crear un domingo "trabajado" sin entrada ni salida, sin GPS ni foto.
  5. Quitarse la marca de "Ausencia injustificada" que puso Admin (se salva del descuento de 2 días, **$116.727**).
  6. Marcarse "entrada temprana autorizada" o "sin almuerzo" en un día ya cerrado.
  7. Cambiar su propio sueldo base (ver hallazgo 13).
  8. Pasar su propio día de "por revisar" a "completado": una salida olvidada, un fichaje fuera de la geocerca o un
     turno de más de 16 horas quedan aprobados sin que Admin los mire.
  9. Poner en 0 las horas del permiso que RRHH decidió descontar. La decisión sigue escrita, pero descuenta $0.
- **Dónde.** `firestore.rules`: `horasDiaCoherentes`, `extrasEstadoPermitidoColaborador` y la regla de
  `/empleados/{cedula}/registros/{fecha}`. En `index.html`: `estadoExtras` (usa el campo `fecha`) y `extrasPagables`.
- **Ley.** No aplica: es un riesgo de fraude. Requiere saber de programación, pero la dirección de la base es pública.
- **Corrección propuesta** (en `firestore.rules`, por pasos):
  - El colaborador no puede cambiar las horas de un día cuyas extras ya están aprobadas.
  - El colaborador solo puede escribir el día de hoy o el turno que tiene abierto; el campo `fecha` debe ser igual al
    nombre del documento.
  - `horas_dominicales` solo puede ser mayor que cero en domingo o festivo (o en el día anterior, por los turnos de
    noche).
  - Solo Admin puede escribir `tipo_permiso` de ausencia y `entrada_temprana_autorizada`.
  - Solo Admin puede pasar `estado` de "por revisar" a "completado", y el colaborador no puede cambiar
    `horas_permiso_turno` de un día que ya tiene decisión de RRHH.
  - Mejor a mediano plazo: guardar cuántas horas aprobó RRHH y pagar como máximo esa cifra.
- **Prueba.** `tests/auditoria-nomina-reglas.mjs` (7 casos, todos aceptados hoy por las reglas). Los puntos 8 y 9
  están en `tests/auditoria-nomina-reglas-complemento.mjs`, que no se ejecutó (leídos en las reglas).
- **Estado: CORREGIDO, menos el punto 7 (12-nov-2026).** `firestore.rules` agrega candados a lo que el colaborador
  escribe en su propio día:
  - un día nuevo solo nace como turno abierto, sin horas y con la fecha de hoy (margen de 3 días para fichajes sin señal);
  - con el turno abierto no puede cambiar la entrada ni los datos de Admin;
  - en un día cerrado solo puede recalcular horas; un día "por revisar" solo lo toca Admin;
  - las horas no pueden pasar del tiempo entre la entrada y la salida;
  - las horas dominicales solo caben en sábado, domingo, festivo o víspera de festivo;
  - si cambian las extras, vuelven a "por aprobar";
  - con decisión de RRHH, no cambia las horas de ese permiso.

  En `index.html`, "Recalcular semana" se ajustó a lo mismo, porque también corre desde el celular. Quedan cubiertos
  por 34 comprobaciones nuevas en `tests/test-reglas-firestore.mjs`, que corre en el CI: 14 de fichajes normales que
  deben seguir funcionando y 20 de ataques que deben rechazarse. Todo se ejecutó en el emulador: 80 de 80 correctas, y
  los puntos 1 a 6, 8 y 9 de `auditoria-nomina-reglas*.mjs` pasan a "YA CORREGIDO". Además se comprobó, apagando cada
  candado por separado, que cada ataque lo detiene el candado previsto y no otra cosa.

  Lo que **no** cierra:
  - **Punto 7 (el sueldo).** Es el hallazgo 13 y es una decisión de RRHH: quitarle al colaborador ese campo cambia
    lo que ve en Mi Tarjeta.
  - **La hora de cada marca la pone el celular.** Quien cambie el reloj del teléfono, o escriba al cerrar una salida
    más tarde, sigue cobrando ese tiempo. Cerrarlo necesita un servidor propio.
  - **Un domingo real.** Ahí las horas ordinarias se pagan sin aprobación, hasta lo que dura el turno (pregunta P9).
  - **Mantenimiento.** La lista de festivos está copiada también en `firestore.rules`: al agregar 2029 hay que ponerlo
    en los dos lugares.

### Hallazgo 4 — ALTO — Cualquiera, sin sesión, puede fabricar un permiso "aprobado" y ponerle una ausencia a otro

- **Qué pasa.** Los permisos se crean y se firman por enlace, sin iniciar sesión. Las reglas aceptan que alguien cree
  una solicitud a nombre de cualquier cédula y, en una sola escritura, le ponga las cuatro firmas y la deje
  "aprobada". Con ese permiso falso las reglas permiten:
  - crearle a esa persona un día de "Ausencia injustificada" (la app le descuenta el día y el domingo: **$116.727**);
  - marcar como "Ausencia injustificada" un día que **sí trabajó**: en el siguiente recálculo de la semana sus horas
    quedan en cero.
  Las reglas tampoco comprueban que la fecha del día sea la del permiso.
- **Dónde.** `firestore.rules`: `/permisos/{id}` (`create` y `update`), `permisoAprobadoValido`,
  `permisoTieneLas4Firmas` y la tercera rama de `/registros/{fecha}`. Las propias reglas ya anotan que no verifican la
  identidad de quien firma.
- **Ley.** Descontar salario sin causa real es ilegal (arts. 59 y 149 CST) y abre un reclamo.
- **Corrección propuesta.** Que la rama "permiso aprobado" no pueda escribir tipos de ausencia y que exija que la
  fecha del día coincida con la del permiso. Que pasar un permiso a nómina sea siempre tarea de Admin (la app ya tiene
  ese camino: `procesarPermisosAprobadosPendientes`), y cerrar la rama sin sesión.
- **Prueba.** `tests/auditoria-nomina-reglas.mjs` (4 casos).
- **Estado: CORREGIDO en lo principal (12-nov-2026).**
  - `firestore.rules` cierra la rama que dejaba escribir en el día de alguien **sin sesión** con un permiso
    "aprobado". Ahora solo Admin pasa un permiso a nómina, y ya lo hacía al entrar al panel.
  - Un permiso nuevo tiene que ser de un tipo del catálogo, así que no se puede crear uno de tipo "Ausencia
    injustificada".
  - En `index.html`, el paso a nómina rechaza tipos o fechas que no sean válidos y **nunca reemplaza una ausencia** que
    Admin ya registró en ese día: lo deja anotado en Auditoría para revisarlo a mano.
  - Cubierto por 7 comprobaciones en `tests/test-reglas-firestore.mjs` (87/87 en el emulador).

  **Lo que sigue abierto:** alguien sin sesión todavía puede crear un permiso de un tipo válido a nombre de otra
  persona y ponerle las 4 firmas, porque sin un servidor no se puede verificar quién firma. El riesgo que queda es una
  etiqueta de permiso en un día sin ausencia o, si es de vacaciones, el descuento de días del saldo. Cerrarlo del todo
  requiere validar las firmas en un servidor (Cloud Function) o que Admin confirme cada permiso antes de pasarlo a
  nómina.

### Hallazgo 5 — MEDIO — En festivo entre semana se descuenta 1 hora de almuerzo que la regla dice que no se asume

- **Qué pasa.** La decisión 5 de INDIMON dice: "domingo, festivo y sábado sin almuerzo pactado: no se asume". El
  código lo cumple en domingo, pero en un festivo que cae de lunes a viernes sí descuenta la hora si no se marcó.
- **Ejemplo.** Lunes festivo 16-nov-2026, 7:30–16:30 sin marcar almuerzo: la app paga 8 h (**$126.732**). El mismo
  turno en domingo paga 9 h (**$142.574**). Diferencia: **$15.842** por persona y por festivo trabajado.
- **Dónde.** `calcularJornadaDiaria`, variable `esDiaLaborableConAlmuerzo` (mira el día de la semana, no si es festivo).
- **Ley.** Si la persona trabajó esa hora, hay que pagarla (art. 179 CST). Si sí almorzó, el descuento está bien: por
  eso es una decisión de RRHH cuál de las dos reglas vale.
- **Corrección propuesta.** Decidir la regla. Si vale la escrita, añadir "y no es festivo" a esa condición.
- **Prueba.** Hallazgo 5.

### Hallazgo 6 — MEDIO — En una obra sin horario configurado, el horario se mueve con la hora de llegada

- **Qué pasa.** Si la obra no tiene horario, la pantalla dice "se calculará con el horario por defecto" (7:30–17:00),
  pero el cálculo toma como inicio la hora real de llegada y cuenta 9,5 h desde ahí.
- **Ejemplo (martes).** Llega 6:00 y sale 17:00: paga desde las 6:00 y da 1,5 h extra (**$15.633** si se aprueban),
  contra la decisión 3 (entrar antes no se paga). Llega 9:00 y sale 18:30: 0 extras y 0 minutos de tardanza, cuando con
  7:30–17:00 serían 1,5 h extra y 90 min de tardanza. Para un contratista, llegar antes se paga sin aprobación.
- **Dónde.** `calcularJornadaDiaria` (bloque `ventanaPactada`) frente a `jornadaEfectivaObra` y `salidaPactadaDe`.
- **Ley.** No aplica; es coherencia con las decisiones 1 y 3.
- **Corrección propuesta.** Usar 7:30 como entrada por defecto también en el cálculo, o no dejar fichar en una obra
  sin horario. Hoy Admin ya ve una etiqueta "N sin horario": conviene dejarla en cero.
- **Prueba.** Hallazgo 6.

### Hallazgo 7 — MEDIO — Al descontar un permiso personal con dos salidas el mismo día, se descuenta de más

- **Qué pasa.** Con una sola salida, el descuento usa las horas de permiso que calculó la jornada (dentro del horario
  y sin el almuerzo). Con dos o más salidas cambia de método: la salida "no volvió" toma el permiso de **todo** el día,
  y las demás se miden "de reloj", con la hora de almuerzo incluida.
- **Ejemplo.** Sale 9:00–10:00 y a las 15:00 se va y no vuelve. Permiso real del día: 3 h. Si RRHH marca "se
  descuenta" en las dos: **4 h = $33.351** en vez de 3 h = $25.013. Otro caso: permiso 11:30–14:30 el mismo día de
  otra salida corta: descuenta 3 h ($25.013) en vez de 2 h ($16.675).
- **Dónde.** `horasDeSalidaPermiso` y `horasPermisoDescontadasMes`.
- **Ley.** No se puede descontar más tiempo del que no se trabajó (art. 149 CST).
- **Corrección propuesta.** Que `calcularJornadaDiaria` guarde las horas de permiso de **cada** salida y que el
  descuento use ese dato.
- **Prueba.** Hallazgo 7 (dos casos).

### Hallazgo 8 — MEDIO — Al contratista la ausencia injustificada le resta 16 horas de lo que sí trabajó

- **Qué pasa.** Al contratista se le pagan solo las horas trabajadas. Aun así, Mi Tarjeta le resta "el día y el
  domingo" (2 días × 8 h × tarifa) por cada semana con ausencia injustificada: dinero de horas que sí trabajó, por dos
  días que nunca se le iban a pagar. El costo de Admin no hace ese descuento, así que los dos números no coinciden.
- **Ejemplo.** Tarifa $10.000/hora, trabaja 32 h y falta un día: la app muestra $320.000 − $160.000 = **$160.000**.
- **Dónde.** `calculateMonthlyAccumulated` (`valorDia`, `totalBruto`); `calcularCostoManoDeObra` no lo aplica.
- **Ley.** El art. 173 CST es para trabajadores con contrato laboral, no para contratistas (ver también pregunta P4).
- **Corrección propuesta.** No aplicar ese descuento a contratistas.
- **Prueba.** Hallazgo 8.

### Hallazgo 9 — MEDIO — Los caminos que guardan un día no hacen todos lo mismo

Los seis caminos usan la misma función de cálculo (eso está bien), pero difieren en lo que hacen alrededor:

| Camino | Recalcula la semana | Extras ya aprobadas que cambian | Salidas a permiso y decisión de RRHH |
|---|---|---|---|
| Entrada/salida del colaborador | Sí | Vuelven a "por aprobar" | Se conservan |
| Salida olvidada | Al aprobar Admin | — | Se conservan |
| Recalcular semana / aprobar revisión | Sí | Vuelven a "por aprobar" | Se conservan |
| **Admin edita un día** | **No** | **Siguen "aprobadas"** | Se conservan |
| **Admin guarda un día pasado** | Sí | Se borra el estado | **Se borran** |
| Permiso aprobado por firmas | No (no cambia horas) | — | Se conservan |

- **Ejemplo.** Día con 1 h extra aprobada ($10.422). Admin corrige la salida de 18:00 a 21:00: quedan 4 h extra
  ($50.026) que siguen "aprobadas" sin que RRHH vea la cifra nueva. Además, si ese día era un festivo o había un
  domingo trabajado esa semana, el reparto semanal no se actualiza hasta el siguiente recálculo. Y si Admin edita un
  día marcado como ausencia, quedan a la vez las horas pagadas y el descuento de la ausencia.
- **Dónde.** Botones `btn-editar-registro-guardar` y `btn-save-manual`; comparar con `calcularRecalculoSemana`.
- **Corrección propuesta.** Que "Editar" llame a `recalcularSemana` al terminar, y que "Guardar registro pasado"
  conserve `salidas_permiso`, `decisiones_permiso` y los datos de las extras.
- **Prueba.** Hallazgo 9 (dos casos).

### Hallazgo 10 — MEDIO — Cambiar el horario de una obra cambia el cálculo de los días ya trabajados

- **Qué pasa.** El horario de cada obra se guarda sin fecha de inicio. Cada vez que alguien cierra su día, la app
  recalcula toda su semana con el horario que esté configurado **en ese momento**.
- **Ejemplo.** Lunes trabajado 7:30–17:00. El miércoles Admin cambia la obra a 7:00–16:30. Al recalcular, ese lunes
  queda con 30 min de tardanza, 8 h ordinarias y 0,5 h extra por aprobar. Lo mismo pasaría al recalcular semanas viejas.
- **Dónde.** `getJornadaObra` y `getHoraEsperadaObra` (sin fecha), `recalcularSemana`.
- **Corrección propuesta.** Guardar el horario "vigente desde" una fecha, o cambiar horarios solo en lunes, o guardar
  en cada día el horario con el que se liquidó.
- **Prueba.** Hallazgo 10.

### Hallazgo 11 — MEDIO — La app no controla ni avisa el tope legal de horas extra

- **Qué pasa.** La app calcula y deja aprobar cualquier cantidad de horas extra. No avisa si un día pasa de 2 h o una
  semana de 12 h.
- **Ejemplo.** Martes 7:30–23:30: 6,5 h extra, aprobables con un clic.
- **Ley.** Máximo 2 horas extra al día y 12 a la semana (art. 22 de la Ley 50 de 1990). Superarlo expone a sanciones
  del Ministerio de Trabajo. Confirmar con el abogado el texto vigente después de la Ley 2466 de 2025.
- **Corrección propuesta.** Un aviso en "Extras por aprobar" con el total del día y de la semana. Las horas trabajadas
  se pagan igual; el aviso sirve para corregir la programación.
- **Prueba.** Hallazgo 11.

### Hallazgo 12 — MEDIO — El auxilio de transporte no aparece en el neto ni en el costo

- **Qué pasa.** El "neto estimado" es sueldo + extras − 8 % − descuentos. No suma el auxilio de transporte de quienes
  ganan hasta 2 salarios mínimos. El costo de Admin tampoco lo incluye (ni prestaciones ni aportes del empleador).
- **Ejemplo.** Salario mínimo sin novedades: la app muestra **$1.610.833**; con el auxilio de 2026 ($249.095, que no
  lleva el 8 %) el colaborador recibe cerca de **$1.859.928**. La diferencia de $249.095 genera dudas y reclamos.
- **Ley.** Ley 15 de 1959 y decreto anual del auxilio. Confirmar el valor y si las extras cuentan para el tope de 2
  salarios mínimos. El auxilio se paga por día trabajado (no en ausencias, vacaciones ni incapacidad).
- **Corrección propuesta.** Sumarlo al neto cuando el sueldo sea de hasta 2 salarios mínimos, o al menos poner una
  nota: "no incluye auxilio de transporte". En el costo de Admin, aclarar que es solo sueldo + extras.
- **Prueba.** Hallazgo 12.

### Hallazgo 13 — BAJO — El sueldo lo escribe el propio colaborador y alimenta el costo de Admin

- **Qué pasa.** En Mi Tarjeta cada persona escribe su sueldo (o su tarifa por hora) y las reglas se lo permiten. Ese
  número es el que usan el costo de mano de obra y el valor en pesos que RRHH ve al descontar un permiso.
- **Ejemplo.** Si alguien escribe $9.000.000, sus extras "cuestan" 5 veces más en el reporte de Admin.
- **Dónde.** Botón `btn-save-sueldo`; regla de `/empleados/{cedula}` en `firestore.rules`.
- **Corrección propuesta.** Que el sueldo lo cargue solo Admin (ya existe el botón en Gestión de Colaboradores).

### Hallazgo 14 — BAJO — Un permiso de día completo no cuenta para las 42 horas

- **Qué pasa.** "Esta semana: X de 42 h" y el correo de "semana incompleta" suman lo trabajado y las salidas a cita
  dentro del turno, pero no los permisos de día completo, las vacaciones ni las incapacidades. Además, el correo solo
  se revisa si la persona marca entrada un lunes (si el lunes es festivo o no viene, esa semana no se revisa). Ojo:
  según el hallazgo 21, hoy ese correo ni siquiera llega a enviarse.
- **Ejemplo.** Lunes con licencia por luto y martes a viernes trabajados: la app dice 33,5 de 42 h. Si además hubo una
  tardanza, RRHH recibe un correo de "no completó las horas". Si esa persona trabaja el domingo, 8,5 h quedan como
  ordinarias (×1,90) en vez de extra (×2,15): $17.717 menos.
- **Dónde.** `horasParaMetaSemana`, `getResumenSemana`, `verificarCumplimientoSemanal`.
- **Corrección propuesta.** Sumar a la meta las horas de los permisos remunerados de día completo.
- **Prueba.** Hallazgo 14.

### Hallazgo 15 — BAJO — El neto estimado no refleja licencias no remuneradas ni incapacidades

- **Qué pasa.** El neto solo descuenta ausencias injustificadas y permisos personales que RRHH marcó "se descuenta".
  No descuenta una "Licencia no remunerada (art. 51 CST)" ni un permiso de día completo no remunerado, ni ajusta una
  incapacidad. El 8 % se calcula antes de restar los descuentos, y no se incluye el Fondo de Solidaridad Pensional
  (1 % adicional desde 4 salarios mínimos).
- **Ejemplo.** Un día de licencia no remunerada vale $58.364 que el neto estimado no resta.
- **Dónde.** `calculateMonthlyAccumulated`.
- **Corrección propuesta.** Restar esos días, o decir en pantalla qué no incluye el estimado.

### Hallazgo 16 — BAJO — Los días anteriores a los cambios de ley se liquidan con las reglas de hoy

- **Qué pasa.** El recargo dominical sí cambia por fecha (bien). Pero la hora siempre vale sueldo ÷ 210, la meta
  siempre es 42 h y la noche siempre empieza a las 19:00.
- **Ley.** Ley 2101 de 2021: 44 h semanales (hora = sueldo ÷ 220) hasta el 14-jul-2026 y 42 h (÷ 210) desde el
  15-jul-2026. Ley 2466 de 2025: la noche empieza a las 19:00 desde el 25-dic-2025; antes, a las 21:00.
- **Ejemplo.** 2 h extra diurnas del 2-jun-2026: la app da $20.844; con ÷ 220 serían $19.897. Un turno 12:31–21:30
  del 2-dic-2025: 2,5 h de recargo nocturno en vez de 0,5 h.
- **Riesgo real.** Bajo: la app empezó a usarse en el segundo semestre de 2026. Solo importa si se cargan o
  recalculan días anteriores a esas fechas.
- **Corrección propuesta.** Hacer con el divisor y el inicio de la noche lo mismo que ya se hizo con el recargo
  dominical (una función por fecha), o bloquear la carga de días anteriores al 15-jul-2026.
- **Prueba.** Hallazgo 16 (dos casos).

### Hallazgo 17 — BAJO — El calendario de festivos se acaba en diciembre de 2028 y nadie avisa

- **Qué pasa.** La lista llega hasta el 25-dic-2028 (un año más de lo que decía el encargo). Desde el 1-ene-2029
  ningún festivo se pagaría con recargo, y la meta semanal no bajaría.
- **Corrección propuesta.** Calcular los festivos con la fórmula (Pascua + ley Emiliani), que en esta auditoría dio
  exactamente las mismas 54 fechas, o mostrarle un aviso a Admin cuando falten menos de 6 meses.
- **Prueba.** Hallazgo 17.

### Hallazgo 18 — BAJO — Un almuerzo de exactamente 20 minutos a veces se toma como "no marcado"

- **Qué pasa.** Por un redondeo interno del computador, un almuerzo de 20 minutos exactos a veces se mide como
  19,9999 minutos y se descarta: se descuenta 1 hora completa en vez de 20 minutos.
- **Ejemplo.** Almuerzo 12:00–12:20: 0,67 h extra. Almuerzo 11:50–12:10 (los mismos 20 minutos): 0 h extra.
- **Dónde.** `calcularJornadaDiaria` (`duracionMin >= MIN_ALMUERZO_VALIDO_MIN`).
- **Corrección propuesta.** Comparar en minutos enteros (redondear antes de comparar).
- **Prueba.** Hallazgo 18.

### Hallazgo 19 — BAJO — Casos de borde en turnos poco comunes

- **Salto a las 5 horas de tardanza.** Entrada oficial 7:30, salida 21:30. Si llega a las 12:29 es "tardanza": 4 h
  ordinarias y 4 h extra ($52.214 si se aprueban). Si llega a las 12:31 es "otro turno": 8 h ordinarias, 0 extras.
- **Turno que empieza después de medianoche.** Un llamado 00:30–8:00 en una obra con entrada 7:30 paga 0,5 h: todo lo
  anterior a las 7:30 se toma como "llegó temprano". Admin tiene que marcar "entrada temprana autorizada".
  Lo mismo le pasa a un turno de noche entero: 00:30–8:30 da 1 h ordinaria y 0 h de recargo nocturno, cuando la misma
  app, si la obra no tiene horario, da 7 h y 4,5 h de recargo. Son $13.132 de recargo nocturno sin pagar por turno, y
  a un contratista le faltan 6 h de pago. Para las llegadas tarde la app ya distingue "más de 5 horas es otro turno";
  para las tempranas no. **Si INDIMON tiene turnos que empiezan de madrugada en obras con hora de entrada, este punto
  es de gravedad alta**, y la corrección es aplicar la misma regla de las 5 horas hacia atrás.
- **Domingo a lunes.** Un turno domingo 20:00 – lunes 6:00, con la semana ya completa, queda todo como extra
  nocturna, incluidas las 6 horas del lunes, que ya son de la semana siguiente.
- **Turnos largos cargados por Admin.** El colaborador no puede cerrar un turno de más de 16 h, pero "Guardar registro
  pasado" solo pide confirmar desde 12 h y "Editar" no tiene tope: un error de digitación de 23 h se liquida completo.
- **Dónde.** `calcularJornadaDiaria`, `calcularMinutosTardanza`, botones de Admin.
- **Corrección propuesta.** Marcar estos días para revisión de Admin en vez de liquidarlos solos.
- **Prueba.** Hallazgo 19 (dos casos), y el turno entero en `tests/auditoria-nomina-complemento.mjs`.

### Hallazgo 20 — BAJO — El descuento por ausencia se anota en el mes del domingo

- **Qué pasa.** Si la semana cruza dos meses, el descuento del día y del domingo se le carga al mes en que cae el
  domingo. Ejemplo: ausencia el lunes 30-nov-2026; el descuento de 2 días ($116.727) aparece en diciembre. En el Excel
  de noviembre la ausencia sale con sus días, pero si esa semana tuvo otra ausencia en diciembre, cada mes ve solo su
  parte.
- **Dónde.** `calcularDiasDescontadosPorAusenciasMes`, `construirFilasAusencias`.
- **Corrección propuesta.** Confirmar con nómina en qué mes lo descuentan ellos y dejarlo igual. También recordar que
  la app solo descuenta si Admin **registra** la ausencia: un día sin ningún registro no descuenta nada.

### Hallazgo 21 — MEDIO — El correo de "semana incompleta" a RRHH nunca se envía

- **Qué pasa.** Cada lunes, al marcar entrada, el celular del colaborador revisa su semana anterior y debería avisar
  por correo a RRHH si hubo ausencia injustificada o faltaron horas con tardanza. Antes de enviar, lee una marca de
  "ya avisado" para no repetir el correo. Las reglas solo le dejan leer esa marca a Admin: la lectura falla, la función
  termina ahí y el correo no sale. El error solo queda en la consola del navegador.
- **Por qué importa.** La decisión 4 (la tardanza no se descuenta sola; RRHH decide) se apoya en ese aviso.
- **Dónde.** `verificarCumplimientoSemanal` en `index.html`; `match /avisos_semana_incumplida/{id}` en
  `firestore.rules` (`allow read: if esAdmin()`).
- **Ley.** No aplica: es un control interno que no está funcionando.
- **Corrección propuesta.** Crear la marca sin leerla antes y tratar "ya existe" como "ya avisado", o generar el aviso
  desde `scripts/` con la cuenta de servicio.
- **Prueba.** `tests/auditoria-nomina-reglas-complemento.mjs`, que no se ejecutó (leído en el código y en las reglas).
  RRHH lo puede confirmar sin programar: ¿ha llegado alguna vez un correo con asunto "Revisar semana de…"?

### Hallazgo 22 — MEDIO — El Excel trae las extras sin aprobar en las mismas columnas que las aprobadas

- **Qué pasa.** Mi Tarjeta y el costo de Admin solo cuentan las extras aprobadas. El Excel trae todas las horas extra
  del día en las mismas columnas y deja el estado ("POR APROBAR", "NO AUTORIZADA") en otra columna, al final. Los días
  "por revisar" también salen con sus horas calculadas. Además no hay columna para las horas ordinarias trabajadas en
  domingo o festivo, que desde el 3-nov se pagan aparte al 100 % (decisión 7): solo sale "horas dominicales", con
  ordinarias y extras juntas.
- **Ejemplo.** Día con 2 h extra diurnas "no autorizadas": la columna del Excel dice 2 h; la app paga 0 h. Quien sume
  la columna paga **$20.844** que RRHH no autorizó. Con 10 h en el mes son $104.221.
- **Dónde.** `construirFilasDetalleHoras` y `descargarExcelConsolidado` frente a `extrasPagables`.
- **Corrección propuesta.** Agregar las columnas "extras a pagar" (solo aprobadas) y "ordinarias en domingo/festivo",
  y dejar aparte las horas de los días "por revisar".
- **Prueba.** `tests/auditoria-nomina-complemento.mjs`, hallazgo 22.

### Hallazgo 23 — BAJO — Recargo dominical retenido mientras las extras de ese domingo están por aprobar

- **Qué pasa.** Si las extras de un domingo no están aprobadas, la app resta **todas** las horas extra del total de
  horas dominicales. Si el turno pasa la medianoche y parte de las extras cae ya en lunes, resta de más.
- **Ejemplo.** Domingo 22-nov-2026 de 14:00 a 02:00: 9 h ordinarias, todas en domingo, y 3 h extra (1 en domingo y 2
  en lunes). Mientras RRHH no aprueba, se paga recargo dominical sobre 7 h en vez de 9: faltan **$15.008**. Al aprobar
  queda bien.
- **Dónde.** `extrasPagables`.
- **Corrección propuesta.** Guardar por separado las horas dominicales de la parte ordinaria y de la parte extra.
- **Prueba.** `tests/auditoria-nomina-complemento.mjs`, hallazgo 23.

### Hallazgo 24 — BAJO — La meta de una semana con festivo no usa la jornada propia de la obra

- **Qué pasa.** En una semana con festivo la meta baja 8,5 h (8 h si es viernes), que es el horario general. Si la
  obra tiene otra jornada, la meta queda mal. Y un festivo que cae en un sábado pactado no baja la meta.
- **Ejemplo.** Obra con lunes a viernes 7:00–15:30 (7,5 h) y sábado 7:00–11:30 (4,5 h): 42 h. Con festivo el lunes la
  app da meta de 33,5 h; debería dar 34,5 h. Afecta "Mi semana", el aviso de semana incompleta y cuántas horas de un
  domingo trabajado son ordinarias.
- **Dónde.** `metaSemanalOrdinaria` (usa `HORARIO_PACTADO_HORAS`, no la jornada de la obra).
- **Corrección propuesta.** Calcular la meta con la jornada de la obra del colaborador.
- **Prueba.** `tests/auditoria-nomina-complemento.mjs`, hallazgo 24.

---

## 3. Lo que está bien (no hay que tocarlo)

Se revisó y calcula correctamente:

- **Recargos y sus valores:** nocturno 35 %, extra diurna 25 %, extra nocturna 75 % (art. 168 CST); se suman bien con
  el dominical (extra diurna en festivo ×2,15; extra nocturna ×2,65; ordinaria nocturna en festivo ×2,25).
- **Recargo dominical por fecha:** 75 % / 80 % / 90 % / 100 % con los cortes del 1-jul de 2025, 2026 y 2027. Un mes
  que cruza un cambio pesa cada día con su porcentaje.
- **Domingo y festivo trabajado con salario mensual:** horas ordinarias al 100 % + recargo; las extras llevan además
  el recargo dominical. Mi Tarjeta y el costo de Admin usan las mismas funciones y dan el mismo número.
- **Turnos que pasan la medianoche:** las horas se reparten por día calendario (sábado→domingo, domingo→lunes,
  víspera de festivo), y la madrugada (0:00–6:00) cuenta como nocturna.
- **Calendario de festivos 2026, 2027 y 2028:** las 54 fechas coinciden con el cálculo independiente.
- **Horario fijo pactado:** ordinarias hasta la salida pactada, extras después, con jornada por obra, viernes distinto
  y sábado pactado. La app no deja configurar una jornada de más de 42 h semanales.
- **Tolerancias:** 15 min a la entrada y a la salida, exactas en el borde (17:14 no da extra, 17:15 sí).
- **Almuerzo:** el marcado descuenta lo real; el asumido entra de forma gradual después de 5 h; un almuerzo al revés o
  fuera del turno se descarta; "sin almuerzo" convierte la hora en extra que RRHH debe aprobar.
- **Salidas a cita o permiso dentro del turno (una sola salida):** el tiempo fuera no se vuelve extra, no paga la hora
  de almuerzo como permiso, "no vuelvo hoy" completa el horario como permiso y suma para las 42 h.
- **Meta semanal:** 42 h menos los festivos entre semana no trabajados (Semana Santa 2026: 25,5 h).
- **Ausencia injustificada (salario mensual):** el día más el domingo, una sola vez por semana; el festivo de esa
  semana se sigue pagando; sueldo ÷ 30 por día.
- **Aprobación de extras:** las no aprobadas no entran al pago en ningún lado (Mi Tarjeta, costo, resumen por correo);
  al recalcular, las aprobadas que cambian vuelven a "por aprobar".
- **Turnos de más de 16 h o abiertos varios días (fichados por el colaborador):** no se liquidan solos.
- **Redondeo:** dos decimales por día; el error acumulado en un mes es de unos pocos cientos de pesos.

---

## 4. Preguntas para RRHH o para un abogado laboral

- **P1. Descanso compensatorio.** Quien trabaja 3 o más domingos en el mes ("habitual") tiene derecho, además del
  pago, a un día de descanso compensatorio remunerado; quien trabaja 1 o 2 puede elegir entre el descanso o el pago
  (arts. 180 y 181 CST). La app siempre paga y no lleva la cuenta de domingos ni de compensatorios. ¿Se lleva aparte?
- **P2. Extras "no autorizadas" que sí se trabajaron.** La app no las paga hasta que RRHH las aprueba (decisión 6).
  Si el jefe sabía y las permitió, un juez puede ordenar pagarlas aunque no estuvieran autorizadas. ¿Cuál es la política?
- **P3. Minutos que no se pagan.** Quedarse hasta 14 minutos después de la salida y entrar antes de la hora oficial no
  se paga (decisiones 1 y 3). Si la persona trabaja de verdad en ese tiempo, es trabajo sin pago. ¿Está en el
  reglamento interno?
- **P4. Contratistas.** La app les controla horario, tardanzas, recargos de ley y descanso dominical. Eso se parece a
  un contrato laboral y puede usarse como prueba de "contrato realidad" (arts. 23 y 24 CST). Conviene que un abogado lo
  revise.
- **P5. Extras cuando la persona llegó tarde o salió a un permiso.** Por la decisión 1, quien llega 2 horas tarde y se
  queda 2 horas después de la salida cobra 2 h extra aunque trabajó la jornada normal. Igual quien sale 2 h a un
  permiso personal y se queda 2 h "para reponer": si RRHH aprueba esas extras y además marca "se repone", no hay cruce
  entre las dos cosas. ¿RRHH debe negar esas extras?
- **P6. Sábado.** En una obra sin sábado pactado, todo lo trabajado el sábado es extra, aunque esa semana la persona
  no haya completado las 42 h. ¿Es lo que se quiere?
- **P7. Almuerzo asumido.** Si no se marca almuerzo se descuenta 1 hora, también en turnos de noche. Si la persona no
  almorzó y no marcó "sin almuerzo", trabaja una hora sin pago. ¿Se le explica esto a cada colaborador nuevo?
- **P8. Ausencia y domingo.** La app quita el domingo solo por ausencia injustificada registrada por Admin. ¿Qué pasa
  con quien se devuelve a media jornada sin permiso? Hoy conserva el domingo y se le pagan las horas trabajadas.
- **P9. Domingo o festivo trabajado sin aprobación.** Las horas ordinarias de ese día se pagan (×1,90) sin que RRHH
  las apruebe; solo las extras piden aprobación. ¿Debería aprobarse también el trabajo en domingo o festivo?
- **P10. Extras anteriores al 21-oct-2026.** Se pagan sin aprobación para siempre (decisión 6), también si alguien
  carga o corrige hoy un día de esa época. ¿Se quiere cerrar esa puerta?
- **P11. Quién decide que una ausencia es injustificada.** El descuento de 2 días es automático cuando Admin pone la
  etiqueta. El art. 173 CST exige que la falta no tenga justa causa. ¿Hay un paso para oír al trabajador antes?

---

## 5. Anexo: cómo repetir las pruebas

```
node tests/auditoria-nomina-hallazgos.mjs

npm install --no-save firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.13.0
npx firebase emulators:exec --only firestore --project demo-indimon "node tests/auditoria-nomina-reglas.mjs"
```

La segunda necesita Java y usa solo el emulador local. Ninguna toca la base real ni necesita credenciales.

Las pruebas complementarias (hallazgos 21 a 24 y puntos 8 y 9 del hallazgo 3) se corren igual:

```
node tests/auditoria-nomina-complemento.mjs
npx firebase emulators:exec --only firestore --project demo-indimon "node tests/auditoria-nomina-reglas-complemento.mjs"
```

La de reglas complementaria está escrita pero **no se ha ejecutado nunca**: conviene correrla una vez para confirmar
sus tres casos.

Lo que **no** se pudo probar con datos: el hallazgo 2 (tope de 500 registros) y los caminos de Admin del hallazgo 9
dependen de la pantalla y de la base; se comprobaron leyendo el código y con una verificación del texto del código.
