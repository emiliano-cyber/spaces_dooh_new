---
tipo: backend
estado: en-curso
actualizado: 2026-11-18
tags: [backend, crm, comercial, oportunidades, adr-0051, rojo]
archivos:
  - db/migrations/20261117_propuesta_cambios_por_trigger.sql
  - apps/web/lib/server/propuestas-visibilidad.ts
  - apps/web/lib/test/propuesta-cambios.e2e.test.ts
  - apps/web/lib/test/propuestas-por-vendedor.e2e.test.ts
  - db/migrations/20261117_crm_oportunidades.sql
  - apps/web/lib/crm.ts
  - apps/web/lib/server/oportunidades-repo.ts
  - apps/web/lib/server/oportunidades-controller.ts
  - apps/web/app/api/oportunidades/
  - apps/web/lib/test/oportunidades.e2e.test.ts
  - apps/web/lib/crm.test.ts
  - apps/web/lib/server/clientes-repo.ts
  - apps/web/lib/server/clientes-controller.ts
  - apps/web/lib/i18n/errores-servidor.ts
  - apps/web/lib/i18n/errores-crm.test.ts
  - apps/web/lib/data/oportunidades-api.ts
  - apps/web/app/(app)/(shell)/crm/page.tsx
  - apps/web/app/(app)/(shell)/crm/oportunidades/[id]/page.tsx
  - apps/web/components/demo/crm/
  - apps/web/lib/i18n/textos/crm.ts
  - apps/web/lib/i18n/pantallas-crm.test.ts
  - apps/web/app/(app)/(shell)/propuestas/page.tsx
---

# CRM comercial — las oportunidades (ADR 0051, Fases 2 a 4)

Lo que un cliente **quiere** comprar —presupuesto, fechas, plazas, medios,
objetivo— y la etapa en que va la venta. Se monta **encima** de lo que ya
había: el lead es un prospecto `CLIENTE` de [[captacion]], y lo que se le
cotiza son las propuestas de [[comercial-propuestas-campanas]]. El porqué y
las fases están en `docs/adr/0051-…md` y en [[decisiones]].

> [!warning] Estado al 2026-11-17
> Fases 2 y 3 hechas en `feat/crm-comercial`, **sin empujar**: la migración, la
> API, el historial de propuestas por trigger, el ligado y la visibilidad por
> vendedor. **La Fase 4 —la pantalla— está terminando** en el commit `wip(crm)`
> `37b5f4dd`: `/crm`, la ficha y «CRM» en el menú (abajo). Faltan la suite
> unitaria y la e2e completas y el recorrido de la ficha en navegador.

## Las tablas — `20261117_crm_oportunidades.sql`

| Tabla | Qué guarda | Lo que no se puede |
|---|---|---|
| `oportunidades` | El cliente o el prospecto (al menos uno), el vendedor, la etapa, el presupuesto mín./máx., las fechas deseadas y de decisión, plazas, medios y objetivo | Borrarla: la que no prospera se marca `PERDIDA` con su motivo |
| `oportunidad_actividades` | Llamadas, visitas, juntas, correos, WhatsApp, notas, y una fila `ETAPA` por cada cambio de etapa | Editarla o borrarla, ni como superusuario (trigger `crm_solo_crece`) |
| `propuesta_cambios` | Campo por campo, quién cambió qué en cada propuesta. La escriben **triggers** (Fase 3, abajo) | Igual: solo crece |

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
| GET · PATCH | `/api/oportunidades/[id]` | `comercial:ver` · `comercial:crear` | Ficha con su línea de tiempo y sus cotizaciones —y desde la Fase 4, `cambios` y `avancesProspecto` (abajo)—; edición parcial |
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
- **No hay probabilidad de cierre.** La hubo (por etapa y luego por
  instancia) y el dueño la quitó entera el 17/11: ver abajo.
- El cliente de una oportunidad sobre un lead aparece solo cuando el lead se
  aprueba: se lee `coalesce(cliente_id, prospectos.registro_id)`, sin que la
  aprobación de Captación tenga que saber de oportunidades.

