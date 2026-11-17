---
tipo: backend
estado: en-curso
actualizado: 2026-11-17
tags: [backend, crm, comercial, oportunidades, adr-0051, rojo]
archivos:
  - db/migrations/20261117_crm_oportunidades.sql
  - apps/web/lib/crm.ts
  - apps/web/lib/server/oportunidades-repo.ts
  - apps/web/lib/server/oportunidades-controller.ts
  - apps/web/app/api/oportunidades/
  - apps/web/lib/test/oportunidades.e2e.test.ts
---

# CRM comercial — las oportunidades (ADR 0051, Fase 2)

Lo que un cliente **quiere** comprar —presupuesto, fechas, plazas, medios,
objetivo— y la etapa en que va la venta. Se monta **encima** de lo que ya
había: el lead es un prospecto `CLIENTE` de [[captacion]], y lo que se le
cotiza son las propuestas de [[comercial-propuestas-campanas]]. El porqué y
las fases están en `docs/adr/0051-…md` y en [[decisiones]].

> [!warning] Estado al 2026-11-17
> Fase 2 hecha en `feat/crm-comercial`, **sin empujar**: la migración, la API y
> su e2e. **No hay pantalla todavía** (es la Fase 4), y `propuesta_cambios`
> existe pero **nadie la escribe** hasta la Fase 3.

## Las tablas — `20261117_crm_oportunidades.sql`

| Tabla | Qué guarda | Lo que no se puede |
|---|---|---|
| `oportunidades` | El cliente o el prospecto (al menos uno), el vendedor, la etapa, la probabilidad, el presupuesto mín./máx., las fechas deseadas y de decisión, plazas, medios y objetivo | Borrarla: la que no prospera se marca `PERDIDA` con su motivo |
| `oportunidad_actividades` | Llamadas, visitas, juntas, correos, WhatsApp, notas, y una fila `ETAPA` por cada cambio de etapa | Editarla o borrarla, ni como superusuario (trigger `crm_solo_crece`) |
| `propuesta_cambios` | Campo por campo, quién cambió qué en cada propuesta (Fase 3) | Igual: solo crece |

Y además `propuestas.oportunidad_id` (opcional) y `clientes_id_tenant_uq`, que
faltaba para poder hacer la FK compuesta hacia `clientes`.

> [!important] Dos decisiones de la migración que no se ven a simple vista
> - **Las FK son compuestas con `tenant_id`** (cliente, prospecto, oportunidad):
>   los chequeos de FK saltan la RLS, y una FK simple dejaría apuntar al cliente
>   de otra organización.
> - **Lo que solo crece no tiene FK a `usuarios`**: guarda el id y el nombre
>   congelado. Es la lección de `20261109_acciones_sin_fk_usuario.sql` —una FK
>   `set null` sobre una tabla append-only hace que borrar un usuario sea un
>   UPDATE que el trigger rechaza—. La e2e borra un usuario con historia y
>   comprueba que no se rompe.

## La API

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET · POST | `/api/oportunidades` | `comercial:ver` · `comercial:crear` | Lista (filtros `etapas`, `clienteId`, página; cuenta por etapa en la base) y alta |
| GET · PATCH | `/api/oportunidades/[id]` | `comercial:ver` · `comercial:crear` | Ficha con su línea de tiempo y sus cotizaciones; edición parcial |
| POST | `/api/oportunidades/[id]/etapa` | `comercial:crear` | Mueve en el embudo y deja la fila `ETAPA` en la misma transacción |
| POST | `/api/oportunidades/[id]/actividades` | `comercial:crear` | Una actividad; `ETAPA` no se acepta a mano |

**Quién ve qué** (`oportunidades-controller.ts`, `soloDe`): quien tiene
`comercial.aprobar` ve todas; el resto, solo las suyas. Una ajena es **404**,
no 403. El prospecto del que cuelga se comprueba con la regla de **Captación**
(`captacion.aprobar`), no con otra: no se abre un segundo sistema de permisos.

**Lo que nunca viene del cuerpo**: el vendedor, el autor, la etapa (salvo en
su ruta) y las fechas de cierre. Los esquemas son `.strict()`.

## Las reglas — `lib/crm.ts`

- Etapas: `CONTACTO → NECESIDAD → COTIZANDO → NEGOCIANDO → GANADA | PERDIDA`.
  Mientras está abierta **se puede ir y volver**; cerrada ya no se mueve ni se
  edita (sí se le pueden anotar actividades). Perderla **exige el motivo**.
- Probabilidad: la que pone el vendedor, o la de la etapa (10 · 25 · 50 · 75 ·
  100 · 0) **aplicada al leer**. La base guarda `NULL` cuando no la tocó,
  porque esa tabla sigue siendo una pregunta abierta al dueño (pregunta 3).
- El cliente de una oportunidad sobre un lead aparece solo cuando el lead se
  aprueba: se lee `coalesce(cliente_id, prospectos.registro_id)`, sin que la
  aprobación de Captación tenga que saber de oportunidades.

> [!warning] Borrar un cliente con oportunidades da 409 genérico
> `oportunidades.cliente_id` es `on delete restrict`. El borrado de clientes
> (`clientes-repo.ts`, `borrarCliente`) no las cuenta en su lista de bloqueos,
> así que el 409 llega con el mensaje genérico «El registro está referenciado
> por otro» en vez del desglose. La e2e comprueba que es 409 y que el cliente
> sigue ahí, no un 500. Contarlas en el desglose queda para la Fase 4.

## Cómo se probó

`lib/crm.test.ts` (11, vista en rojo antes de existir el módulo) y
`lib/test/oportunidades.e2e.test.ts` (28, vista en rojo sin la migración: 13
fallos, y en verde con ella) contra Postgres 16 y Next reales. Lo que prueba es
sobre todo lo que **impide**: FK con tenant, RLS, el trigger contra el
superusuario, los grants del rol de la aplicación, el 404 entre vendedores y
entre organizaciones en las cuatro rutas, y el borrado de un usuario con
historia. No toca `aislamiento.e2e.test.ts`.

Relacionado: [[api-endpoints]], [[04-Datos/esquema]], [[04-Datos/migraciones]],
[[roles-de-venta]], [[multi-tenancy-y-rls]].
