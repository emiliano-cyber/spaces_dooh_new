---
tipo: modulo
estado: verificado
actualizado: 2026-08-13
tags: [backend, comercial, propuestas, campanas, amarillo]
archivos:
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/propuestas-controller.ts
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

## Portal del cliente

`campanas.portal_token` + `portal_activo` habilitan `/portal/[token]`.
`portal-repo.ts:10-12`: devuelve **solo** lo de esa campaña — nada de otros
clientes ni datos financieros.

## Relacionadas
[[flujo-propuesta-a-campana]] · [[finanzas-y-cobranza]] · [[operaciones-y-ot]] ·
[[inventario-y-sitios]] · [[paginas-publicas]] · [[esquema]] · [[MOC-Proyecto]]
