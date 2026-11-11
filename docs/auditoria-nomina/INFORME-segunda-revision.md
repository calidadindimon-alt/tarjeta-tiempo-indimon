# Segunda revisión independiente: auditoría del cálculo de nómina — Tarjeta de Tiempo INDIMON

Fecha: 11 de noviembre de 2026 · Rama `claude/brave-franklin-1im780` · Responde a `docs/auditoria-nomina/ENCARGO.md`

## Relación con `INFORME.md` (leer primero)

Este mismo encargo se hizo dos veces, por separado y sin que una revisión viera a la otra. Cuando esta terminó, en la
rama ya estaba `INFORME.md` (el informe principal). No se tocó. Este archivo es la segunda revisión completa, con su
propia numeración de hallazgos.

**Las dos revisiones coinciden en lo principal**, y eso da más confianza en esos hallazgos: el Excel omite los días
con permiso, las reglas dejan que un colaborador se suba el pago, alguien sin sesión puede fabricar un permiso, el
descuento al contratista, las dos salidas a permiso, "Editar" de Admin, el tope de 500 registros, el auxilio de
transporte, el tope de extras y los festivos desde 2029. El informe principal sí pudo correr la prueba de reglas en el
emulador y confirma que hoy se aceptan; esta revisión solo las leyó.

**Lo que esta revisión agrega y no está en `INFORME.md`:**

| Aquí | Qué es | Gravedad |
|---|---|---|
| Hallazgo 6 | El correo de "semana incompleta" a RRHH nunca se envía: el celular del colaborador no tiene permiso de leer la marca de "ya avisado". | Medio |
| Hallazgo 3c | Un colaborador puede pasar su propio día de "por revisar" a "completado" (salida olvidada, geocerca, turno largo). | Parte del crítico |
| Hallazgo 3e | Un colaborador puede poner en 0 las horas del permiso que RRHH decidió descontar. | Parte del crítico |
| Hallazgo 9 | Domingo que termina en lunes con extras por aprobar: se retiene recargo dominical de horas ordinarias. | Bajo |
| Hallazgo 10 | La meta de una semana con festivo no usa la jornada propia de la obra. | Bajo |
| Hallazgo 12 | El Excel trae las extras sin aprobar en las mismas columnas que las aprobadas, y no tiene columna para las horas ordinarias de domingo que se pagan al 100 %. | Medio |

**Donde las dos revisiones califican distinto:**

- **Turno de madrugada** (aquí hallazgo 1, alto; allá parte del hallazgo 19, bajo). La diferencia es de frecuencia: si
  INDIMON tiene turnos que empiezan después de medianoche en obras con hora de entrada, es alto; si casi nunca pasa,
  es bajo. RRHH sabe cuál es el caso.
- **Reglas de la base de datos** (aquí crítico; allá alto). Mismo problema, misma corrección.
- **Descanso compensatorio** (aquí hallazgo 16; allá pregunta P1).

**Lo que está en `INFORME.md` y esta revisión no encontró:** el almuerzo que se descuenta en festivo entre semana
(hallazgo 5 de allá), el horario que se mueve con la llegada en obras sin horario (6), el permiso de día completo que
no cuenta para las 42 h (14), el almuerzo de 20 minutos exactos (18) y el salto a las 5 horas de tardanza (19).

Recomendación: usar `INFORME.md` como lista de trabajo y sumarle las seis filas de la tabla de arriba.

---

> **Aviso.** Las conclusiones legales de este informe son orientativas. Un abogado laboral o RRHH tiene la última
> palabra. La revisión fue de solo lectura: no se cambió `index.html` ni `firestore.rules`, y no se usaron datos reales.

## Cómo leer este informe

- Los ejemplos en pesos usan el sueldo de $1.750.905. Valor de la hora = sueldo ÷ 210 = **$8.338**.
- "La app" es `index.html`. "Las reglas" son `firestore.rules` (lo que el servidor deja escribir).
- Cada hallazgo dice cómo se comprobó:
  - **Probado con números:** hay un caso en `tests/auditoria-demuestra-hallazgos.mjs` que corre las funciones reales
    de la app y muestra el resultado. Se ejecutó y reproduce los 7 hallazgos que cubre.
  - **Leído en el código:** se comprobó leyendo la función; no se puede correr aislada porque depende de la base de datos.
  - **Leído en las reglas, sin ejecutar:** hay un caso en `tests/auditoria-demuestra-reglas.mjs`, pero **no se pudo
    correr** (necesita Java para el emulador de Firebase y el equipo de la auditoría no lo tenía). Conviene correrlo
    una vez para confirmar.
- Ninguna de las dos pruebas nuevas está en el CI y ninguna termina en error: solo informan.

---

## 1. Resumen

