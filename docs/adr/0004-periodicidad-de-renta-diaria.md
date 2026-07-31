# ADR 0004: Periodicidad de renta DIARIA

- **Fecha:** 2026-07-29
- **Estado:** Aceptada

> Decisiones tomadas al aceptar (2026-07-29): (1) se añade `DIARIA` al enum
> `periodicidad_pago` existente, en lugar de sustituirlo por un modelo genérico
> `cada_n + unidad`; (2) su equivalente mensual es ×30, el mismo mes comercial
> que ya asumía `SEMANAL`; (3) las seis tablas y compuertas que indexaban por
> este enum se unifican en un solo módulo.

## Contexto

El requisito era que los contratos de arrendamiento se pudieran pactar **por
días, semanas, meses y años**, porque de la cadencia de pago cuelgan los
recordatorios al equipo de Arrendadores.

De esas cuatro granularidades, tres ya existían. El enum `periodicidad_pago`
(`db/schema.sql:44`, introducido por la migración `20260715_arr_m3_periodicidad`)
tenía ocho valores:

```
SEMANAL · CATORCENAL · QUINCENAL · MENSUAL · BIMESTRAL · TRIMESTRAL · SEMESTRAL · ANUAL
```

Semanas, meses y años estaban cubiertos. **Faltaba la granularidad de días.** El
caso real que no se podía capturar es el espectacular o la valla rentados por
campaña corta, donde el acuerdo con el propietario se pacta por día y no por mes.

El hallazgo relevante no fue el valor que faltaba, sino **en cuántos sitios había
que añadirlo**. El enum estaba replicado en seis lugares independientes, ninguno
de los cuales falla si se olvida:

| Copia | Archivo | Qué pasa si se olvida |
|---|---|---|
| Factor mensual (P&L) | `lib/server/arrendadores-repo.ts` | `?? 1` ⇒ cuenta como mensual |
| Factor mensual (P&L cliente) | `lib/data/derive.ts` | `?? 1` ⇒ cuenta como mensual |
| Factor mensual (consolidado) | `app/(shell)/arrendadores/page.tsx` | `?? 1` ⇒ cuenta como mensual |
| Factor mensual (propuestas) | `app/(shell)/propuestas/page.tsx` | `?? 1` ⇒ cuenta como mensual |
| Enum zod del alta | `lib/server/arrendadores-controller.ts` | 400 al guardar |
| Enum zod de propuestas | `lib/server/propuestas-controller.ts` | 400 al guardar |

Más tres tablas de etiquetas duplicadas (`ContratoWizard`, `SiteFicha`,
`InventarioTabla`), que degradan a mostrar el valor crudo.

Las cuatro primeras son el problema serio: **fallan en silencio**. Para `DIARIA`
el `?? 1` no es un redondeo, es un error de **30×** — una renta de 500/día se
reportaría como 500/mes en vez de 15 000/mes, y el margen de esa pantalla saldría
inflado exactamente igual que en el caso que el ADR 0001 vino a cerrar.

Restricción adicional encontrada en `generarCalendarioEnTx`
(`arrendadores-repo.ts`): el bucle que genera el calendario de pagos tenía un
`guard < 1200` que **dejaba de generar cuotas al alcanzarlo, sin avisar**. Con
cadencias en meses ese tope equivalía a un siglo y nunca se alcanzaba; con
`DIARIA` son 3.3 años, plazo perfectamente normal en un contrato de
arrendamiento. El contrato habría quedado con medio calendario y los pagos que
faltaban no aparecerían ni como pendientes ni como vencidos: renta que se deja
de reclamar sin que nadie se entere.

## Decisión

**Añadiremos `DIARIA` al enum `periodicidad_pago`** mediante
`alter type ... add value ... before 'SEMANAL'`, y **unificaremos las seis copias
en `apps/web/lib/renta-periodicidad.ts`**, un módulo sin `server-only` que
importan por igual el repositorio, los controladores, el motor de derivadas y la
UI (mismo patrón que `lib/finanzas-calculo.ts`).

Su equivalente mensual es **×30**. No es una aproximación nueva: es el mes
comercial de 30 días que el enum ya asumía desde M3 al fijar `SEMANAL` en ×30/7.
Usar 30.44 (la media real) sería más exacto en abstracto pero incoherente con el
resto de la tabla, y obligaría a mover el costo de renta ya reportado de todos
los contratos semanales.

