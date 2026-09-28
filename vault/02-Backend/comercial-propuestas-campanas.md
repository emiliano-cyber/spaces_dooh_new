---
tipo: modulo
estado: verificado
actualizado: 2026-09-28
tags: [backend, comercial, propuestas, campanas, amarillo]
archivos:
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/propuestas-controller.ts
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/server/campanas-controller.ts
  - apps/web/lib/server/creativos-repo.ts
  - apps/web/lib/server/reservas-controller.ts
  - apps/web/lib/reparto-creativos.ts
  - apps/web/lib/periodos.ts
  - apps/web/lib/data/types.ts
  - apps/web/app/(app)/(shell)/propuestas/[id]/page.tsx
  - apps/web/app/(app)/(shell)/campanas/[id]/page.tsx
---

# Comercial: propuestas, reservas y campañas

## El recorrido

```
Cliente → Propuesta (folio, ítems, comisión) → aprobada
       → Campaña (folio) → Reservas (sitio × fechas) → Creativos → publicación
```

## Archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `campanas-repo.ts` | 1214 | Clientes, campañas, reservas, confirmar/extender |
| `propuestas-repo.ts` | 593 | Propuestas, ítems, liga pública, aceptación |
| `creativos-repo.ts` | 287 | Alta, validación y asignación de creativos |
| `propuestas-controller.ts` | 121 | Validación zod |
| `campanas-controller.ts` | 84 | Validación zod |
| `lib/reparto-creativos.ts` | — | Reparto puro (con tests) |

## El método del divisor

El precio **neto** sale de dividir el **bruto** entre `(1 − comisión)`
(`divisorDeComision`, `lib/data/derive.ts`). La **comisión de agencia** y el
**descuento comercial** son cosas distintas y viven en columnas distintas
(`propuestas.comision_pct` vs `propuestas.descuento_pct`). Confundirlos cambia
lo que se le cobra al cliente.

## Reglas codificadas

| Regla | Dónde |
|---|---|
| **No reservar con contrato incompleto** (ADR 0003) | `campanas-repo.ts` → `exigirContratoCompleto()` |
| **Propuesta inmutable** una vez enviada | `PropuestaError` → 409 (`propuestas-repo.ts:9`) |
| **Gate de negociación**: agencia con negociación sin validar bloquea crear/aprobar | `agenciaBloqueada()` (`propuestas-repo.ts:12-16`) |
| **Cupo de clientes por pantalla** (ADR 0008) | `campanas-repo.cupo-clientes.test.ts` |
| **Generar campaña es idempotente** (hallazgo A5) | `flujo-critico.e2e.test.ts` |
| **No enviar a dominio sin creativo** (hallazgo M14) | `campanas-repo.ts` |
| Reserva `TENTATIVA` caduca sola por TTL | `reservas.expira_en` (`20260706_reserva_ttl.sql`) |

### El cupo global se lee con filtro de organización

`cupoGlobalClientes()` (`campanas-repo.ts:295-313`) lee
`config_negocio.max_clientes_pantalla` **filtrando por `tenant_id`** contra
`current_setting('app.tenant_id', true)`, no solo apoyándose en la RLS.

Hasta el 13/08 la consulta era un `select ... limit 1` **sin `where`**: hoy la
salvaba el único llamador (`reservar()`, `:427`), que corre dentro de una
transacción con el tenant ya fijado. Es la segunda capa que el resto del repo sí
aplica, y aquí faltaba — un `limit 1` sin `where` devuelve la fila de
**cualquier** organización en cuanto alguien llame a la función desde otra
transacción, y ese fallo no da error: contesta en silencio ([[multi-tenancy-y-rls]], R2).

Sin GUC la consulta devuelve `null` = «sin límite», que es como nace la
instalación según el ADR 0008. La firma no cambió: las tres unitarias que la
llaman con un cliente falso siguen intactas.

## La liga pública de la propuesta

`propuestas.token_publico` habilita `/p/[id]` sin sesión. El cliente puede
**aceptar** desde ahí, y eso se registra como medio-contrato:
`aceptado_en`, `aceptado_por`, `aceptado_ip` (`db/schema.sql:358-360`).

El tenant de esas peticiones lo resuelve Postgres con
`propuesta_tenant_por_token()`, nunca el cliente. Ver [[multi-tenancy-y-rls]].

## Creativos

Un creativo puede ser **imagen** o **código HTML** (`creatividades.codigo`).

> [!warning] Tres formas de guardar lo mismo conviven en los datos reales
> La UI decidía si un creativo era código o imagen **mirando el principio del
> archivo**. Al dejar de mandar el arte en el payload, eso dejó de funcionar y
> aparecieron tres representaciones distintas; ocho creativos se habrían dejado
> de ver. Ahora la decisión se toma por el **tipo declarado**
> (`docs/Registro_Cambios.md`, entrada del 06/08). `lib/creativo-html.ts` tiene
> las dos mitades de la convención — `imagenAHtml()` y `imagenDeHtml()` — juntas
> a propósito.

