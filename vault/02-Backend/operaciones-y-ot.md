---
tipo: modulo
estado: verificado
actualizado: 2026-09-30
tags: [backend, operaciones, ot, imprenta, amarillo, almacen, checklist]
archivos:
  - apps/web/lib/server/ot-repo.ts
  - apps/web/lib/server/ot-controller.ts
  - apps/web/lib/server/impresion-repo.ts
  - apps/web/lib/server/operaciones-eventos.ts
  - apps/web/lib/server/almacen-repo.ts
  - apps/web/lib/server/almacen-controller.ts
  - apps/web/lib/almacen-tipos.ts
  - apps/web/app/(app)/(shell)/almacen/page.tsx
  - apps/web/lib/tipos-ot.ts
  - apps/web/lib/costos-ot.ts
  - apps/web/lib/costos-ot-payload.ts
  - apps/web/app/(app)/(shell)/administracion/page.tsx
  - db/migrations/20260917_costos_ot_por_tipo.sql
  - db/migrations/20260929_costo_real_ot.sql
  - apps/web/app/api/ot/[id]/checklist/route.ts
  - apps/web/lib/checklist-autoguardado.ts
  - apps/web/components/operaciones/OTVista.tsx
---

# Operaciones, OT e imprenta

## Órdenes de trabajo

Una **OT** es una tarea de campo: montaje de lona, montaje digital, desmontaje,
mantenimiento, herrería, eléctrico, inspección (`tipo_ot`, `db/schema.sql:53`).

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `ot-repo.ts` | 353 | OT + evidencias, cierre, checklist punto a punto, costo real, notificaciones |
| `ot-controller.ts` | 99 | Validación (alta, costo, punto del checklist) |
| `impresion-repo.ts` | 121 | Órdenes de impresión y OC |
| `operaciones-eventos.ts` | 86 | OT automáticas desde Arrendadores |
| `almacen-repo.ts` | 141 | Activos y traslados; filtro por tipo |
| `almacen-controller.ts` | 100 | Validación zod del alta y del `?tipo=` (desde el 30/09) |

> [!warning] No existe forma de reasignar una OT ya creada
> Las rutas son `GET·POST /api/ot`, `GET /api/ot/[id]`,
> `POST /api/ot/[id]/cerrar`, —desde el **2026-09-29**—
> `PATCH /api/ot/[id]/costo` ([[02-Backend/costo-real-de-ot]]) y —desde el
> **2026-09-30**— `PATCH /api/ot/[id]/checklist` (ver abajo).
>
> **Esos `PATCH` son de un solo campo cada uno**, y no abren la puerta a editar
> lo demás: el de costo lleva el candado de dinero y el del checklist solo
> cambia `checklist[i].hecho`. Ninguno es un editor general de la OT. `asignado_a` sigue sin poder cambiarse. Se escribe en dos momentos: al **crear**
> la OT (`crearOTCtrl`, campo `asignadoA`) y al **cerrarla**, donde
> `ot-repo.ts:193` hace `asignado_a = coalesce(asignado_a, $3)` para estampar a
> quien cierra. Cambiar el responsable de una OT existente exige un script de
> datos — o un endpoint nuevo.

## El checklist se guarda punto a punto (OT-CHECK-01, 2026-09-30)

**Antes del 30/09** el checklist (`ordenes_trabajo.checklist`, `jsonb` de
`{label, hecho}`, `db/schema.sql:481`) **solo se escribía dos veces**: al crear
la OT (`crearOT`) y al cerrarla, cuando `cerrarOT` lo ponía **todo** en
`hecho: true`. Lo que la cuadrilla tachaba vivía en un `useState` de
`OTVista.tsx` (`setChecks` en el `onClick`) y **se perdía al recargar** o al
cerrar la pestaña. Pedido del dueño: «que se guarde cada vez que se tacha algo».

**Hoy**, cada clic manda `PATCH /api/ot/[id]/checklist` con
`{ indice, label, hecho }` → `marcarPuntoChecklistCtrl` (zod estricto,
`ot-controller.ts:96`) → `marcarPuntoChecklist` (`ot-repo.ts:153`). Sin
migración: la columna ya existía.