### Cuántos hallazgos

| Gravedad | Cantidad | Cuáles |
|---|---|---|
| Crítico | 1 | 3 |
| Alto | 3 | 1, 2, 5 |
| Medio | 9 | 4, 6, 7, 8, 11, 12, 14, 15, 16 |
| Bajo | 6 | 9, 10, 13, 17, 18, 19 |
| Preguntas para RRHH o abogado | 9 | sección 4 |

### Los 3 que hay que corregir primero

1. **Hallazgo 3 (crítico) — un colaborador puede escribir en su propio día horas que no trabajó, y aprobarse cosas
   que le tocan a Admin.** Las reglas del servidor solo revisan que las horas no pasen de 24 y que no cambie el estado
   de las extras. Todo lo demás lo dejan pasar. Ejemplo: un domingo inventado de 9 horas suma $142.574 sin que nadie
   lo apruebe.
2. **Hallazgo 2 (alto) — el Excel para nómina no trae los días trabajados que además tienen un permiso.** Si una
   persona tuvo cita médica aprobada y ese día trabajó el resto de la jornada, o hizo extras, ese día no aparece en la
   tabla de horas. Mi Tarjeta sí lo cuenta. En el ejemplo probado faltan $147.576.
3. **Hallazgo 1 (alto) — un turno de madrugada en una obra con hora de entrada se paga solo desde esa hora.**
   Entrar a las 00:30 y salir a las 08:30 en una obra con entrada 07:30 da 1 hora y cero recargo nocturno.

Después de esos tres: el **hallazgo 5** (al contratista se le descuentan 16 horas por una falta, aunque ya no cobra el
día que faltó) es el siguiente en dinero.

### Lo más importante en una frase

El cálculo de un día normal está bien y bien probado. Los problemas están en los bordes: lo que el servidor deja
escribir, lo que el Excel deja por fuera y algunos cruces (madrugada, contratistas, dos salidas a permiso).

---

## 2. Hallazgos

### Hallazgo 1 — Turno de madrugada recortado a la hora de entrada de la obra · ALTO

**Qué pasa.** La app no paga el tiempo trabajado antes de la hora oficial de la obra (decisión 3 de INDIMON). Esa regla
está pensada para quien llega 20 minutos antes. Pero también se aplica a un turno entero que empieza de madrugada: la
app lo trata como "llegó muy temprano" y borra todas las horas anteriores a la entrada oficial. Para las llegadas
tarde sí existe la distinción ("más de 5 horas después es otro turno"); para las tempranas no.

**Ejemplo.** Martes 10-nov-2026, obra con entrada 07:30. Entra 00:30, sale 08:30 (8 horas).

| | Horas ordinarias | Recargo nocturno |
|---|---|---|
| La app da | 1 h | 0 h |
| Debería dar (es lo que da la misma app si la obra no tiene horario) | 7 h | 4,5 h |

Al de salario mensual le faltan $13.132 de recargo nocturno por turno y le aparecen 6 horas menos en la semana. A un
contratista le faltan 6 horas de pago.

**Dónde.** `calcularJornadaDiaria` en `index.html`, la línea que hace `hIn = horaEsperadaFloat` cuando la entrada es
anterior a la hora de la obra.

**Ley.** Arts. 158 a 160 y 168 CST: el trabajo nocturno ordinario lleva recargo del 35 %, y todo trabajo ordenado o
consentido por el empleador se paga.

**Corrección propuesta.** Usar la misma idea que ya existe para las tardanzas: si la entrada es más de 5 horas antes de
la hora de la obra, es otro turno y no se recorta. Mientras tanto, Admin puede marcar "entrada temprana autorizada"
al cargar ese día.

**Prueba.** Probado con números: `tests/auditoria-demuestra-hallazgos.mjs`, hallazgo 1.

---

### Hallazgo 2 — El Excel para nómina omite los días trabajados que tienen un permiso · ALTO

**Qué pasa.** La tabla "Detalle de horas y extras" del Excel solo incluye los días **sin** tipo de permiso. Pero un día
puede tener permiso **y** horas trabajadas. Pasa en tres casos normales:

- Permiso por horas aprobado por firmas (cita médica, diligencia): la app pone la etiqueta del permiso en el registro
  del día, y la persona trabaja el resto de la jornada.
- Admin carga un día con horario y un permiso parcial.
- "Se devolvió sin completar la jornada": la persona trabajó una parte.

Esos días salen en la tabla de permisos o de ausencias, que solo muestra las horas del permiso. Las horas trabajadas,
las extras, el recargo nocturno y las horas de domingo de ese día no aparecen en ninguna parte del Excel. Mi Tarjeta y
el costo de mano de obra sí las cuentan, así que los números no coinciden.

**Ejemplo.** Tres días de una misma persona:

| Día | Qué pasó | En el Excel |
|---|---|---|
| Mié 11-nov | Cita médica aprobada; trabajó 10:00–19:00: 6 h ordinarias + 2 h extra aprobadas | Solo "Cita médica 2,5 h" |
| Jue 12-nov | Se devolvió; trabajó 07:30–12:00: 4,5 h | Solo "Se devolvió" |
| Dom 15-nov | Trabajó 8 h en domingo con 1 h de permiso personal | Solo "Personal 1 h" |

La tabla de horas trae 0 de los 3 días. Faltan 2 h extra ($20.844) y 8 h de domingo ($126.732): **$147.576**.

**Dónde.** `construirFilasDetalleHoras` en `index.html` (`rows.filter(r => !r.tipo_permiso)`).

**Corrección propuesta.** Incluir en la tabla de horas todo día que tenga horas trabajadas, tenga o no permiso. El día
puede seguir apareciendo también en la tabla de permisos.

**Prueba.** Probado con números: hallazgo 2 del mismo archivo.

---

### Hallazgo 3 — El colaborador puede escribir horas y estados en su propio día · CRÍTICO

**Qué pasa.** La app calcula todo en el celular y luego guarda el resultado. El servidor no puede repetir el cálculo,
así que solo revisa tres cosas del registro de un colaborador: que las horas del día no pasen de 24, que no cambie el
estado de las extras a "aprobada" y que no toque la decisión de RRHH sobre permisos. Con conocimientos técnicos (la
consola del navegador) alguien puede guardar directamente lo que quiera dentro de esos límites, en cualquier fecha.

Seis maneras concretas, todas a favor del colaborador:

| | Qué puede hacer | Efecto con sueldo de $1.750.905 |
|---|---|---|
| 3a | Crear un domingo "trabajado" de 9 h sin fichar. Las horas ordinarias de domingo y el recargo nocturno se pagan sin aprobación de nadie. | 9 h × $8.338 × 1,90 = **$142.574** por domingo |
| 3b | En un día cuyas extras RRHH **ya aprobó**, subir el número de horas. El estado sigue "aprobada" porque no cambió. | 10 h extra nocturnas = **$145.909** |
| 3c | Cambiar el estado de un día "por revisar" (salida olvidada, fuera de la geocerca, turno de más de 16 h) a "completado". Se aprueba a sí mismo. | Lo que tenga ese día |
| 3d | Borrar su propia "Ausencia injustificada". | Evita el descuento de 2 días = **$116.727** |
| 3e | Poner en 0 las horas del permiso que RRHH decidió descontar. La decisión queda escrita pero descuenta $0. | Lo que se iba a descontar |
| 3f | Crear o cambiar un día anterior al 21-oct-2026, donde las extras no pasan por aprobación. | 15 h extra nocturnas = **$218.863** |

También puede cambiar la hora de entrada o de salida, marcar "sin almuerzo" o "entrada temprana autorizada" y poner en
0 los minutos de tardanza.

**Dónde.** `firestore.rules`, bloque `match /registros/{fecha}`, funciones `horasDiaCoherentes` y
`extrasEstadoPermitidoColaborador`.

**Corrección propuesta** (de menor a mayor esfuerzo):

1. Que el colaborador solo pueda escribir el registro de **hoy** (o el de ayer si quedó abierto), nunca fechas pasadas.
2. Que no pueda cambiar `estado` de "por revisar" a "completado", ni tocar `tipo_permiso`, `horas_permiso_turno` de un
   día con decisión de RRHH, ni `entrada_temprana_autorizada`.
3. Que si cambian las horas extra de un día aprobado, el estado tenga que volver a "por aprobar".
4. Que las horas ordinarias de domingo o festivo también pasen por aprobación (ver pregunta 6).
5. A fondo: mover el cálculo a un servidor (Cloud Function). Es la única forma de que el número guardado sea siempre
   el que sale de las marcas.

Mientras tanto, la revisión de RRHH antes de pagar es la única barrera: comparar entrada y salida contra las horas.

**Prueba.** Leído en las reglas, sin ejecutar: `tests/auditoria-demuestra-reglas.mjs`, casos 3a a 3f.

---

### Hallazgo 4 — El colaborador escribe su propio sueldo, y Admin calcula con ese número · MEDIO

**Qué pasa.** En Mi Tarjeta cada persona puede cambiar su sueldo base (o su tarifa por hora si es contratista). Se
guarda en el mismo campo que usa el panel de Admin para el "Costo de mano de obra", el reporte mensual y el valor en
pesos del descuento de un permiso. El único control es que el sueldo sea de al menos $1.000.000 (menos que el mínimo
de 2026).