> [!note] Borrar un cliente con oportunidades: 409 con el desglose (desde la Fase 4)
> `oportunidades.cliente_id` es `on delete restrict`. Hasta la Fase 3 el
> borrado de clientes no las contaba y el 409 llegaba con el genérico «El
> registro está referenciado por otro». Ahora `borrarCliente` las cuenta
> (`clientes-repo.ts:251-253`, `:287`, `:297`) y el desglose dice «el cliente
> tiene 1 oportunidad» (`clientes-controller.ts:170-171`). En inglés, italiano
> y portugués lo traducen las tres funciones de bloqueo de
> `lib/i18n/errores-servidor.ts` (`:1740-1749`, `:2148-2156`, `:2451-2461`):
> «oportunidades» hace el plural en -es y no bastaba quitar la `s`. Lo vigilan
> `lib/i18n/errores-crm.test.ts` y la e2e (409, el desglose y el cliente sigue
> ahí).

## Cómo se probó

`lib/crm.test.ts` (11, vista en rojo antes de existir el módulo) y
`lib/test/oportunidades.e2e.test.ts` (28, vista en rojo sin la migración: 13
fallos, y en verde con ella) contra Postgres 16 y Next reales. Lo que prueba es
sobre todo lo que **impide**: FK con tenant, RLS, el trigger contra el
superusuario, los grants del rol de la aplicación, el 404 entre vendedores y
entre organizaciones en las cuatro rutas, y el borrado de un usuario con
historia. No toca `aislamiento.e2e.test.ts`.

## Fase 3 — el historial de propuestas, ligar y quién ve qué

**El historial lo escribe la base.** `20261117_propuesta_cambios_por_trigger.sql`
pone triggers `after` en `propuestas` y `propuesta_items` que comparan la fila
vieja con la nueva columna por columna y escriben en `propuesta_cambios`. Así
corre en la misma transacción que el cambio y **ninguna ruta puede saltárselo**,
tampoco las de cupón y paquete. El dueño lo eligió el 17/11 en vez de escribirlo
desde `propuestas-repo.ts`, donde cuatro funciones no usan transacción (la de
aprobar entre ellas).

| Acción | Cuándo |
|---|---|
| `CREAR` · `BORRAR` | Alta (UNA fila, no una por sitio) y borrado de un borrador (la historia queda, con su folio) |
| `EDITAR` | Cualquier columna que cambie y no sea de las de abajo |
| `ENVIAR` · `ESTATUS` · `ACEPTAR` | El estatus; `ACEPTAR` cuando el cliente acepta por la liga (origen `CLIENTE`, con su nombre) |
| `CODIGO` · `PAQUETE` · `LIGAR` | Columnas `codigo_*`, `paquete_*` y `oportunidad_id` |
| `AGREGAR_SITIO` · `QUITAR_SITIO` · `APROBAR_SITIO` | Los renglones, con su `item_id` |

**Quién**: lo fija `db.ts` de la sesión (ver [[multi-tenancy-y-rls]]). Sin sesión,
`SISTEMA`.

> [!warning] Lo que NO registra, a propósito
> Las columnas derivadas (`version` —va en su propia columna—, `snapshot_*`,
> `aprobada_en`, `rechazada_en`, `aceptado_*`, ids, folio y token). Si una
> columna nueva no debe aparecer en el historial, hay que agregarla a la lista de
> exclusión del trigger con una migración nueva.

**Ligar**: `oportunidadId` al crear la propuesta, o `PATCH /api/propuestas/[id]`
con `{ oportunidadId }` **solo** (en cualquier estatus). 404 si la oportunidad no
es de quien liga; 409 si está perdida o es de otro cliente.

**Quién ve qué propuesta** (decisión del dueño del 17/11): el vendedor, solo las
suyas —en `/api/estado`, en el resumen y en cada ruta por id, que contesta
404—; quien tiene `comercial.aprobar`, todas
(`lib/server/propuestas-visibilidad.ts`). Las de antes de VEND-01, sin vendedor,
solo las ve quien ve todas. La liga pública no pasa por ahí, y **no trae el
historial** (es interno).

