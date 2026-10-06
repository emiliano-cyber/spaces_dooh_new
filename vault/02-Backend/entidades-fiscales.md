---
tipo: modulo
estado: verificado
actualizado: 2026-10-05
tags: [backend, entidades, fiscal, administracion, tenant, rojo]
archivos:
  - db/migrations/20260917_entidades_fiscales.sql
  - db/migrations/20260921_corrige_acentos_catalogo_roles_entidad.sql
  - apps/web/lib/server/entidades-repo.ts
  - apps/web/lib/server/entidades-controller.ts
  - apps/web/app/api/entidades/route.ts
  - apps/web/app/api/entidades/[id]/route.ts
  - apps/web/app/api/estado/route.ts
  - apps/web/lib/server/entidades-repo.test.ts
  - apps/web/lib/server/entidades-controller.test.ts
  - apps/web/lib/test/entidades-fiscales.e2e.test.ts
  - apps/web/lib/server/bienvenida-repo.ts
  - apps/web/app/(app)/(shell)/razones-sociales/page.tsx
  - apps/web/lib/server/arrendadores-repo.ts
  - apps/web/lib/server/finanzas-repo.ts
---

# Entidades fiscales del owner

Las **razones sociales PROPIAS** del owner: con cuál paga las rentas, con cuál
compra los activos, con cuál tramita las licencias y con cuál vende. Nacieron el
**2026-09-17**; antes de esa fecha el producto no guardaba ninguna.

> [!danger] `entidad_id` NO es una frontera de seguridad
> La frontera sigue siendo **UNA**: `tenant_id` con RLS
> (`apps/web/lib/server/db.ts:60` y `:79`). Si una consulta filtra por `entidad_id`
> creyendo que eso aísla y se le cae el `tenant_id`, aparece el fallo **R2** de
> este repositorio, que **no da error**: devuelve cero filas en silencio o filas
> de otra empresa. Ya pasó dos veces (ver [[06-Operacion/zonas-de-riesgo]]).
>
> Por eso cada consulta del repo lleva `and tenant_id = $n` **explícito** como
> segunda capa sobre la política, y por eso el módulo usa `q`/`q1` y **nunca
> `qRaw`**. No es ceremonia: es lo único que convierte un descuido en cero filas
> en vez de en una fuga.

> [!warning] No confundir con `arrendador_razon_social`
> `arrendador_razon_social` (`db/schema.sql:290`, repo en
> `arrendadores-repo.ts:694-815`) es la razón social **del arrendador**: quien me
> **COBRA** la renta. Esta nota es la del **owner**: quien la **PAGA**. Son dos
> catálogos distintos, en dos pantallas distintas, y ninguno sustituye al otro.
> El módulo de arrendadores se usó como **molde de estilo** y no se tocó — ver
> [[02-Backend/arrendadores-y-contratos]].

## Por qué existe

Un owner de SPACE OS no es una sola empresa. Reparte la operación entre varias
sociedades: una paga rentas, otra compra activos, otra hace trámites con
gobierno, otra u otras venden publicidad, y operación/nómina va aparte. Hasta el
17/09 `tenants` solo tenía `id, nombre, slug, moneda` (`db/schema.sql:590-596`,
releído el 05/10)
más una columna `razon_social` suelta añadida después — **una, y nada más**. Con
eso no se puede decir a nombre de quién se paga una renta ni quién emite un
comprobante.

## El esquema

`db/migrations/20260917_entidades_fiscales.sql` (239 líneas) crea **tres**
tablas y añade **dos** columnas.

| Objeto | Qué es | Línea |
|---|---|---|
| `catalogo_roles_entidad` | Vocabulario de roles. **Sin `tenant_id`** | `:62` |
| Semilla de los 5 roles | `ARRENDAMIENTOS · ACTIVOS · LICENCIAS · OPERACION · VENTAS` | `:76` |
| Corrección de acentos (`20260921`) | `LICENCIAS` y `OPERACION` sembraron su `etiqueta` sin acento (D8 de `docs/Supervision/ABIERTOS.md`); un `update` idempotente en una migración nueva lo corrige, sin tocar la del 17/09 ya aplicada | `db/migrations/20260921_corrige_acentos_catalogo_roles_entidad.sql` |
| `entidades_fiscales` | La razón social propia, con `activo` para la baja lógica | `:85` |
| `entidad_roles` | Qué papel juega cada una. `unique (entidad_id, rol)` | `:115` |
| `contratos_arrendamiento.entidad_id` | Quién paga esta renta. **Nullable** | `:133` |
| `facturas.entidad_emisora_id` | Quién emite el comprobante. **Nullable** | `:154` |
| RLS fail-closed + FORCE | Patrón literal de `20260723_almacen.sql:47-60` | `:182` |
| ASSERT del invariante de hard1 | 0 tablas con `tenant_id` sin RLS+FORCE | `:226` |