**Ejemplo.** Una persona escribe $9.000.000. El costo de mano de obra del mes sube $7.249.095 solo por ella, y cada
hora extra suya aparece a $53.571 en vez de $10.422.

**Dónde.** Botón `btn-save-sueldo` en `index.html`; regla de `match /empleados/{cedula}` en `firestore.rules`.

**Corrección propuesta.** Que el sueldo y la tarifa los escriba solo Admin. Si se quiere que el colaborador pueda
"simular", guardarlo en otro campo que no use Admin.

**Prueba.** Leído en el código y en las reglas, sin ejecutar: caso 4 de `auditoria-demuestra-reglas.mjs`.

---

### Hallazgo 5 — Al contratista se le descuentan 16 horas por una falta · ALTO

**Qué pasa.** La regla de "ausencia injustificada: se pierde el día y el domingo" se aplica igual al contratista. Para
él, la app toma como "valor del día" su tarifa × 8 horas. Pero el contratista cobra por hora trabajada: el día que
faltó ya no lo cobra, porque no tiene horas. La app le resta además 2 días de lo que sí trabajó.

**Ejemplo.** Contratista a $10.000 la hora. Trabajó 33,5 horas en la semana y faltó un día.

| | Valor |
|---|---|
| Horas trabajadas | $335.000 |
| La app le resta | 2 días × 8 h = $160.000 |
| La app muestra | $175.000 |
| Debería mostrar | $335.000 |

**Dónde.** `calculateMonthlyAccumulated` en `index.html` (`valorDia = esContratista ? tarifaHora * 8 : base / 30`).

**Ley.** El art. 173 CST habla del descanso dominical **remunerado** del trabajador con contrato laboral. Un
contratista no tiene domingo pagado que perder.

**Corrección propuesta.** No aplicar el descuento del art. 173 a contratistas.

**Prueba.** Probado con números (el conteo de días) y leído en el código (la resta): hallazgo 5.

---

### Hallazgo 6 — El aviso de "semana incompleta" a RRHH nunca se envía · MEDIO

**Qué pasa.** Cada lunes, al marcar entrada, el celular del colaborador revisa la semana anterior y debería avisar por
correo a RRHH si hubo ausencia injustificada o faltaron horas con tardanza. Antes de enviar, lee una marca de "ya
avisado" para no repetir el correo. Las reglas solo dejan leer esa marca a Admin. La lectura falla, la función termina
ahí y el correo no sale. El error solo queda en la consola del navegador.

**Por qué importa.** La decisión 4 de INDIMON (la tardanza no se descuenta sola, RRHH decide) se apoya en ese aviso.

**Dónde.** `verificarCumplimientoSemanal` en `index.html`; `match /avisos_semana_incumplida/{id}` en `firestore.rules`.

**Corrección propuesta.** Crear la marca directamente y tratar "ya existe" como "ya avisado" (no requiere leer), o
generar el aviso desde `scripts/` con la cuenta de servicio.

**Prueba.** Leído en las reglas, sin ejecutar: caso 6. RRHH puede confirmarlo fácil: ¿ha llegado alguna vez un correo
"Revisar semana de…"?

---

### Hallazgo 7 — Alguien sin sesión puede tapar una ausencia con un permiso inventado · MEDIO

**Qué pasa.** Los permisos se crean y se firman por enlace, sin iniciar sesión. Las reglas exigen que el permiso tenga
las 4 firmas marcadas para quedar "aprobado", pero no pueden saber quién las marcó. Con las claves públicas de la app,
cualquiera puede crear un permiso a nombre de otra persona, marcar las 4 firmas y con él cambiar la etiqueta del
registro de ese día. Así una "Ausencia injustificada" se convierte en "Calamidad doméstica" y desaparece el descuento
de 2 días ($116.727). Con un permiso de "Vacaciones" inventado, la app le descuenta días de vacaciones a esa persona
la próxima vez que entre un Admin.

Las propias reglas ya dicen que este límite existe y que cerrarlo requiere un servidor.

**Dónde.** `match /permisos/{id}` y la tercera rama de `match /registros/{fecha}` en `firestore.rules`.

**Corrección propuesta.** Corta: que un permiso aprobado no pueda reemplazar una etiqueta de "Ausencia…" (eso solo
Admin). A fondo: validar las firmas en una Cloud Function.

**Prueba.** Leído en las reglas, sin ejecutar: caso 7.

---

### Hallazgo 8 — Con dos salidas a permiso el mismo día se descuenta de más · MEDIO

**Qué pasa.** Cuando RRHH decide "se descuenta", las horas salen de `horasDeSalidaPermiso`. Con una sola salida usa
las horas que calculó la jornada (sin la hora de almuerzo y solo dentro del horario). Con dos o más salidas usa el
tiempo total que la persona estuvo fuera, incluida la hora de almuerzo y lo que pase de la salida pactada.