El **reparto** a todas las pantallas está en `lib/reparto-creativos.ts` (puro,
con tests) y se invoca desde `POST /api/campanas/[id]/creativos/repartir`.

## Qué se vendió, no solo cuánto — `unidad`, `cantidad` y `spots_por_dia`

`propuesta_items` y `reservas` guardan CÓMO se contrató desde
`20260721_propuesta_unidad_spots.sql`: `unidad` (mensual · catorcenal · semanal ·
diaria · spot · hora), `cantidad`, `tarifa_unitaria` y `spots_por_dia`.

Se pueden vender **50 spots** —en Propuestas eliges «Por spot», tecleas 50 y el
precio sale `tarifa_spot × 50`, recalculado en el servidor— y hasta el
**2026-09-28** ese 50 **moría en la base**: el detalle de la propuesta enseñaba
sitio, renta y precio, `rowToReserva` no exponía los cuatro campos y la ficha de
campaña pintaba `{precio}/mes` para TODA reserva, incluidas las vendidas por
spot. Un importe sin su unidad no dice nada: «$60,000» puede ser un mes o
cincuenta spots.

> [!danger] `cantidad` y `spots_por_dia` son DOS NÚMEROS DISTINTOS
> - **`cantidad`** → cuántas unidades se contratan. Es lo que MULTIPLICA la
>   tarifa. Es **precio**.
> - **`spots_por_dia`** → cuántas veces al día se muestra la pieza. Es
>   **programación**, y no entra en ningún precio.
>
> Confundirlos fue **DATA-02** (auditoría del 26/08): se escribía el mismo valor
> en las dos columnas, así que una propuesta mensual normal dejaba
> `spots_reservados` en `null` y `reparto-creativos.ts:51-68` leía ese null como
> «es una lona» — una pantalla digital repartida como si fuera impresa. El
> arreglo de la ESCRITURA vive en `campanas-repo.ts` (inserción desde propuesta);
> el de la LECTURA es de hoy.

Y hay un **tercero** que se confunde con los dos: **`spots_reservados`** son los
SLOTS que la reserva retiene, que tampoco es ninguno de los otros.

### Cómo se etiquetan, y por qué con vocabularios distintos

Los textos los arma `lib/periodos.ts`, que es puro y **sí se prueba** — sin jsdom,
una decisión escrita dentro de un `.tsx` no la ve nadie:

| Función | Da | Dónde |
|---|---|---|
| `etiquetaCantidad(unidad, cantidad)` | `50 spots` · `1 mes` | el QUÉ, sin precio |
| `resumenContratacion({unidad, cantidad, tarifaUnitaria})` | `50 spots × $ 1,200.00` | detalle de propuesta |
| `resumenReserva({unidad, cantidad, precio})` | `50 spots · $ 54,000.00` | ficha de campaña |
| `etiquetaFrecuencia(spotsPorDia)` | `12 pases al día`, o `null` | debajo, en las dos |

**«Pases al día» y no «spots»**, deliberadamente: es lo único que impide que
«50 spots» y «12 spots» convivan en la misma ficha significando cosas distintas.

> [!warning] En la CAMPAÑA la multiplicación ya no cuadra, y por eso hay dos funciones
> En `propuesta_items` el precio **es** `tarifa_unitaria × cantidad`
> (`periodos.ts` → `precioItem`), así que escribir la multiplicación cuadra con
> el importe de al lado.
>
> En `reservas` **no**: la reserva nacida de una propuesta guarda el **neto**
> —`lista × (1−descuento) × (1−comisión)`— mientras `tarifa_unitaria` se copió
> tal cual de la propuesta, que es la de **lista**. Un «50 spots × $ 1,200.00»
> junto a «$ 54,000.00» enseñaría una cuenta que no da, y se leería como un
> defecto del sistema cuando es el descuento haciendo su trabajo. `resumenReserva`
> pone un `·` y no un `×`, y hay una prueba que lo vigila.

**Sin capturar no se pinta**: `tarifaUnitaria` en 0 y `spotsPorDia` en `null` o 0
se omiten. Un «× $ 0.00» afirma que la unidad es gratis; un «0 pases al día»
afirma que la pieza no sale nunca. Y `spots_por_dia` está en NULL en toda la
producción de hoy.

**Fuera de alcance:** los conceptos en la factura. Sigue siendo **un importe
único sin desglose**; darle conceptos es tabla nueva, migración y dinero.

## Portal del cliente

`campanas.portal_token` + `portal_activo` habilitan `/portal/[token]`.
`portal-repo.ts:10-12`: devuelve **solo** lo de esa campaña — nada de otros
clientes ni datos financieros.

## Relacionadas
[[flujo-propuesta-a-campana]] · [[finanzas-y-cobranza]] · [[operaciones-y-ot]] ·
[[inventario-y-sitios]] · [[paginas-publicas]] · [[esquema]] · [[MOC-Proyecto]] ·
[[tarifa-publicada-vs-neta]]
