---
tipo: modulo
estado: verificado
actualizado: 2026-09-28
tags: [backend, comercial, propuestas, campanas, amarillo]
archivos:
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/propuestas-controller.ts
  - apps/web/lib/descuento.ts
  - apps/web/lib/server/config-repo.ts
  - apps/web/app/api/propuestas/[id]/route.ts
  - db/migrations/20260928_tope_descuento_propuestas.sql
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/server/campanas-controller.ts
  - apps/web/lib/server/creativos-repo.ts
  - apps/web/lib/server/reservas-controller.ts
  - apps/web/lib/reparto-creativos.ts
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
| `campanas-repo.ts` | 1265 | Clientes, campañas, reservas, confirmar/extender |
| `propuestas-repo.ts` | 638 | Propuestas, ítems, liga pública, aceptación |
| `lib/descuento.ts` | 157 | Descuento válido **y bajo el tope**, y el texto de bitácora (puro, con tests) |
| `creativos-repo.ts` | 366 | Alta, validación y asignación de creativos |
| `propuestas-controller.ts` | 121 | Validación zod |
| `campanas-controller.ts` | 92 | Validación zod |
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
| **Tope de descuento por organización** (TOPE-01) | `descuentoDentroDelTope()` (`lib/descuento.ts`) |
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

### El descuento tiene un techo, y es de cada organización (TOPE-01)

Hasta el **2026-09-28** el único límite del descuento era
`Math.max(0, Math.min(100, n))` en `lib/descuento.ts`. Consecuencias medidas ese
día, y las tres a la vez:

- **el 90 % pasaba liso** — el único freno era el 100 % *exacto*, y ése no mira
  el porcentaje: es `PropuestaCeroError`, que mira el **total**;
- lo podía hacer **cualquier rol COMERCIAL** (`app/api/propuestas/[id]/route.ts`
  pide `exigir('comercial','crear')`);
- **sin contraseña**: propuestas no está entre las rutas con
  `exigirCambioSensible`. Cambiar la renta de una pantalla sí la pedía; regalar
  el 80 % de una venta, no.

Ahora `config_negocio.tope_descuento_pct` —una fila por tenant, ADR 0011— guarda
el techo, y `actualizarPropuesta()` lo aplica con
`descuentoDentroDelTope(valor, await topeDescuentoDelTenant())`.

**Tres decisiones que conviene no deshacer sin leer esto:**

1. **El valor por omisión es 100**, o sea «sin tope». Es el comportamiento
   exacto de antes, así que la migración no invalida ni una propuesta viva.
   Mismo criterio que el cupo de clientes del ADR 0008: la regla **nace
   apagada**. Sembrar un 20 o un 30 «prudente» habría convertido de golpe en
   inválidas las propuestas que ya lo superan, y ésa es una decisión de cada
   dueño.
2. **La validación es para lo que se ESCRIBE, no para lo ya escrito.** Bajar el
   tope al 10 deja intactas las propuestas al 40 y se pueden seguir editando;
   lo que ya no se puede es volver a teclear ese 40. Es la misma regla que
   CFG-01 con un plazo de cobranza retirado.
3. **Recortar y rechazar son verbos distintos.** `descuentoValido` recorta
   (250 → 100) y el tope **rechaza**: guardar en silencio un 40 % cuando se
   pidió un 70 % dejaría en la base un número que nadie tecleó, sobre dinero y
   con 200 OK.

**El tope se lee CON contexto de tenant** — `topeDescuentoDelTenant()`
(`config-repo.ts`) va por `obtenerConfigRow()` para heredar su
`where tenant_id = $1`, igual que `plazosCobranzaDelTenant()` y
`costosOtDelTenant()`. Un `qRaw` aquí haría que el techo de una empresa lo
decidiera la configuración de otra, **sin dar ningún error** ([[multi-tenancy-y-rls]], R2).
Lo prueban las **dos direcciones** en `lib/test/tope-descuento.e2e.test.ts`: el
40 % es legal en beta e ilegal en alfa, a la vez y contra el mismo Postgres.

**Cambiar el tope pide la contraseña; poner descuento no.** El candado
(`exigirDesbloqueo`, ADR 0009) se aplica **solo a ese campo** dentro de
`PATCH /api/config`, no a la ruta entera: el tope es el *control*, y sin esto
quien administra lo sube con un clic y a continuación regala la venta —el
candado sobre el descuento no serviría de nada—. El resto de la pantalla de
Administración (loop, IVA, plazos…) sigue guardándose sin fricción.

**Y la bitácora dice cuánto (TOPE-02).** `PATCH /api/propuestas/[id]` escribía
`Actualizó propuesta (v2)` sin decir qué descuento se puso; al **aprobar** sí
queda el importe, pero para entonces ya no se sabe quién lo puso.
`textoBitacoraPropuesta()` escribe ahora «Puso 22 % de descuento en la propuesta
(v2)» — y **solo cuando el descuento cambió de verdad**, no en cada guardado,
porque anotarlo siempre haría inútil el filtro por persona de Actividad.

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

## Portal del cliente

`campanas.portal_token` + `portal_activo` habilitan `/portal/[token]`.
`portal-repo.ts:10-12`: devuelve **solo** lo de esa campaña — nada de otros
clientes ni datos financieros.

## Relacionadas
[[flujo-propuesta-a-campana]] · [[finanzas-y-cobranza]] · [[operaciones-y-ot]] ·
[[inventario-y-sitios]] · [[paginas-publicas]] · [[esquema]] · [[MOC-Proyecto]]