**Ejemplo.** Martes, 07:30–17:00, sin marcar almuerzo. Sale 09:00–10:00 y otra vez 11:45–13:30 (que incluye su hora
de almuerzo). La jornada cuenta 1,75 h de permiso. El descuento usa 2,75 h: **$8.338 de más**.

**Dónde.** `horasDeSalidaPermiso` y `horasPermisoDescontadasMes` en `index.html`.

**Corrección propuesta.** Que `calcularJornadaDiaria` devuelva las horas de permiso de cada salida y se guarden en el
registro; el descuento usa esas.

**Prueba.** Probado con números: hallazgo 8.

---

### Hallazgo 9 — Recargo dominical retenido mientras las extras están por aprobar · BAJO

**Qué pasa.** Si las extras de un domingo no están aprobadas, la app resta todas las horas extra del total de horas
dominicales. Si el turno pasa de la medianoche y parte de las extras cae ya en lunes, resta de más.

**Ejemplo.** Domingo 22-nov de 14:00 a 02:00. Son 9 h ordinarias, todas en domingo, y 3 h extra (1 en domingo, 2 en
lunes). Mientras RRHH no aprueba, la app paga recargo dominical sobre 7 h en vez de 9: faltan **$15.008**. Al aprobar
queda bien.

**Dónde.** `extrasPagables` en `index.html`.

**Corrección propuesta.** Guardar por separado las horas dominicales de la parte ordinaria y de la parte extra.

**Prueba.** Probado con números: hallazgo 9.

---

### Hallazgo 10 — La meta semanal con festivo no usa la jornada de la obra · BAJO

**Qué pasa.** En una semana con festivo, la meta baja 8,5 h (8 h si es viernes), que es el horario general. Si la obra
tiene otra jornada, la meta queda mal. Y un festivo que cae en sábado pactado no baja la meta.

**Ejemplo.** Obra con lunes a viernes 07:00–15:30 (7,5 h) y sábado 07:00–11:30 (4,5 h): 42 h. Con festivo el lunes,
la app da meta de 33,5 h y debería dar 34,5 h. Afecta "Mi semana", el aviso de semana incompleta y cuántas horas de
un domingo trabajado son ordinarias.

**Dónde.** `metaSemanalOrdinaria` en `index.html`.

**Corrección propuesta.** Calcular la meta con la jornada de la obra del colaborador.

**Prueba.** Probado con números: hallazgo 10.

---

### Hallazgo 11 — Cuando Admin edita un día, tres cosas quedan sin actualizar · MEDIO

**Qué pasa.** "Editar registro" recalcula las horas de ese día, pero:

1. **Las extras siguen "aprobadas".** Si el día tenía 1 h extra aprobada y la edición la convierte en 4 h, las 4 se
   pagan sin nueva aprobación. "Recalcular semana" sí las devuelve a "por aprobar"; "Editar" no.
2. **No recalcula la semana.** La carga manual y el cierre del colaborador sí lo hacen. Si cambian las horas de un
   martes, el reparto del domingo de esa semana queda con el número viejo hasta que alguien recalcule.
3. **No respeta la etiqueta de ausencia.** Si el día está marcado "Ausencia…", la edición le calcula horas; el
   siguiente recálculo se las vuelve a poner en cero.

**Ejemplo (punto 1).** 3 h extra diurnas de más sin aprobar = $31.266.

**Dónde.** Botón `btn-editar-registro-guardar` en `index.html`.

**Corrección propuesta.** Al guardar la edición: si cambian las extras de un día aprobado, volver a "por aprobar";
llamar a `recalcularSemana`; y avisar si el día tiene etiqueta de ausencia.

**Prueba.** Leído en el código.

---

### Hallazgo 12 — El Excel trae las extras sin aprobar mezcladas con las aprobadas · MEDIO

**Qué pasa.** Mi Tarjeta y el costo de mano de obra solo cuentan las extras aprobadas. El Excel trae todas las horas
extra del día en las mismas columnas, con el estado en una columna al final ("POR APROBAR", "NO AUTORIZADA"). Lo mismo
con los días "por revisar": salen con sus horas calculadas. Quien sume las columnas paga extras que RRHH no aprobó.

Además el Excel no tiene:

- Una columna con las horas ordinarias trabajadas en domingo o festivo, que desde el 3-nov se pagan aparte al 100 %
  (decisión 7). Solo trae "horas dominicales" (ordinarias + extras juntas).
- El descuento por permisos en pesos ni en horas por salida (solo el total del día y la decisión).

**Ejemplo.** Un mes con 10 h extra diurnas "no autorizadas": sumando la columna se pagan $104.221 que la app no cuenta.