Probado por `propuesta-cambios.e2e.test.ts` (17, en rojo sin la migración del
trigger: 15 fallos) y `propuestas-por-vendedor.e2e.test.ts` (9, en rojo contra el
build anterior: 7 fallos).

## Fase 4 — la pantalla

> [!important] 2026-11-18 · YA NO SE LLAMA «CRM»: son pestañas de Propuestas
> Pedido del dueño: «en el CRM no se debe de llamar CRM sino Propuestas;
> además corrígelo porque debe de ser similar al que ya existía de
> Propuestas». Se invirtió la relación del 17/11: ya no es `/crm` con
> Propuestas como cuarta pestaña, sino **`/propuestas` con cuatro pestañas**
> —Propuestas (la lista, por omisión) · Embudo · Oportunidades · Prospectos—,
> en `?vista=` (`propuestas/page.tsx:116`, `PestanasCrm.tsx`). El menú vuelve a
> decir «Propuestas» ([[shell-y-navegacion]]). **`/crm` solo redirige** a la
> pestaña equivalente (`crm/page.tsx`, `redirect()` del servidor), y la ficha
> se queda en `/crm/oportunidades/[id]`, que enciende «Propuestas» por
> `tambien: ['/crm']`. Las claves internas (`crm.*`, el área `crm` de
> `lib/modulos.ts`, `/api/oportunidades`) **no se renombraron**: no se ven.
>
> **Y se ve como Propuestas**: título y botón verde principal en el encabezado
> («Nueva oportunidad» en el sitio de «Nueva propuesta», con el mismo permiso
> `comercial.crear` que exige el `POST`), pestañas subrayadas como `ui/Tabs`,
> cuatro `KPICard` (abiertas · presupuesto en juego · ganado · cotizaciones),
> el embudo y la lista dentro de `CardColapsable` (`propuestas.embudo`,
> `propuestas.oportunidades`), chips de filtro iguales a los de estatus, tabla
> con el estilo de Clientes, y las etapas con el dibujo del estatus de una
> propuesta (`COLOR_ETAPA` reutiliza `EST`: ganada = aprobada, perdida =
> rechazada, cotizando = enviada). La ficha copia la de una propuesta:
> «Volver» + migas, insignia junto al nombre, resumen en `KPICard` y cada
> sección en `CardColapsable` `oportunidad.<seccion>`.
>
> Ninguna pantalla ni texto `crm.*` dice «CRM» en ningún idioma, y lo vigila
> `pantallas-crm.test.ts` (bloque «18/11»).

| Pantalla | Qué hay |
|---|---|
| `/propuestas?vista=embudo` | Una columna por etapa con su total. Una tarjeta se mueve a otra etapa abierta o a GANADA; a PERDIDA no, porque exige el motivo y eso va en la ficha (`components/demo/crm/Oportunidades.tsx`) |
| `/propuestas?vista=oportunidades` | La lista, con chips por etapa y la columna de vendedor. «Nueva oportunidad» (encabezado de la página) abre `FormOportunidad` |
| `/propuestas?vista=prospectos` | Los leads de tipo cliente: la pantalla de Captación con `tipoFijo="CLIENTE"` (`propuestas/page.tsx:219`), sin otra pantalla de leads |
| `/crm/oportunidades/[id]` | La ficha (`FichaOportunidad`): lo pedido, el cotejo por cotización, días en cada etapa, actividades, cambio de etapa, ligar y desligar propuestas, y la línea de tiempo unida, filtrable por persona |
| `/crm`, `/crm?vista=…` | Redirige a `/propuestas?vista=…` (sin `vista`, al embudo, que es lo que enseñaba) |

Todo pasa por `lib/data/oportunidades-api.ts`; el servidor ya filtra por
vendedor, la pantalla no decide quién ve qué. El menú y las pestañas, en
[[shell-y-navegacion]] y [[modulos-internos]].