El tope del calendario pasa de truncar en silencio a **fallar ruidosamente**
(`MAX_CUOTAS = 3700`, unos 10 años diarios) con un `AppError` que nombra la
periodicidad y apunta a la fecha de fin. Por encima de ese volumen lo más
probable es una fecha mal capturada, no un acuerdo real.

## Alternativas consideradas

### Modelo genérico `cada_n INT + unidad ENUM(DIA, SEMANA, MES, ANIO)`

Sustituir el enum de ocho valores por dos columnas. Es **literalmente** lo que
enunciaba el requisito —días, semanas, meses, años— y expresa cualquier cadencia,
incluidas las ocho actuales (`CATORCENAL` = 2 SEMANA, `TRIMESTRAL` = 3 MES) y
otras hoy imposibles (`2 ANIO`, `cada 10 días`). Conceptualmente es el modelo
correcto: las ocho etiquetas actuales son una enumeración cerrada de un espacio
que en realidad es abierto.

Se descarta **por ahora** porque el costo no lo paga el requisito que hay sobre
la mesa. Obliga a una migración con backfill de todos los contratos vivos, a
reescribir las seis copias más los `order by periodicidad` de los reportes, y a
rediseñar el selector del `ContratoWizard` (un desplegable pasa a ser un
número + una unidad, con su propia validación). Todo eso para atender un caso
—cadencias arbitrarias— que nadie ha pedido. Añadir un valor al enum resuelve el
requisito real hoy y **no cierra esta puerta**: si aparece la necesidad de
`cada 3 días`, este ADR se reemplaza y la unificación en un solo módulo que se
hace aquí es precisamente lo que abarata esa migración, porque el enum deja de
estar en seis sitios.

### No añadir nada y capturar la renta diaria como su equivalente mensual

Cero cambios de esquema. El usuario multiplica por 30 y captura `MENSUAL`.

Se descarta porque destruye información que el negocio necesita: el contrato deja
de decir lo que realmente se pactó, la conciliación contra la factura del
propietario deja de cuadrar, y sobre todo **los recordatorios pasan a ser
mensuales cuando el pago es diario**, que es justo lo contrario de lo que se
pedía. Además traslada al usuario una aritmética que el sistema ya sabe hacer, e
introduce un redondeo manual irreversible.

### Un campo de intervalo libre (`interval` de PostgreSQL)

`periodicidad interval` en vez de enum. Máxima expresividad y `+ interval` lo
avanzaría nativamente, sin el `avanzarPeriodo` de JS.

Se descarta porque un tipo abierto no se puede pintar en un desplegable ni
agrupar en un reporte sin volver a inventar una lista cerrada de opciones encima,
y porque admite valores sin sentido de negocio (`1 microsecond`, intervalos
negativos) que el enum rechaza de plano. La validación en capas que da el enum
—compuerta zod, tipo de columna— se perdería.

## Consecuencias

**Positivas**

- Se puede capturar el acuerdo tal como se pactó en contratos por día, que es el
  caso de campaña corta en espectacular y valla.
- El enum, sus factores, sus etiquetas, su avance de vencimientos y su compuerta
  de validación dejan de estar en seis archivos y pasan a uno. Añadir la próxima
  periodicidad es una línea, no una búsqueda.
- El calendario de pagos deja de truncarse en silencio. El modo de fallo pasa de
  «renta no reclamada que nadie ve» a «el alta se rechaza con un mensaje que dice
  qué revisar».
- La compuerta zod y el enum de la BD ya no pueden divergir: los controladores
  consumen la misma tupla `as const` que define el tipo.

**Negativas**

- `DIARIA` genera **muchas filas** en `pagos_renta`: un contrato diario de un año
  son 365 cuotas frente a 12. Con el tope en 3 700 el insert de un solo contrato
  llega a ~18 500 parámetros de bind (holgado frente al límite de 65 535 de
  PostgreSQL, pero ya no es un insert trivial). Si el uso de contratos diarios
  crece, `pagos_renta` será la tabla que primero pida paginación en la UI de
  Arrendadores.
- El mes comercial de 30 días se consolida como supuesto del módulo. Una renta
  diaria de 500 se reporta como 15 000/mes, no como 15 220 (500 × 30.44). Es
  coherente con `SEMANAL`, pero es una inexactitud deliberada que quien lea el
  P&L debe conocer.