### Tres decisiones que conviene no rehacer

1. **El rol es TEXTO con catálogo, no un `enum`.** La lista de roles es una
   decisión de negocio **todavía abierta**. Con un enum cada cambio es una
   migración —y un `alter type` no se revierte dentro de una transacción—; con
   catálogo es un `insert`. La integridad no se pierde: `entidad_roles.rol`
   referencia al catálogo, así que un rol inventado sigue siendo imposible.
   El controller **consulta** ese catálogo (`entidades-controller.ts:65-83`) en
   vez de llevar la lista dentro: una constante ahí habría devuelto la lista al
   código y anulado el motivo de la decisión.

2. **Las dos columnas nuevas son NULLABLE.** Las filas anteriores al 17/09 se
   quedan sin entidad y **eso es correcto**: se pintan como «sin asignar».
   Declararlas obligatorias hacia atrás habría dejado el módulo inservible el día
   del despliegue. Las FK van `on delete set null` (medido: `confdeltype = n`):
   retirar una razón social no puede llevarse por delante un contrato ni un
   comprobante emitido.

3. **`catalogo_roles_entidad` no lleva `tenant_id`**, así que queda **fuera** del
   invariante de RLS — mismo criterio que `folios_consecutivos`
   (`db/schema.sql:95-100`). Es vocabulario del producto, igual para toda la
   flota. **Un catálogo por organización nadie lo ha decidido**: si hiciera
   falta, es una decisión de negocio, no un refactor.

## Las capas

`route.ts` → `entidades-controller.ts` → `entidades-repo.ts` → `db.ts`, como
manda [[06-Operacion/convenciones]]. El SQL vive solo en el repo.

| Función | Qué hace | Línea |
|---|---|---|
| `listarEntidades` | Solo las activas salvo `incluirInactivas` | `entidades-repo.ts:70` |
| `obtenerEntidad` | Por id **y** tenant; `null` si es de otra organización | `:83` |
| `rolesDeEntidad` | Los roles, acotados por tenant | `:93` |
| `catalogoRolesEntidad` | Los roles disponibles, leídos de la base | `:106` |
| `crearEntidad` | Entidad + roles en la **misma** transacción | `:157` |
| `editarEntidad` | Parche por campo; los roles se **reemplazan** en bloque | `:196` |
| `desactivarEntidad` | Baja **lógica** (`activo = false`) | `:255` |

Los roles viajan con la entidad en la misma consulta (`ROLES_DE_LA_FILA`,
`entidades-repo.ts:60-63`) y no en una consulta por fila: el listado las pinta
todas y una por entidad es el N+1 clásico. Esa subconsulta lleva **su propio**
`tenant_id`, no se apoya en que el padre ya esté acotado.

## Los endpoints

| Método | Ruta | Guard |
|---|---|---|
| GET | `/api/entidades` (`?inactivas=1`) | `exigir('administracion','ver')` (`route.ts:29`) |
| POST | `/api/entidades` | `exigir('administracion','crear')` (`route.ts:62`) |
| GET | `/api/entidades/[id]` | `exigir('administracion','ver')` (`[id]/route.ts:18`) |
| PATCH | `/api/entidades/[id]` | `exigir('administracion','crear')` (`[id]/route.ts:31`) |
| DELETE | `/api/entidades/[id]` | `exigir('administracion','crear')` (`[id]/route.ts:79`) |

El `GET` del listado devuelve `{ entidades, catalogo }`: el catálogo de papeles
viaja **con su etiqueta y su orden** en la misma respuesta, y se lee con
`catalogoRolesConEtiqueta` de `bienvenida-repo.ts:54` en vez de reescribir la
consulta (`route.ts:31-53`). Este repositorio ya tuvo dos catálogos de permisos
que divergían; lo que lo impide es que solo exista una consulta.

**`administracion` y no `arrendadores`**, a propósito: esto es la identidad
fiscal del negocio, no un dato operativo del módulo de propietarios. Quien
captura contratos no decide con qué sociedad se firma.

`DELETE` es **baja lógica**. No es un atajo: la entidad aparece en contratos y en
comprobantes ya emitidos, y como las FK son `on delete set null`, un borrado de
verdad **no fallaría** — dejaría esos documentos sin razón social en silencio,
que es peor que un error.

Toda mutación queda en la bitácora de acciones con `registrarAccion`, y el PATCH
guarda **el valor anterior y el nuevo** (`[id]/route.ts:34-65`): saber que un
dato fiscal cambió no basta, hay que poder ver de qué a qué.