| Decisión | Por qué |
|---|---|
| **Un punto por petición, no el checklist entero** | Con el estado completo, dos clics casi simultáneos llegan cada uno con su foto y el segundo deshace el primero. Un punto es idempotente |
| **Un solo `update … jsonb_set(checklist, …)`**, sin `select` previo | El `update` bloquea la fila y cambia solo `checklist[i].hecho`: no hay carrera de «leer, cambiar, escribir». La e2e lanza dos marcas a la vez y comprueba que sobreviven las dos |
| **`and tenant_id = $2`** además de la RLS | Convención; guard de fuente en `ot-repo.checklist-aislamiento.test.ts` |
| **El `label` tiene que cuadrar** con el del punto guardado | Un índice viejo no tacha otra tarea si el checklist cambió → **409** |
| **OT `COMPLETADA`/`CANCELADA` → 409** | El cierre ya la dejó toda en hecho |
| **No toca `estatus`, fechas, `asignado_a` ni `costo_real`** | Tachar el último punto **no cierra la OT**: el cierre sigue exigiendo foto + ubicación en `cerrarOT`, que es lo que destraba la facturación. Guard de fuente + e2e |
| **Permiso `operaciones.crear`**, el mismo que cerrar | FINANZAS e IMPRENTA tienen `ver` y no marcan (403). `GET /api/ot/[id]` devuelve `puedeEditar` con ese mismo permiso para pintarlo de solo lectura — va en la respuesta y no en `usePuede` porque `/m/ot/[id]` vive fuera del shell y no tiene `SesionProvider` |
| **Sin candado de cambios ni bitácora por clic** | No es dinero; y una fila de `acciones` por casilla sería ruido. El cierre sigue registrándose |

**En la pantalla**, los clics no van directo a `fetch`: pasan por la cola de
`lib/checklist-autoguardado.ts`, que manda **una petición a la vez**, fusiona
los clics repetidos sobre el mismo punto y, si una falla, **se para y conserva
el cambio** (probado en `checklist-autoguardado.test.ts`). `OTVista` muestra
«Guardando… / Guardado», un aviso rojo con **Reintentar** si falla, avisa con
`beforeunload` mientras hay algo sin confirmar, y deshabilita «Cerrar OT»
mientras un punto viaja. Al recargar, lo que la cola no ha confirmado se
superpone a lo que trae el servidor, para no repintar un punto con su valor
viejo.

> [!warning] Lo que NO se verificó
> El recorrido en navegador (clics reales, pérdida de red, `beforeunload`) no
> se ha hecho: `vitest.config.ts` no monta jsdom y el `.tsx` no tiene prueba.
> La lógica de la cola y la ruta sí están cubiertas.

## El cierre de OT es lo que destraba la facturación

`ot-repo.ts:11-14`: cerrar una OT con foto guarda la evidencia, completa la OT
y, **si está ligada a una campaña, enciende `fotos_comprobatorias` y
`reporte_publicacion`** — dos de los tres candados de [[finanzas-y-cobranza]].

> [!warning] Tocar el cierre de OT toca la facturación
> No es un módulo aislado: es el disparador del dinero.

## Evidencias

`evidencias_ot` guarda foto (base64 legado **o** key en DigitalOcean Spaces),
GPS (`lat`, `lng`, `precision_m`), y **dos fechas distintas**:

| Columna | Significado |
|---|---|
| `tomada_en` | Cuándo se hizo la foto (EXIF del archivo) |
| `timestamp` | Cuándo se subió |

La distinción importa: probar que la lona se instaló **el día que se cobró**
depende de `tomada_en`, no de cuándo alguien subió el archivo.

El almacenamiento es condicional: si `storageHabilitado()` (todas las
`DO_SPACES_*` presentes) va a S3 con URL firmada; si no, cae al data URL en base
de datos (`lib/server/storage.ts:18`). Ver [[integraciones-externas]].

## Imprenta

`ordenes_impresion`, proceso lineal:

```
ARTE_RECIBIDO → VALIDADO → EN_PRODUCCION → IMPRESO → LISTO_MONTAJE
```

Con **prueba de color** aprobable (`prueba_color_url`,
`prueba_color_aprobada`). Folio consecutivo `OI-2026-0001`
(`impresion-repo.ts:13-15`).

## OT automáticas

Ver [[arrendadores-y-contratos]]. Cancelar contrato → OT de retiro; alta de
pantalla fija → OT de montaje. Nacen `PENDIENTE` con nota de origen y son a
mejor esfuerzo.

## Cuánto cuesta una OT — por TIPO y desde Configuración