- `alter type ... add value` es **irreversible en la práctica**: PostgreSQL no
  soporta quitar un valor de un enum.
- Queda deuda conocida sin pagar (ver «Pendiente»).
- Hacer que el tope falle en vez de truncar **obligó a volver transaccional
  `editarContrato`**, que no lo era: hacía el UPDATE suelto con `q()` y generaba
  el calendario después, en una transacción aparte. Con el tope silencioso eso
  solo producía un calendario a medias; con el tope ruidoso el contrato quedaba
  guardado y el usuario recibía un 400 pidiéndole revisar unas fechas que ya se
  habían escrito. Ahora la edición y su calendario comparten transacción, igual
  que en `iniciarRenovacion`. Es una corrección de atomicidad que el cambio de
  periodicidad no pedía, pero que su modo de fallo dejó al descubierto.

**Implicaciones de seguridad**

- **Superficie de ataque:** sin cambios. No se añaden endpoints, dependencias ni
  campos de entrada nuevos; cambia el dominio aceptado de un campo que ya existía.
- **Validación de entrada:** mejora. `periodicidad` llega del cliente y se valida
  en tres capas —`z.enum()` en el controlador, el tipo enum de la columna, y el
  `CHECK contrato_completo_ck` que la exige junto al importe y la vigencia—. Antes
  la primera capa era una copia manual que podía quedarse corta respecto a la
  tercera; ahora las tres derivan de la misma definición. Un valor no reconocido
  se rechaza con 400 antes de tocar la BD; no hay concatenación de este valor en
  SQL en ningún punto (todo va por parámetros `$n`).
- **Denegación de servicio:** el `MAX_CUOTAS` es también un límite de recurso. Sin
  él, `DIARIA` + una `fecha_fin` lejana (dato que el usuario controla) construiría
  un INSERT arbitrariamente grande en memoria dentro de una transacción abierta.
  El tope anterior lo evitaba truncando; el nuevo lo evita rechazando, que además
  no corrompe el calendario. El límite se aplica **antes** de acumular la fila, no
  después.
- **Secretos, autenticación, cifrado:** sin cambios. El módulo nuevo es aritmética
  pura, sin acceso a BD, red ni entorno, y no contiene secretos. El acceso a
  contratos sigue gobernado por el tenant y la RLS existentes.
- **Auditoría:** sin cambios; los contratos y pagos siguen registrándose por los
  mismos caminos.

## Pendiente (no se resuelve aquí)

`avanzarPeriodo` usa `Date.setMonth`, que **desborda en meses cortos**: del 31 de
enero + 1 mes salen el 3 de marzo, no el 28 de febrero, y a partir de ahí la
serie queda corrida. Es un defecto heredado, anterior a este ADR, que afecta solo
a contratos cuya fecha de inicio cae en día 29, 30 o 31 con cadencia en meses.
`lib/finanzas-calculo.ts` no lo tiene porque delega en el `interval` de PostgreSQL.

No se corrige aquí porque arreglarlo **mueve las fechas de vencimiento de
calendarios ya generados**, incluidos pagos ya conciliados contra facturas del
propietario: es un cambio con migración de datos propia y no un arreglo de paso.
Queda fijado por un test que documenta explícitamente el comportamiento actual
(`renta-periodicidad.test.ts`, «DEFECTO CONOCIDO») para que el día que se corrija
sea una decisión deliberada y no un efecto colateral.

## Cómo revertir

El código es reversible sin fricción: basta con quitar `DIARIA` de
`PERIODICIDAD_VALUES` y de las tablas del módulo; los contratos que la usaran
dejarían de validar en el alta y caerían al factor mensual por defecto.

**El esquema no.** PostgreSQL no permite eliminar un valor de un enum, así que
`DIARIA` queda en `periodicidad_pago` para siempre. Quitarlo de verdad exigiría
crear un tipo nuevo sin ese valor, migrar la columna con `using`, y decidir antes
qué hacer con los contratos que ya lo usen y con sus calendarios de pago ya
generados y parcialmente conciliados. En la práctica esto es una decisión de un
solo sentido, y por eso la alternativa `cada_n + unidad` se evaluó en serio antes
de descartarla: cambiar de opinión sobre el **modelo** es caro, mientras que
añadir un valor más al enum sigue siendo barato.