**Dónde.** `construirFilasDetalleHoras` y `descargarExcelConsolidado` en `index.html`.

**Corrección propuesta.** Agregar columnas "extras a pagar" (solo aprobadas), "ordinarias en domingo/festivo" y
"horas de permiso a descontar". Dejar las horas de los días "por revisar" en una columna aparte.

**Prueba.** Leído en el código.

---

### Hallazgo 13 — No hay festivos cargados desde 2029 · BAJO

**Qué pasa.** La lista de festivos del código llega hasta el 25-dic-2028 (no hasta 2027, como dice el encargo). Las
fechas de 2026, 2027 y 2028 se compararon una por una contra el cálculo de la Ley Emiliani y coinciden las 54. Desde
el 1-ene-2029 un festivo se liquidaría como día normal.

**Ejemplo.** 8 h trabajadas el 1-ene-2029 dejarían de pagar $133.402.

**Dónde.** `FESTIVOS_COLOMBIA` en `index.html`.

**Corrección propuesta.** Calcular los festivos con la fórmula (Pascua + traslado al lunes) en vez de una lista, o
poner un aviso para Admin cuando falten menos de 6 meses para el final de la lista.

**Prueba.** Probado con números: hallazgo 13.

---

### Hallazgo 14 — El neto estimado no incluye el auxilio de transporte · MEDIO

**Qué pasa.** El neto es sueldo + extras − 8 % − descuentos. Quien gana hasta 2 salarios mínimos recibe además el
auxilio de transporte, que no lleva el 8 %. La app no lo suma ni lo menciona.

**Ejemplo.** Con el mínimo de 2026 ($1.750.905) el auxilio es de $249.095 al mes (confirmar la cifra del decreto). El
neto que ve el colaborador sale $249.095 por debajo de lo que recibirá. Y en una ausencia injustificada el auxilio
también se pierde por los días no trabajados, cosa que tampoco se refleja.

**Dónde.** `calculateMonthlyAccumulated` en `index.html`.

**Ley.** Ley 15 de 1959 y decreto anual del auxilio de transporte.

**Corrección propuesta.** Sumarlo cuando el sueldo sea de hasta 2 mínimos, proporcional a los días trabajados, o al
menos escribir en pantalla "no incluye auxilio de transporte".

**Prueba.** Leído en el código.

---

### Hallazgo 15 — La app no avisa cuando se pasan los límites de horas extra · MEDIO

**Qué pasa.** La ley permite máximo 2 horas extra al día y 12 a la semana. La app calcula y deja aprobar cualquier
cantidad, sin aviso para el colaborador ni para RRHH. Solo detiene los turnos de más de 16 horas.

**Ejemplo.** Lunes a viernes saliendo a las 20:00: 3 h extra diarias y 15 a la semana. Todo se aprueba con un clic.

**Dónde.** `renderExtras` y `decidirExtras` en `index.html`.

**Ley.** Art. 22 de la Ley 50 de 1990 (art. 167A CST). Pasarse expone a la empresa a sanción del Ministerio.

**Corrección propuesta.** En "Extras por aprobar", marcar en rojo los días con más de 2 h y las semanas con más de 12 h.

**Prueba.** Leído en el código.

---

### Hallazgo 16 — La app no avisa del descanso compensatorio por domingos habituales · MEDIO

**Qué pasa.** Quien trabaja 3 o más domingos en el mes tiene derecho, además del recargo, a un día de descanso
compensatorio remunerado. La app paga el recargo pero no cuenta los domingos ni avisa.

**Dónde.** No existe en `index.html`.

**Ley.** Arts. 179 (parágrafo 2), 180 y 181 CST.

**Corrección propuesta.** Contar los domingos y festivos trabajados por persona en el mes y avisar a RRHH al tercero.

**Prueba.** Leído en el código.

---

### Hallazgo 17 — Lo que la app no descuenta ni ajusta en el neto · BAJO

El neto estimado no baja en estos casos, aunque la nómina real sí:

- **Licencia no remunerada (art. 51 CST).** Existe como tipo de permiso, pero los días no se descuentan. Un día vale
  $58.364.
- **Incapacidad.** Se paga completa en el estimado. La ley paga 66,67 % desde el tercer día (sin bajar del mínimo).
- **Aportes.** El 8 % se calcula sobre el sueldo completo aunque haya días descontados, y no incluye el 1 % de
  solidaridad de quienes ganan 4 mínimos o más.

**Dónde.** `calculateMonthlyAccumulated` en `index.html`.

**Corrección propuesta.** Como el neto es informativo (decisión 12), basta con decirlo en pantalla. Si se quiere
exacto, descontar los días de licencia no remunerada.

**Prueba.** Leído en el código.

---

### Hallazgo 18 — Recalcular una semana vieja le aplica las reglas de hoy · BAJO