> [!important] Desde el 2026-09-29 esto es el RESPALDO, no la única fuente
> `ordenes_trabajo.costo_real` permite capturar **lo que de verdad costó** cada
> visita, y ese importe **SUSTITUYE** a la tarifa por tipo de aquí abajo — no se
> le suma, porque las dos miden el costo de la orden entera. La tarifa por tipo
> pasa a ser lo que siempre fue de hecho: una **estimación** para cuando el
> costo real no se ha capturado, y el reporte ahora **declara cuántas visitas
> van con cada cosa**.
>
> Todo el porqué —incluido que `0` no es lo mismo que «sin capturar», y por qué
> la captura es una ruta propia con candado de dinero— está en
> [[02-Backend/costo-real-de-ot]].

Desde el **2026-09-17** el costo de mano de obra de una orden de trabajo sale de
`config_negocio.costos_ot` (jsonb, una fila por tenant — ADR 0011) y se resuelve
por tipo en `lib/costos-ot.ts`. Lo lee todo el que calcula margen:
`dashboardMetrics` (`derive.ts:618`), `margenCampana` (`derive.ts:735`) y los
reportes de rentabilidad ([[reportes-rentabilidad]]).

Antes era una constante en el archivo de derivados:

```ts
// lib/data/derive.ts:254 — RETIRADA el 17/09
const COSTO_OPERATIVO_POR_OT = 1500
// Parámetro de demo; en producción vendría de ConfigNegocio o por tipo de OT.
```

> [!important] El respaldo NO se siembra en la base, y es a propósito
> `COSTOS_OT_RESPALDO` (`lib/costos-ot.ts`) tiene los **nueve** tipos del enum
> `tipo_ot` (`db/schema.sql:53`) y **todos valen 1500**, que es lo que costaba
> cualquier OT antes del cambio. El DEFAULT de la columna es `{}` —«sin
> configurar»—, no los nueve importes: sembrarlos pondría el número en dos
> sitios, y el día que el negocio lo cambie la flota seguiría con el viejo
> quemado en su fila sin que nada lo dijera.
>
> Consecuencia medible: la migración **no mueve el margen**. Una organización que
> no configure nada ve exactamente las cifras de ayer.
>
> Y cuánto cuesta una herrería frente a una inspección **no lo decide el
> código**: se captura en Configuración. El respaldo solo existe para que un
> tenant sin configurar no reviente ni cueste 0 — un costo de 0 se suma sin que
> nada falle y deja el margen inflado en pantalla.

`costoDeOt(tipo, costos)` cae al respaldo ante cualquier hueco: tenant sin fila,
columna vacía, tipo sin capturar, valor basura en el jsonb, y **tipo fuera del
enum** (cae al respaldo de `OTRO`, no a 0). El `0` configurado **sí manda**: es
un costo capturable de verdad, y confundirlo con «sin configurar» sería volver a
decidir por el usuario — el mismo hallazgo de CFG-01 con los plazos de cobranza.

Se escribe por `PATCH /api/config` con las claves como **enum cerrado**
(`app/api/config/route.ts`), y se **sanea al leer y al escribir**
(`sanearCostosOt`): la columna es jsonb y lo que entre se arrastra en cada
respaldo.

> [!success] 2026-09-21 · Ya hay pantalla — B11 cerrado
> Hasta hoy `PATCH /api/config` aceptaba `costosOt` pero solo se podía escribir
> con una petición a mano: la pantalla no existía. Ahora hay una tarjeta en
> **Administración → pestaña Configuración** (`CostosOtCard`,
> `app/(app)/(shell)/administracion/page.tsx`), con un input por cada tipo
> vigente de `TODOS_TIPOS_OT` (excluye `TIPO_OT_OBSOLETO`, o sea
> `MONTAJE_DIGITAL`: ya no se ofrece en ninguna pantalla).
>
> Qué viaja en el PATCH es la única decisión no trivial: solo los tipos que el
> usuario tocó en esta sesión, comparando el borrador contra el `costosOt` que
> trajo el último GET. Un campo vaciado desde un valor existente manda `null`
> explícito (quitar ese tipo, vuelve al respaldo); un campo que nunca se tocó
> no viaja. Vive en `lib/costos-ot-payload.ts` (`payloadCostosOt`), con su
> propia prueba — `.tsx` no se prueba con unitarias porque `vitest.config.ts`
> no monta jsdom.

## Almacén — artículos por TIPO (desde el 2026-09-30)

