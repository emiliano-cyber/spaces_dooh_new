# ADR 0003: No se puede reservar una pantalla con el contrato incompleto

- **Fecha:** 2026-07-29
- **Estado:** Aceptada

> Decisiones tomadas al aceptar (2026-07-29): (1) el bloqueo aplica a los **dos**
> caminos que crean reservas —reserva directa y generación de campaña desde
> propuesta—; (2) "completo" = cualquier estatus salvo `INCOMPLETO` y `CANCELADO`,
> de modo que `VENCIDO` **sí** deja vender; (3) en la generación de campaña el
> guard corre **después** del bloque del ADR 0001, para no bloquear el caso que
> ese ADR resuelve solo.

## Contexto

El ADR 0002 hizo que toda pantalla nazca con arrendador y con un contrato
`INCOMPLETO`. Eso cerró el hueco del **dato** —ya consta de quién es el espacio—
pero no el del **derecho**: una pantalla con contrato incompleto se podía
reservar y vender igual, que es exactamente el problema que el ADR 0001 describe
como "vender y facturar una pantalla sobre la que no existe constancia de qué se
le paga a su propietario".

Hay dos caminos que crean filas en `reservas`:

| Camino | Función | Origen |
|---|---|---|
| Reserva directa | `reservar()` (`campanas-repo.ts`) | módulo Comercial |
| Generación de campaña | `generarCampanaDesdePropuesta()` | propuesta aprobada |

Guardar solo el primero sería inútil: bastaría con levantar una propuesta para
rodear la regla.

**Consecuencia que conviene tener presente:** como el ADR 0002 hace que toda
pantalla nazca `INCOMPLETO`, este ADR convierte "completar el contrato" en un
paso **obligatorio** entre cargar inventario y venderlo. No es un efecto lateral,
es la intención; pero cambia el flujo de trabajo del equipo comercial, que antes
podía vender inventario recién cargado.

## Decisión

Antes de crear una reserva se exige que la pantalla esté cubierta por un contrato
**completo**. Si no lo está, la operación se rechaza con `409` y un mensaje que
nombra la pantalla y dice dónde arreglarlo.

"Completo" se define por exclusión: cualquier estatus **salvo**

- `INCOMPLETO` — le faltan arrendador, importe, vigencia o periodicidad. Es un
  pendiente de captura, no un acuerdo.
- `CANCELADO` — hubo acuerdo y se rompió. No acredita nada.

`VENCIDO` **sí** deja vender. Está completo —tiene los cuatro datos que exige
`contrato_completo_ck`— y solo está caducado. El hueco de fechas ya lo denuncia la
alerta «El contrato no cubre la campaña» del ADR 0001, que es una regla de
cobertura temporal distinta de la que aquí se pide. Bloquear también por fecha
sería una decisión aparte y merece su propio ADR.

La cobertura se busca en los **dos anclajes** que usa el resto del módulo: el
contrato propio de la pantalla suelta (`predio_id is null and sitio_id = X`) o el
del predio que la cubre junto con sus hermanas. Mirar solo `sitio_id` bloquearía
las pantallas de un predio correctamente contratado.

En `generarCampanaDesdePropuesta` el guard corre **después** del bloque del
ADR 0001 que abre el contrato. El orden es deliberado: si la propuesta capturó la
renta (arrendador + importe + periodicidad), ese bloque acaba de crear un contrato
`VIGENTE` y la venta debe pasar. Comprobarlo antes bloquearía justo el caso que el
sistema resuelve por sí solo.

En `reservar()` el guard corre **antes** de las validaciones de disponibilidad.
Decirle al comercial "no hay slots" cuando el problema real es que falta el
contrato lo manda a buscar al sitio equivocado.

## Alternativas consideradas

**A. Bloquear también con contrato `VENCIDO`.** Más estricto y evita comprometer
un espacio sobre el que ya se perdieron derechos —el "caso grave" del ADR 0001—.
Se descarta *en este ADR* porque mezcla dos reglas: la de completitud del dato
(lo que se pidió) y la de cobertura temporal (que ya tiene su alerta). Un contrato
vencido con renovación en trámite es un caso operativo normal, y bloquearlo
pararía ventas por un trámite administrativo. Queda anotado como candidato.

**B. Marcar la pantalla como `BLOQUEADO` en `estatus_comercial` en vez de validar
al reservar.** Reutiliza un campo existente y hace el impedimento visible en el
inventario sin consultar contratos. Se descarta como mecanismo principal porque
`estatus_comercial` es estado operativo que ya cambia solo (DISPONIBLE →
RESERVADO → OCUPADO), y meterle un significado contractual lo hace ambiguo:
al liberarse una reserva, el barrido lo devolvería a DISPONIBLE y levantaría el
bloqueo sin que nadie completara nada. La verdad vive en la tabla de contratos y
debe consultarse ahí.

**C. Solo advertir, no bloquear.** Es lo que el ADR 0001 eligió para su caso. Se
descarta porque el pedido explícito es que no deje reservar, y porque con el ADR
0002 ya no hay excusa de dato: la pantalla tiene arrendador desde el alta, así que
completar el contrato es una captura, no una investigación.

## Consecuencias

**Positivas**

- Deja de ser posible vender un espacio sin constancia de qué cuesta. El margen
  inflado por costo de renta cero desaparece por construcción, no por auditoría.
- El bloqueo es atómico: un lote con una sola pantalla incompleta no se reserva a
  medias.
- El mensaje es accionable —nombra la pantalla y el módulo— en vez de un fallo
  genérico.

**Negativas**

- **Completar el contrato pasa a ser un paso obligatorio del flujo comercial.**
  Entre cargar inventario y venderlo hay ahora una captura administrativa. Si el
  área que completa contratos no va al ritmo del área que vende, esto se convierte
  en un cuello de botella real.
- Una propuesta ya **aprobada** puede fallar al generar la campaña. El comercial
  descubre el impedimento tarde, cuando el cliente ya aceptó.
- El ADR 0001 queda parcialmente desactivado en la práctica: su contrato
  `INCOMPLETO` "no bloqueante" ahora sí bloquea, aguas abajo. Su lógica sigue
  siendo útil para el caso `rentaCompleta`, que crea un contrato VIGENTE y pasa.
- Las pantallas heredadas sin contrato dejan de ser vendibles de golpe. En una
  base con datos previos esto puede inmovilizar inventario hasta que se complete
  la carga retroactiva, que sigue pendiente desde el ADR 0001.

**Implicaciones de seguridad**

- *Superficie de ataque:* ninguna nueva. Es un guard dentro de transacciones ya
  autenticadas y sujetas a `comercial.crear`.
- *Autorización:* no cambia quién puede reservar; añade una condición de negocio.
- *Aislamiento por tenant:* la consulta filtra por `tenant_id` en las dos tablas y
  corre con `app.tenant_id` fijado, así que un contrato de otra organización no
  puede acreditar una pantalla propia.
- *Fuga de información:* el mensaje de error incluye el nombre de la pantalla, que
  el usuario ya tuvo que conocer para intentar reservarla. No expone datos del
  contrato ni del arrendador.

## Cómo revertir

Quitar las dos llamadas a `exigirContratoCompleto()` en `campanas-repo.ts`. No hay
migración ni datos que deshacer: el guard solo lee.

Si hace falta una válvula de escape sin revertir del todo, la vía natural es
permitir la venta con contrato `INCOMPLETO` cuando el usuario tenga un permiso
específico, en vez de relajar la regla para todos.