**Qué pasa.** "Recalcular semana" usa las constantes actuales para cualquier fecha: 42 horas, divisor 210, nocturno
desde las 19:00 y el horario que la obra tiene **hoy**. Solo el recargo dominical cambia según la fecha.

- Antes del 15-jul-2026 la jornada legal era de 44 horas y el divisor 220. Recalcular una semana de esa época
  convierte horas ordinarias en extras y paga cada hora 4,8 % más cara ($8.338 en vez de $7.959).
- Si a una obra se le cambia el horario, recalcular semanas anteriores cambia el pasado, y las extras ya aprobadas
  vuelven a "por aprobar".

Hoy el riesgo es bajo porque la app parece tener datos solo desde el segundo semestre de 2026.

**Dónde.** `LEY`, `calcularRecalculoSemana` y `calcularPagoExtras` en `index.html`.

**Ley.** Ley 2101 de 2021 (reducción gradual de la jornada); Ley 2466 de 2025 (nocturno desde las 19:00, vigente desde
el 25-dic-2025).

**Corrección propuesta.** No permitir recalcular semanas anteriores al 15-jul-2026, y guardar el horario de la obra
con fecha de inicio.

**Prueba.** Leído en el código.

---

### Hallazgo 19 — Varias listas de Admin solo miran los 500 registros más recientes · BAJO

**Qué pasa.** El panel de Admin carga los 500 registros más recientes de toda la empresa. De ahí salen el costo de mano
de obra en pantalla, "Extras por aprobar", "Por revisar" y "Permisos por decidir". Con 30 personas son unos 17 días.
Lo más viejo no aparece: unas extras por aprobar de hace un mes no salen en la lista y se quedan sin pagar, y el costo
de un mes completo queda incompleto sin aviso. El Excel no tiene este problema (lee todo, o avisa a los 2.000).

**Dónde.** `allRegsCache` (consulta con límite de 500) en `index.html`.

**Corrección propuesta.** Para esas cuatro vistas, consultar por estado o por mes en vez de "los últimos 500", o avisar
cuando se llegue al tope.

**Prueba.** Leído en el código. La gravedad depende del número de colaboradores.

---

## 3. Lo que está bien (no hay que tocarlo)

Se revisó y calcula correctamente:

- **Día normal con horario fijo.** Lunes a jueves 07:30–17:00 da 8,5 h; viernes 07:30–16:30 da 8 h. Las 52 pruebas
  existentes de `calcularJornadaDiaria` pasan, y también las demás del CI que no necesitan navegador.
- **Porcentajes.** Extra diurna 25 %, extra nocturna 75 %, recargo nocturno 35 %, valor hora = sueldo ÷ 210. Coinciden
  con la ley vigente desde el 15-jul-2026.
- **Recargo dominical por fecha.** 75 % hasta jun-2025, 80 % hasta jun-2026, 90 % hasta jun-2027 y 100 % desde
  jul-2027. Coincide con la Ley 2466. Cada día usa su propio porcentaje, así que un mes que cruza el cambio queda bien.
- **Domingo y festivo trabajado.** Horas ordinarias al 100 % + recargo; las extras llevan su recargo de extra más el
  dominical. Igual en Mi Tarjeta y en el costo de mano de obra.
- **Turnos que pasan la medianoche.** Sábado 20:00 a domingo 06:00 cuenta 6 h dominicales. Domingo a lunes cuenta
  solo las del domingo. Jueves a viernes festivo cuenta las del festivo. Las horas de madrugada (00:00–06:00) cuentan
  como nocturnas.
- **Nocturno desde las 19:00.** Correcto para toda fecha desde el 25-dic-2025.
- **Almuerzo.** Marcado: se descuenta lo real. Sin marcar: 1 h de lunes a viernes, gradual entre 5 y 6 horas de turno
  (trabajar más nunca paga menos). Un almuerzo de menos de 20 minutos o con horas incoherentes se ignora.
- **Salida a cita o permiso con una sola salida.** El tiempo fuera no se vuelve extra, no se paga como permiso la hora
  de almuerzo y "no vuelvo hoy" da lo que faltaba del horario. Ejemplo: cita 08:00–10:00 da 6,5 h trabajadas + 2 h de
  permiso = 8,5 h.
- **Ausencia injustificada en salario mensual.** Día + domingo, una sola vez por semana, cargado al mes en que cae el
  domingo. Las semanas que cruzan dos meses quedan bien.
- **Festivos 2026 a 2028.** Las 54 fechas coinciden con el cálculo propio.
- **Tope de 42 h de la jornada de cada obra.** Admin no puede guardar un horario que pase de 42 h.
- **Carga manual, salida olvidada, cierre del colaborador y recálculo de semana** usan la misma función y escriben los
  mismos campos, incluidos `horas_permiso_turno` y el estado de las extras. La excepción es "Editar" (hallazgo 11).