**La ficha del servidor trae dos cosas más** (`oportunidades-controller.ts:126-153`):

- `cambios`: el historial de las propuestas **ligadas y vivas**, los últimos
  300 (`leerCambiosDePropuestas`, `oportunidades-repo.ts:282`).
- `avancesProspecto`: la bitácora del lead, **solo si quien mira puede ver ese
  prospecto con la regla de Captación** (`:138`). Si no, `[]`: ver la
  oportunidad de un vendedor no da permiso de leer sus leads. La e2e lo prueba
  quitándole `captacion.aprobar` al gerente.

**Las cuentas de la pantalla** (`lib/crm.ts`, calculadas al leer, 24 unitarias
en `lib/crm.test.ts`):

- `diasPorEtapa` (`:113`): de las filas `ETAPA`. Volver a una etapa **suma**;
  GANADA y PERDIDA no cuentan días. Con marcas de tiempo, no fechas: el
  navegador no conoce la zona del negocio.
- `cotejoPresupuesto` (`:139`): debajo · dentro · encima del rango, con la
  diferencia contra el extremo rebasado y su %. `cotejoFechas` (`:175`): cuántos
  días se movió cada extremo.
- `agruparEmbudo`: el total de cada columna. El monto de referencia es el
  máximo del presupuesto, o el mínimo (`montoReferencia`).

> [!important] El cotejo va CON IVA y SIN IVA, con la tasa de cada cliente
> Decisión del dueño del 17/11 (pregunta 5 del ADR). Cada cotización se
> coteja dos veces: contra el `total` de `armarPropuesta` (con IVA) y contra su
> `base` (sin IVA), y la ficha dice la tasa: `ivaPct`, la del cliente
> (`clientes.iva_pct`, p. ej. 8 % en la frontera) o 16. «Sin IVA» es la `base`,
> **no** el `neto` (eso es lo que recibe el medio tras la comisión).

## La probabilidad de cierre, quitada (17/11)

Hubo un porcentaje de cierre por oportunidad para «ponderar» el embudo: fijo
por etapa (10 · 25 · 50 · 75), luego configurable por instancia en
Administración. El dueño, al ver para qué servía, pidió **«ese porcentaje
bórralo»** y eligió quitarlo **todo**. Como nada estaba publicado, se quitó
limpio: se borró `20261117_crm_probabilidad_por_etapa.sql` y la columna
`probabilidad_pct` salió de `20261117_crm_oportunidades.sql`.

La API **rechaza con 400** `probabilidadPct` (alta y edición) y
`crmProbabilidades` (`/api/config`), en vez de ignorarlos: lo vigila la sección
7 de `oportunidades.e2e.test.ts`, que comprueba además que la base no tiene
ninguna de las dos columnas.

> [!important] Lo ligado pasa por la regla de la Fase 3 (arreglado el 17/11)
> Ligar no exige que propuesta y oportunidad sean del mismo vendedor
> (`revisarOportunidadParaLigar`): quien ve todo puede ligar la de B a la
> oportunidad de A. Por eso `leerPropuestasLigadas` y `leerCambiosDePropuestas`
> reciben el `soloDe` de quien mira (`oportunidades-repo.ts:241-255` y
> `:282-298`): A no ve en la ficha ni el folio ni el historial de la de B. Hasta
> el arreglo sí los veía; la e2e «una propuesta de OTRO vendedor ligada a la
> mía…» se vio en rojo. **Ojo:** el contador `cotizaciones` de la lista sigue
> contando todas las ligadas (es un número, no el contenido).
>
> Y las fechas cotizadas llegan como ISO completo: `diasEntre` (`lib/crm.ts`)
> acepta los dos formatos. Hasta el 17/11 la ficha decía «inicio NaN».

Relacionado: [[api-endpoints]], [[04-Datos/esquema]], [[04-Datos/migraciones]],
[[roles-de-venta]], [[multi-tenancy-y-rls]].
