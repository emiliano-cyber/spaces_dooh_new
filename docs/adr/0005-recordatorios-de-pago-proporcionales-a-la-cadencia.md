# ADR 0005: Recordatorios de pago proporcionales a la cadencia

- **Fecha:** 2026-07-29
- **Estado:** Aceptada

> Decisiones tomadas al aceptar (2026-07-29): (1) el margen de aviso deja de ser
> un valor fijo y pasa a depender de la periodicidad del contrato; (2) las
> alertas de renta vencida se agrupan por contrato, con conteo y total, en vez de
> emitir una por cuota; (3) el contrato ANUAL conserva exactamente el
> comportamiento anterior (aviso a 90 días, rojo a 15).

## Contexto

El ADR 0004 abre el enum de periodicidad a `DIARIA`. Las dos reglas de aviso de
renta que existían en `lib/data/derive.ts` estaban calibradas para cadencias
largas y dejan de funcionar con periodos cortos, cada una por un motivo distinto.

**Regla 1 — «Renta por vencer» avisaba con 90 días fijos.** El comentario del
código lo decía sin ambigüedad: *«se avisa con al menos 3 MESES (90 días) de
anticipación»*, con el nivel pasando a rojo a los 15 días. Es un umbral sensato
para una renta anual, donde el pago es un evento de tesorería que hay que
provisionar. Aplicado a una renta diaria significa avisar de un pago **tres meses
antes de que ocurra**; y como el filtro es `dias <= 90`, con cadencia diaria
**todas** las cuotas del trimestre entran a la vez en la ventana. Un aviso que
está siempre encendido no señala nada.

**Regla 2 — «Renta vencida» emitía una alerta por cada cuota impaga.** Con renta
mensual o anual eso son una o dos alertas por contrato moroso, que es
proporcionado. Con renta diaria, un contrato impago durante un mes produce **30
alertas rojas idénticas** salvo la fecha. El panel de alertas del dashboard es
una lista única compartida con incidencias, órdenes de trabajo, cobranza y
licencias (`TipoAlerta`), así que un solo contrato diario moroso desplaza fuera
de la vista todo lo demás. El fallo no es cosmético: la alerta de licencia
vencida que el ADR anterior consideró importante quedaría enterrada.

Restricción de diseño: cualquier cambio aquí toca contratos que ya existen en
producción. Los contratos anuales y mensuales son hoy la inmensa mayoría, y su
comportamiento actual es el que el equipo de Arrendadores ya tiene interiorizado.

## Decisión

**El margen de aviso será función de la periodicidad del contrato**, mediante la
tabla `DIAS_AVISO_PAGO` en `apps/web/lib/renta-periodicidad.ts`:

| Periodicidad | Avisa | Rojo |
|---|---|---|
| DIARIA | 1 día | 1 |
| SEMANAL | 2 | 1 |
| CATORCENAL | 4 | 1 |
| QUINCENAL | 5 | 1 |
| MENSUAL | 15 | 3 |
| BIMESTRAL | 20 | 4 |
| TRIMESTRAL | 30 | 5 |
| SEMESTRAL | 60 | 10 |
| ANUAL | **90** | **15** |

El margen es aproximadamente un tercio de la duración del periodo, acotado para
que no crezca sin límite. El umbral de rojo se deriva del margen manteniendo la
proporción que ya existía —15 de 90 es un sexto— con un mínimo de 1 día, para que
una cadencia diaria llegue a rojo alguna vez en lugar de quedarse en ámbar por
redondeo a cero.

`ANUAL` conserva 90/15 **por diseño, no por casualidad**: es la cadencia para la
que se eligió el umbral original y la que domina la cartera actual. Un test lo
fija explícitamente como protección contra regresión.

**Las alertas de renta vencida se agruparán por contrato**, en una sola entrada
que lleva el número de cuotas impagas, su importe total y la fecha de la más
antigua. La agrupación es por contrato y no por arrendador ni por predio: fundir
contratos distintos escondería a un propietario detrás de otro.

Un contrato sin periodicidad —el `INCOMPLETO` del ADR 0001— usa el margen
mensual, que es el `default` de la columna en la BD.

## Alternativas consideradas

### Dejar los recordatorios como estaban y tocar solo el enum

Es el menor trabajo posible y no arriesga ninguna regresión en los contratos
existentes.

Se descarta porque desactiva en la práctica la funcionalidad que motivó todo el
cambio. El requisito no era «que se pueda guardar la palabra DIARIA», era tener
recordatorios de pago que funcionen para esa cadencia. Con el umbral fijo, un
contrato diario produce un aviso permanentemente encendido y, en cuanto se
atrasa, satura el panel. Habríamos entregado el campo sin la capacidad.

### Margen configurable por contrato (columna `dias_aviso`)

Una columna nueva con default según la periodicidad, editable en el
`ContratoWizard`. Es más flexible: cubre al arrendador que exige aviso de 30 días
aunque el pago sea semanal, que es una cláusula contractual real.