- **Redondeo.** Dos decimales por día. El error máximo es de medio centésimo de hora al día (unos $70): despreciable.
- **Turnos de más de 16 horas o abiertos varios días.** No se liquidan solos.
- **Reglas ya protegidas.** Un colaborador no puede leer ni escribir registros de otro, no puede marcar sus extras como
  aprobadas partiendo de "por aprobar" y no puede cambiar la decisión de RRHH sobre un permiso.

Nota: la carga manual reemplaza el registro completo del día (la app lo advierte). Se pierden las salidas a permiso y
la decisión de RRHH de ese día. No es un error, pero conviene saberlo.

---

## 4. Preguntas para RRHH o para un abogado laboral

1. **Llegar tarde y quedarse (decisión 1).** Quien entra a las 12:00 y sale a las 21:00 trabajó 8 horas, pero la app
   le da 4 ordinarias + 4 extra ($50.026 en extras) y no descuenta las 4,5 h de tardanza. ¿Es lo que se quiere? La ley
   no obliga a pagar como extra lo que no supera la jornada, pero pagar de más es legal.
2. **Tolerancia de 15 minutos a la salida (decisión 1).** Quien sale a las 17:14 todos los días trabaja 4,9 horas al
   mes que no se pagan ($51.068 como extra). La ley no contempla tolerancia: todo tiempo adicional es extra. Lo mismo
   con un almuerzo de 46 minutos: los 14 minutos de más quedan como "ordinarios" sin pago. ¿Se mantiene?
3. **Entrar antes sin autorización (decisión 3).** No se paga. Si el jefe lo vio y lo dejó trabajar, un juez puede
   considerarlo trabajo consentido. ¿Quién autoriza y cómo queda el rastro? Hoy solo Admin puede marcarlo al cargar el
   día a mano.
4. **Cita y luego quedarse (decisión 11).** Sale 2 horas a una cita y se queda 2 horas después de la salida pactada:
   esas 2 horas son extra ($20.844). Si RRHH decide "se repone", ¿las horas repuestas se pagan como extra o no? Hoy
   "se repone" no cambia ningún número: es solo una etiqueta.
5. **Sábado sin horario pactado.** Todo es extra y pasa por aprobación, aunque la persona no haya completado las 42
   horas esa semana. ¿Correcto?
6. **Domingo o festivo trabajado.** Las horas ordinarias de ese día se pagan (al 190 %) sin aprobación de RRHH; solo
   las extras la piden. ¿Debería aprobarse también el trabajo en domingo? Ver hallazgo 3a.
7. **Extras anteriores al 21-oct-2026 (decisión 6).** Se pagan sin aprobación para siempre, también si alguien carga
   o corrige hoy un día de esa época. ¿Se quiere cerrar esa puerta?
8. **Contratistas.** La app les lleva horario, tardanzas, geocerca, extras con recargo y ausencias "injustificadas".
   Todo eso son señales de subordinación. Un abogado debería revisar si este control crea riesgo de que se declare un
   contrato de trabajo (contrato realidad), y si a un contratista le corresponden recargos de ley.
9. **Ausencia injustificada: ¿quién la decide?** El descuento de 2 días es automático cuando Admin pone la etiqueta.
   El art. 173 exige que la falta no tenga justa causa. ¿Hay un paso para oír al trabajador antes de descontar?

---

## Anexo: qué se revisó y cómo

- Se leyó completo el cálculo en `index.html` (las funciones de la tabla del encargo) y todo `firestore.rules`.
- Se corrieron las pruebas existentes que no necesitan navegador ni Java: `test-jornada-diaria` (52 casos),
  `test-festivo-trabajado`, `test-extras-aprobacion`, `test-descuento-ausencias`, `test-descanso-inferido`,
  `test-excel-consolidado` y `test-permisos-clasificacion`. Todas pasan.
- Se probaron unos 45 casos adicionales con las funciones reales (madrugada, medianoche, festivos, permisos, almuerzo,
  tolerancias). Los que mostraron un problema quedaron en `tests/auditoria-demuestra-hallazgos.mjs`.
- **No se hizo:** correr la prueba de reglas en el emulador (falta Java), correr `test-humo` y `test-reglas-firestore`,
  ni probar con datos reales. Tampoco se revisaron los scripts de recordatorios y respaldo, que no calculan nómina.

Para repetir las pruebas nuevas:

```bash
node tests/auditoria-demuestra-hallazgos.mjs
```

```bash
npx firebase emulators:exec --only firestore --project demo-indimon "node tests/auditoria-demuestra-reglas.mjs"
```