Pedido del dueño el 30/09: «en almacén se debe de poder añadir más elementos,
camionetas, herramientas, pantallas, cámaras, etc.».

**Lo que había antes**, medido en `main` (`17dfef6`): una tabla
`almacen_activos` (`db/migrations/20260723_almacen.sql:22-32`) con `etiqueta`,
`descripcion`, `tipo_activo text` **sin CHECK** y con default `'PANTALLA'`
(`:26`), `estado` enum `est_activo` (`:15`), `sitio_id` y `notas`; y
`almacen_movimientos` con el enum `tipo_mov_almacen` (`:19`). El catálogo de
tipos —PANTALLA / ESTRUCTURA / LONA / OTRO— vivía **solo en el `<select>` de la
pantalla**: la ruta guardaba cualquier texto que le llegara.

**Lo que cambia sin tocar la base** (el `text` sin CHECK lo permite):

- El catálogo vive en `lib/almacen-tipos.ts` (puro, lo usan servidor y
  pantalla): `VEHICULO`, `HERRAMIENTA`, `PANTALLA`, `EQUIPO`, `CAMARA`,
  `ESTRUCTURA`, `LONA`, `OTRO`.
- `almacen-controller.ts` lo **aplica en el servidor** con zod, `.strict()`:
  un tipo fuera del catálogo, o un `tenantId` en el cuerpo, da 400.
- `GET /api/almacen?tipo=X` filtra. **`OTRO` no es `= 'OTRO'`**: es «todo lo
  que no es de los demás» (`tipo_activo <> all($1::text[])`), porque las filas
  de antes pueden tener texto libre y tienen que caer en algún filtro. La
  pantalla cuenta con la MISMA regla (`tipoDeFiltro`), así que la pastilla y el
  filtro no pueden discrepar. Un `?tipo=` mal escrito da 400, no lista vacía.
- La pantalla enseña pastillas por tipo con su cuenta, y el texto libre de las
  filas viejas **tal cual** (no «Otro»): es lo único que dice qué son.
- `registrarMovimiento` gana `and tenant_id = $4` como segunda capa sobre la
  RLS: era la única operación por id del archivo sin ella.

> [!success] Los datos propios de cada tipo — migración **APROBADA por el dueño el 2026-09-30** (antes: pendiente de aprobación)
> Placas, marca, modelo, número de serie y ubicación en bodega **necesitan
> columnas nuevas**: `20261001_almacen_datos_por_tipo.sql` ([[migraciones]],
> [[esquema]]), en su **propio commit** de `feat/almacen-tipos` para que el
> catálogo pueda aterrizar sin ella (regla del 29/09: ningún cambio de base
> entra sin que él vea la forma).
>
> Qué pide cada tipo lo decide `camposDelTipo()` en `lib/almacen-tipos.ts`:
> vehículo → marca, modelo, serie (VIN) y **placas**; herramienta, pantalla,
> equipo, cámara y otro → marca, modelo y serie; estructura y lona → nada
> propio. `ubicacion` vale para todos. Un dato que el tipo no pide da 400 en
> el controller (`superRefine`), y las placas fuera de un vehículo las para
> además la base (`almacen_activos_placas_solo_vehiculo`). Las placas se
> guardan sin espacios y en mayúsculas.
>
> La columna «Ubicación» de la pantalla enseña la pantalla si está
> INSTALADO, y si no, `ubicacion` (la bodega).

Probado en `lib/almacen-tipos.test.ts`, `lib/server/almacen-controller.test.ts`
y, contra Postgres real y con dos organizaciones, en
`lib/test/almacen-tipos.e2e.test.ts`.

## Módulo móvil

`/m/ot/[id]` es una vista sin chrome para la cuadrilla en campo. Ver
[[paginas-publicas]].

> [!success] `OTMovil.tsx` se retiró el 2026-08-27 — no lo importaba nadie
> Importaba de `lib/auth-context.tsx`, el cliente JWT contra el backend
> archivado, y **eso lo hacía parecer una dependencia viva**. No lo era: la
> página real `/m/ot/[id]` renderiza `OTVista`, que está limpia. Los dos
> archivos salieron con la pista archivada. Ver [[zonas-de-riesgo]] §A6.

## Relacionadas
[[flujo-orden-de-trabajo]] · [[finanzas-y-cobranza]] · [[reportes-rentabilidad]] ·
[[arrendadores-y-contratos]] · [[integraciones-externas]] · [[MOC-Proyecto]]