Se descarta **para esta iteración** por dos razones. Primera, resuelve un caso que
todavía no se ha presentado y a cambio añade un campo más a un alta que el ADR
0002 ya deja deliberadamente ligera —cuantos más campos obligatorios, más
pantallas se dan de alta sin arrendador, que es el agujero que aquel ADR cerró—.
Segunda, y más importante: **la tabla por periodicidad hace falta igualmente**,
porque es el default de esa columna. Implementarla primero no es trabajo tirado,
es el prerrequisito. Si aparece la necesidad, añadir `dias_aviso` encima es una
migración aditiva con `coalesce(dias_aviso, DIAS_AVISO_PAGO[periodicidad])`, sin
tocar nada de lo que se hace aquí.

### Calcular el margen aritméticamente desde el factor mensual

En vez de una tabla escrita a mano, derivar el margen de la duración del periodo
(por ejemplo, `duracionDias / 3`).

Se descarta porque produce números que ningún humano eligió: `CATORCENAL` daría
4.67 días y `SEMESTRAL` 60.9, y habría que redondearlos igualmente. Una tabla
explícita de nueve filas es más corta que la fórmula más su redondeo, se lee de un
vistazo, y permite ajustar una cadencia concreta si el negocio lo pide sin
rediseñar la fórmula. El test de monotonía protege lo único que la fórmula
garantizaba gratis: que ninguna cadencia avise con más antelación que otra menos
frecuente.

### Agrupar las alertas vencidas por arrendador en vez de por contrato

Menos entradas todavía en el panel.

Se descarta porque un arrendador puede tener varios predios y varios contratos, y
la acción de cobranza es por contrato. Agrupar por arrendador obligaría a abrir la
ficha para saber cuál de sus contratos está moroso, y escondería un contrato
gravemente atrasado detrás de otro al día del mismo propietario.

## Consecuencias

**Positivas**

- El aviso vuelve a ser informativo en toda cadencia: se enciende cuando queda
  tiempo de gestionar el pago y no antes.
- Un contrato moroso ocupa una entrada en el panel en vez de N. Las alertas de
  incidencias, OT y licencias dejan de quedar sepultadas por un solo contrato de
  cadencia corta.
- La alerta agrupada informa **mejor** que las individuales: «4 cuotas sin
  liquidar desde el 12/07 ($4 000)» dice de un vistazo la magnitud del atraso, que
  antes había que reconstruir contando alertas.
- El comportamiento de los contratos anuales y mensuales —la cartera actual— no
  cambia.

**Negativas**

- Se pierde el detalle por cuota en el panel: ya no se puede ver de un golpe qué
  periodos concretos se deben sin entrar a Arrendadores. Se mitiga incluyendo la
  fecha del más antiguo y el conteo, pero es información que antes estaba en el
  dashboard y ahora exige un clic.
- Los IDs de alerta de renta vencida cambian de `al-pago-<idPago>` a
  `al-pago-<idContrato>`. Nada persiste estos IDs hoy, pero si en el futuro se
  guardan descartes o «marcar como visto», la migración tendrá que contemplarlo.
- La tabla de márgenes es un juicio de negocio codificado, no un cálculo. Los
  nueve valores tendrán que revisarse con el equipo de Arrendadores cuando haya
  uso real de las cadencias cortas; los de periodos largos vienen del umbral ya
  probado, los de periodos cortos son una primera estimación.
- Un contrato con muchísimas cuotas vencidas se recorre entero en cada render para
  agrupar. Es O(n) sobre `pagosRenta`, igual que antes, pero ahora con un `Map`
  intermedio.

**Implicaciones de seguridad**

- **Superficie de ataque:** ninguna. El cambio es puramente de presentación, en
  funciones puras sin acceso a BD, red ni entorno. No se añaden endpoints,
  entradas ni dependencias.
- **Exposición de datos:** sin cambio de alcance. Las alertas se derivan del
  `DemoState` que el usuario ya recibe, filtrado por tenant aguas arriba; agrupar
  no incorpora ningún campo que no estuviera ya en ese estado. El texto de la
  alerta agregada muestra un total que antes aparecía repartido en varias
  entradas, visible para el mismo conjunto de usuarios.
- **Autorización:** sin cambios. Quien puede ver el dashboard ya podía ver estas
  alertas; no se introduce ninguna ruta nueva a datos de contratos.
- **Disponibilidad / legibilidad como control:** hay un beneficio real y no
  cosmético. Un panel de alertas saturado es un control de detección degradado: la
  alerta de licencia o permiso vencido del ADR anterior existe para que alguien
  reaccione, y queda inutilizada si un contrato diario moroso genera decenas de
  entradas que la desplazan. Acotar el ruido preserva esa señal.
- **Auditoría:** sin cambios. Las alertas son derivadas y no se persisten; el
  registro de pagos y contratos sigue igual.

## Cómo revertir

Totalmente reversible, y sin migración de datos: no se añadió ni se modificó
ninguna columna, tabla ni enum. Volver atrás es restaurar el bucle por cuota y
sustituir `diasAvisoPago(periodicidad)` / `diasCriticoPago(periodicidad)` por las
constantes 90 y 15 en `construirAlertas`. Los tests de
`derive.recordatorios-renta.test.ts` fallarían señalando exactamente qué se
revirtió, que es el comportamiento deseado.

La única precaución a seis meses vista es la señalada en las consecuencias
negativas: si para entonces algo persiste los IDs de alerta, revertir los volvería
a cambiar.