### La rebanada de `/api/estado`

`si('administracion', () => listarEntidades({ incluirInactivas: true }))`
(`apps/web/app/api/estado/route.ts:137`), y la clave `entidadesFiscales` viaja
en el cuerpo (`:140`).

> [!note] 2026-10-05 · `incluirInactivas` va PUESTO en la hidratación
> Esta nota decía `listarEntidades()` a secas. Hoy la rebanada pide también las
> dadas de baja (`estado/route.ts:130-137`): una entidad inactiva **sigue
> nombrando** contratos y comprobantes ya emitidos, y sin ella esas pantallas
> pintarían «sin asignar» donde sí hay dato — y el primer guardado del
> formulario borraría la referencia sin que nadie lo pidiera. Quién se
> **ofrece** al capturar lo decide la interfaz con el campo `activo`. A quien no tiene el permiso le llega **arreglo vacío, no
clave ausente**: la forma del cuerpo es contrato con el store del front y una
clave que desaparece rompe la hidratación. El efecto de seguridad es el mismo —
cero filas.

## Lo que está probado, y a qué nivel

| Nivel | Archivo | Qué demuestra |
|---|---|---|
| Unitaria | `entidades-repo.test.ts` (11) | Que **toda** consulta del módulo nombra `tenant_id` y lo pasa |
| Unitaria | `entidades-controller.test.ts` (17) | Validación: razón social, RFC, roles, duplicados, catálogo |
| Integración | `entidades-fiscales.e2e.test.ts` (31) | El aislamiento, contra Postgres real y con el **rol de la app** |

> [!important] Las unitarias NO ven los fallos de RLS
> Simulan la base, y los dos peores fallos de aislamiento de este proyecto las
> pasaron sin despeinarse. Lo que sí hacen es ponerse rojas si alguien borra un
> `and tenant_id` al refactorizar: **medido por mutación** el 17/09 — quitarlo de
> `rolesDeEntidad` pone en rojo dos casos y **nombra la consulta culpable**.
>
> El aislamiento lo demuestra la e2e, y con `poolApp()`, nunca con el pool de
> administración: el rol `spaces` es superusuario y se salta la RLS aunque la
> tabla tenga FORCE, así que con él toda prueba de aislamiento pasa por
> casualidad.

Los dos casos que son el corazón del archivo e2e están escritos **a propósito
sin `and tenant_id`** —son la consulta que escribiría quien creyera que un uuid
ya aísla— y tienen que devolver cero filas
(`entidades-fiscales.e2e.test.ts:262-286`, releído el 05/10: siguen ahí).

## Lo que este módulo NO hace

- **No timbra CFDI.** En este producto `facturas` son recibos y comprobantes de
  pago; el timbrado real llegará después por API. Aquí no hay nada del SAT, ni
  certificados, ni complemento de pago: solo **cuál de mis razones sociales**
  emite el documento. Ver [[02-Backend/finanzas-y-cobranza]].
- ~~**No tiene pantalla.**~~ **Ya la tiene desde el 18/09** (`f412a894`):
  `/razones-sociales` bajo el shell (`app/(app)/(shell)/razones-sociales/page.tsx`),
  con lista, alta, edición, baja lógica y **reactivar**. La entrada de menú
  «Razones sociales», que apuntaba al cuestionario de `/bienvenida`, apunta
  ahora a la gestión. Ver [[cuestionario-bienvenida]].
- ~~**No asigna entidad a un contrato desde la aplicación.**~~ **Ya la asigna
  desde el 18/09** (`8c6002e7`): `PATCH /api/contratos/[id]` escribe
  `contratos_arrendamiento.entidad_id` y `POST /api/campanas/[id]/facturar`
  escribe `facturas.entidad_emisora_id`, validando contra el tenant **antes**
  de escribir. Detalle en [[02-Backend/arrendadores-y-contratos]] y
  [[multi-entidad-en-uso]].

> [!note] 2026-10-05 · los dos últimos puntos eran ciertos el 17/09
> Se conservan tachados porque la nota se escribió el día del backend y las dos
> cosas llegaron al día siguiente. Lo que sigue sin hacer es el timbrado.

## Relacionadas

[[02-Backend/_indice]] · [[02-Backend/arrendadores-y-contratos]] ·
[[multi-entidad-en-uso]] · [[cuestionario-bienvenida]] ·
[[02-Backend/multi-tenancy-y-rls]] · [[02-Backend/finanzas-y-cobranza]] ·
[[06-Operacion/zonas-de-riesgo]] · [[06-Operacion/convenciones]] ·
[[04-Datos/esquema]] · [[04-Datos/migraciones]]
